// contextFormatter.ts — formats Context Brain + Memory Store retrieval output for
// injection into terminal agent sessions (assemble-context). Pure functions, no deps.
// Spec: agent/docs/generate-prompt-docs/context-retrieval-memory-restore-17082026/RESULT.md

export function formatBrainContext(topic: string, result: any): string {
  const lines: string[] = [];
  lines.push(`## Memory — ${topic} (from Context Brain)`);

  // RESULT-2C: show entity NAMES, never raw subjectId/objectId hashes. The
  // name map comes from the retrieval result's own entities array.
  const nameOf = (id?: string | null): string => {
    if (!id) return '?';
    const e = (result?.entities || []).find((x: any) => x?.id === id);
    return e?.name || id;
  };

  const facts = (result?.facts || []).slice(0, 8);
  if (facts.length > 0) {
    lines.push('### Facts');
    for (const f of facts) {
      const confidence = typeof f.confidence === 'number' ? f.confidence.toFixed(2) : '?';
      const objectValue = f.objectLiteral ?? nameOf(f.objectId);
      lines.push(`- ${nameOf(f.subjectId)} ${f.predicate} ${objectValue} (confidence: ${confidence})`);
    }
  }

  const entities = (result?.entities || []).slice(0, 6);
  if (entities.length > 0) {
    lines.push('### Related entities');
    for (const e of entities) {
      const aliases = e.aliases?.length ? ` (aliases: ${e.aliases.join(', ')})` : '';
      lines.push(`- ${e.type}: ${e.name}${aliases}`);
    }
  }

  const episodes = (result?.episodes || []).slice(0, 5);
  if (episodes.length > 0) {
    lines.push('### Relevant episodes');
    for (const ep of episodes) {
      const excerpt = String(ep.content || '').replace(/\s+/g, ' ').slice(0, 200);
      lines.push(`- [${ep.source}] ${excerpt}... (${ep.occurredAt || ''})`);
    }
  }

  return lines.join('\n');
}

export function formatMemoryContext(agentMemories: any[], chatMemories: any[]): string {
  const items: string[] = [];
  for (const m of (agentMemories || []).slice(0, 3)) {
    const date = m.createdAt ? new Date(m.createdAt).toISOString().slice(0, 10) : '';
    const excerpt = String(m.content || '').replace(/\s+/g, ' ').slice(0, 200);
    items.push(`- ${excerpt}... (${date})`);
  }
  for (const m of (chatMemories || []).slice(0, 3)) {
    const date = m.created_at ? String(m.created_at).slice(0, 10) : '';
    const excerpt = String(m.content || '').replace(/\s+/g, ' ').slice(0, 200);
    items.push(`- ${excerpt}... (${date})`);
  }
  if (items.length === 0) return '';
  return ['## Memory — saved notes', ...items].join('\n');
}

export function truncateToBudget(markdownString: string, maxChars: number): string {
  if (markdownString.length <= maxChars) return markdownString;

  const sections = splitSections(markdownString);
  const facts = sections.filter(s => s.header.includes('Facts'));
  const entities = sections.filter(s => s.header.includes('entities'));
  const episodes = sections.filter(s => s.header.includes('episodes'));
  const notes = sections.filter(s => s.header.includes('saved notes'));

  let output = '';
  let currentLength = 0;

  for (const block of [...facts, ...entities]) {
    output += block.raw + '\n';
    currentLength += block.raw.length;
  }

  episodes.sort((a, b) => b.raw.length - a.raw.length);
  for (const ep of episodes) {
    if (currentLength + ep.raw.length < maxChars - 200) {
      output += ep.raw + '\n';
      currentLength += ep.raw.length;
    } else {
      const allowedChars = maxChars - currentLength - 100;
      if (allowedChars > 50) {
        output += ep.raw.substring(0, allowedChars) + '... [TRUNCATED]\n';
      }
      break;
    }
  }

  for (const note of notes) {
    if (currentLength + note.raw.length < maxChars) {
      output += note.raw + '\n';
      currentLength += note.raw.length;
    }
  }

  if (output.length > maxChars) {
    output = output.substring(0, Math.max(0, maxChars - 3)) + '...';
  }

  return output.trim();
}

function splitSections(markdownString: string): Array<{ header: string; raw: string }> {
  const sections: Array<{ header: string; raw: string }> = [];
  let currentHeader = '';
  let currentBody: string[] = [];
  for (const line of markdownString.split('\n')) {
    if (line.startsWith('### ')) {
      if (currentHeader) sections.push({ header: currentHeader, raw: [currentHeader, ...currentBody].join('\n') });
      currentHeader = line;
      currentBody = [];
    } else {
      currentBody.push(line);
    }
  }
  if (currentHeader) sections.push({ header: currentHeader, raw: [currentHeader, ...currentBody].join('\n') });
  return sections;
}