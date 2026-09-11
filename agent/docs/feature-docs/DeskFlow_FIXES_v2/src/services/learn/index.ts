// Lyceum Learn module — IPC handler registration
// Call registerLearnHandlers(db, callAi) from main.ts during startup

import { ipcMain, dialog, app, BrowserWindow } from 'electron';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import type Database from 'better-sqlite3';
import { runMigration } from './db/repo';
import { ContentService } from './services/content.service';
import { ImportService } from './services/import.service';
import { ProgressService } from './services/progress.service';
import { TutorService } from './services/tutor.service';
import { validateFull } from './validator/validate';
import { toLdoc } from './lessonInput';
import { LessonMarkdownError } from './parseLessonMarkdown';

/** Pull the outermost {...} out of an LLM response, dropping fences/prose. */
function extractJsonObject(raw: string): string {
  let s = raw.trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  const first = s.indexOf('{');
  const last = s.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) s = s.slice(first, last + 1);
  return s.trim();
}

/** Remove trailing commas before } or ]. */
function stripTrailingCommas(s: string): string {
  return s.replace(/,\s*([}\]])/g, '$1');
}

/** Defensive parse: raw → extracted → comma-stripped. Clear error on failure. */
function parseLessonJson(raw: string):
  | { ok: true; data: unknown }
  | { ok: false; error: string } {
  const attempts = [
    raw,
    extractJsonObject(raw),
    stripTrailingCommas(raw),
    stripTrailingCommas(extractJsonObject(raw)),
  ];
  for (const candidate of attempts) {
    try {
      return { ok: true, data: JSON.parse(candidate) };
    } catch {
      /* try next */
    }
  }
  const cleaned = stripTrailingCommas(extractJsonObject(raw));
  try {
    return { ok: true, data: JSON.parse(cleaned) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      error: `AI output was not valid JSON even after sanitisation: ${msg}. ` +
        `Cleaned preview (first 200 chars): ${cleaned.slice(0, 200)}`,
    };
  }
}

export function registerLearnHandlers(
  db: Database,
  callAi: (prompt: string, systemPrompt: string, maxTokens?: number) => Promise<any>
) {
  // Run migration
  runMigration(db);

  const content = new ContentService(db);
  const importer = new ImportService(db);
  const progress = new ProgressService(db);
  const tutor = new TutorService(db, callAi);

  // ── Import & Validate ──

  ipcMain.handle('learn:importLdoc', (_event, { json }: { json: unknown }) => {
    return importer.importLdoc(json);
  });

  ipcMain.handle('learn:validate', (_event, { json }: { json: unknown }) => {
    return validateFull(json);
  });

  // ── File picker & bundled resources ──

  ipcMain.handle('learn:pick-file', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select .ldoc lesson file',
      filters: [{ name: 'Lyceum Document', extensions: ['ldoc', 'json'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return { canceled: true };
    const content = readFileSync(result.filePaths[0], 'utf-8');
    return { canceled: false, content, filePath: result.filePaths[0] };
  });

  function resourcePath(name: string) {
    const dev = resolve(app.getAppPath(), 'resources/learn', name);
    if (existsSync(dev)) return dev;
    return resolve(app.getAppPath(), 'dist-electron/resources/learn', name);
  }

  ipcMain.handle('learn:get-worked-example', () => {
    const fp = resourcePath('memory-hierarchy.ldoc');
    if (!existsSync(fp)) return { found: false, content: null };
    return { found: true, content: readFileSync(fp, 'utf-8') };
  });

  ipcMain.handle('learn:get-schema', () => {
    const fp = resourcePath('ldoc.schema.json');
    if (!existsSync(fp)) return { found: false, content: null };
    return { found: true, content: readFileSync(fp, 'utf-8') };
  });

  ipcMain.handle('learn:get-author-guide', () => {
    const fp = resourcePath('author-guide.md');
    if (!existsSync(fp)) return { found: false, content: null };
    return { found: true, content: readFileSync(fp, 'utf-8') };
  });

  // ── Content ──

  ipcMain.handle('learn:listLessons', (_event, { part }: { part?: number } = {}) => {
    return content.listLessons(part);
  });

  ipcMain.handle('learn:getLesson', (_event, { lessonId }: { lessonId: string }) => {
    return content.getLesson(lessonId);
  });

  ipcMain.handle('learn:getNode', (_event, { nodeId }: { nodeId: string }) => {
    return content.getNode(nodeId);
  });

  ipcMain.handle('learn:getGraph', (_event, { part }: { part?: number } = {}) => {
    return content.getGraph(part);
  });

  // ── Tutor ──

  ipcMain.handle('learn:askTutor', (_event, params: { nodeId: string; blockId?: string; question: string }) => {
    return tutor.ask(params);
  });

  ipcMain.handle('learn:submitQuiz', (_event, params: { nodeId: string; blockId: string; response: string }) => {
    return tutor.submitQuiz(params);
  });

  // ── Progress ──

  ipcMain.handle('learn:getProgress', (_event, { nodeId }: { nodeId?: string } = {}) => {
    return progress.getProgress(nodeId);
  });

  ipcMain.handle('learn:getDueReviews', () => {
    return progress.getDueReviews();
  });

  // ── Content Generation ──

  ipcMain.handle('learn:buildPrompt', async (_event, params: {
    userInput?: string;
    topic?: string;
    description?: string;
    contextDoc?: string;
    numNodes?: number;
    masteryTargets?: string[];
  }) => {
    const guideFp = resourcePath('author-guide.md');
    if (!existsSync(guideFp)) return { ok: false, error: 'author-guide.md not found', prompt: '' };
    const systemPrompt = readFileSync(guideFp, 'utf-8');

    let userPrompt: string;

    if (params.userInput !== undefined) {
      userPrompt = `The learner has described what they want to learn below. Infer the appropriate number of concepts (3-6), mastery targets, lesson structure, and depth from their description. Create a comprehensive lesson that covers exactly what they've asked for.\n\n--- LEARNER'S REQUEST ---\n${params.userInput.trim()}\n`;
      if (params.contextDoc && params.contextDoc.trim()) {
        userPrompt += `\n--- REFERENCE MATERIAL (use these facts and cite sources where relevant) ---\n"""\n${params.contextDoc.trim()}\n"""\n`;
      }
    } else {
      userPrompt = `Author a lesson on: ${params.topic}\n`;
      if (params.description && params.description.trim()) {
        userPrompt += `\nAdditional context from the learner:\n${params.description.trim()}\n`;
      }
      if (params.contextDoc && params.contextDoc.trim()) {
        userPrompt += `\nReference material provided by the learner (use these facts and cite sources):\n"""\n${params.contextDoc.trim()}\n"""\n`;
      }
      if (params.numNodes && params.numNodes > 0) {
        userPrompt += `\nStructure: create exactly ${params.numNodes} concepts/nodes.`;
      }
      if (params.masteryTargets && params.masteryTargets.length > 0) {
        userPrompt += `\nMastery targets: use these levels for your nodes — ${params.masteryTargets.join(', ')}.`;
      }
    }

    const fullPrompt = systemPrompt + '\n\n---\n\n' + userPrompt;
    return { ok: true, prompt: fullPrompt, systemPrompt, userPrompt };
  });

  ipcMain.handle('learn:generateLdoc', async (_event, { prompt, systemPrompt }: {
    prompt: string;
    systemPrompt: string;
  }) => {
    try {
      const raw = await callAi(prompt, systemPrompt, 8000);
      if (!raw || typeof raw !== 'string') {
        return { ok: false, error: 'AI returned an empty response. Check your AI provider settings.' };
      }

      // Compile Lesson Markdown (preferred) or fall back to raw .ldoc JSON.
      let parsed: unknown;
      try {
        parsed = toLdoc(raw).doc;
      } catch (e) {
        const msg = e instanceof LessonMarkdownError ? e.message : (e as Error).message;
        return { ok: false, error: `Could not compile the lesson: ${msg}`, raw };
      }

      const valResult = validateFull(parsed);
      if (!valResult.ok) {
        return { ok: false, error: 'AI-generated lesson failed validation', validation: valResult, raw };
      }

      return importer.importLdoc(parsed);
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  });
}
