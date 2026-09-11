// Image Generation Service
// Calls image APIs (OpenAI, Stability, Replicate) with the Ian Xiaohei style

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// ── Ian Xiaohei Style Instructions ──────────────────────────────────────────

export const IAN_XIAOHEI_STYLE = `STYLE RULES (Ian Xiaohei / 小黑 — https://github.com/helloianneo/ian-xiaohei-illustrations):
Visual DNA: Pure white background (#FFFFFF). Minimalist black hand-drawn line art. Slightly wobbly pen lines. Lots of empty white space. Sparse red/orange/blue handwritten Chinese annotations. Clean absurd product-sketch feeling. No gradients, no shadows, no paper texture, no complex background, no commercial vector style, no PPT infographic look, no cute mascot poster, no children's illustration, no realistic UI.

CHARACTER: 小黑 (Xiaohei)
- Small solid-black absurd creature with white dot eyes, tiny thin legs, blank serious expression
- Slightly uneven hand-drawn body shape (can be cylinder, black bean, box, funnel, shadow)
- 小黑 must perform the core conceptual action, not decorate the scene
- Serious, deadpan, slightly bizarre — NOT cute, NOT a mascot, NOT a sticker
- If removing 小黑 makes the core metaphor still work, 小黑 is too decorative — redo

COMPOSITION:
- 16:9 horizontal format
- Subject occupies 40-60% of frame, at least 35% blank white space
- One clear focal action, 2-4 distinct objects max
- Isometric or slight 3/4 view preferred
- Clean lines, no crosshatching, no shading

COLOR USE:
- Black: main line art, 小黑, frame lines, structure, main text
- Orange (#FF9800): main flow, path, arrows, automation direction
- Red (#E53935): key warnings, problems, results, emotional points
- Blue (#1E88E5): secondary notes, feedback, system state, AI/assistant hints
- Colors are restrained — less is more. Blue is not required on every image.

ANNOTATIONS:
- Max 5-8 short handwritten Chinese labels per image, each 2-8 characters
- Do NOT write a title in the top-left corner
- Do NOT write the structure type name on the image

AVOID:
- Commercial illustration, PPT infographics, formal flowcharts, course slides
- Cute cartoon posters, children's illustration, mascot-style characters
- Complex architecture diagrams, polished flat illustration, tech UI
- Complex backgrounds, gradients, shadows, textures
- Explaining every node — keep it sparse and suggestive`;

// ── Types ───────────────────────────────────────────────────────────────────

export interface ImageGenRequest {
  prompt: string;
  style?: 'ian-xiaohei' | 'minimal' | 'none';
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'standard' | 'hd';
}

export interface ImageGenResult {
  ok: boolean;
  imagePath?: string;
  imageData?: string; // base64
  error?: string;
  provider?: string;
  model?: string;
}

interface ProviderConfig {
  id: string;
  apiKey: string;
  baseUrl?: string;
  model: string;
}

// ── Provider Adapters ───────────────────────────────────────────────────────

async function callOpenAI(config: ProviderConfig, request: ImageGenRequest): Promise<ImageGenResult> {
  const prompt = request.style === 'ian-xiaohei'
    ? `${IAN_XIAOHEI_STYLE}\n\nSCENE: ${request.prompt}`
    : request.prompt;

  const response = await fetch(`${config.baseUrl || 'https://api.openai.com/v1'}/images/generations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model || 'dall-e-3',
      prompt,
      n: 1,
      size: request.size || '1792x1024',
      quality: request.quality || 'standard',
      response_format: 'b64_json',
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return { ok: false, error: err.error?.message || `OpenAI API error: ${response.status}` };
  }

  const data = await response.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) return { ok: false, error: 'No image data in response' };

  return { ok: true, imageData: b64, provider: 'openai', model: config.model };
}

async function callStability(config: ProviderConfig, request: ImageGenRequest): Promise<ImageGenResult> {
  const prompt = request.style === 'ian-xiaohei'
    ? `${IAN_XIAOHEI_STYLE}\n\nSCENE: ${request.prompt}`
    : request.prompt;

  const response = await fetch(`${config.baseUrl || 'https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image'}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      text_prompts: [{ text: prompt, weight: 1 }],
      cfg_scale: 7,
      height: 576,
      width: 1024,
      steps: 30,
      samples: 1,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    return { ok: false, error: err.message || `Stability API error: ${response.status}` };
  }

  const data = await response.json();
  const b64 = data.artifacts?.[0]?.base64;
  if (!b64) return { ok: false, error: 'No image data in response' };

  return { ok: true, imageData: b64, provider: 'stability', model: config.model };
}

async function callReplicate(config: ProviderConfig, request: ImageGenRequest): Promise<ImageGenResult> {
  const prompt = request.style === 'ian-xiaohei'
    ? `${IAN_XIAOHEI_STYLE}\n\nSCENE: ${request.prompt}`
    : request.prompt;

  // Create prediction
  const createResponse = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: {
      'Authorization': `Token ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      version: config.model || 'black-forest-labs/flux-schnell',
      input: { prompt, num_outputs: 1, aspect_ratio: '16:9', output_format: 'png' },
    }),
  });

  if (!createResponse.ok) {
    const err = await createResponse.json().catch(() => ({}));
    return { ok: false, error: err.error || `Replicate API error: ${createResponse.status}` };
  }

  const prediction = await createResponse.json();

  // Poll for completion
  let result = prediction;
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const pollResponse = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
      headers: { 'Authorization': `Token ${config.apiKey}` },
    });
    result = await pollResponse.json();
    if (result.status === 'succeeded') break;
    if (result.status === 'failed') return { ok: false, error: result.error || 'Generation failed' };
  }

  if (result.status !== 'succeeded') return { ok: false, error: 'Generation timed out' };

  const imageUrl = Array.isArray(result.output) ? result.output[0] : result.output;
  if (!imageUrl) return { ok: false, error: 'No image URL in response' };

  // Download the image
  const imgResponse = await fetch(imageUrl);
  if (!imgResponse.ok) return { ok: false, error: 'Failed to download generated image' };

  const buffer = Buffer.from(await imgResponse.arrayBuffer());
  const b64 = buffer.toString('base64');

  return { ok: true, imageData: b64, provider: 'replicate', model: config.model };
}

// ── Main Entry Point ────────────────────────────────────────────────────────

export async function generateImage(
  request: ImageGenRequest,
  providerConfig: ProviderConfig,
  saveDir?: string,
  filename?: string,
): Promise<ImageGenResult> {
  const providerId = providerConfig.id.toLowerCase();

  let result: ImageGenResult;
  if (providerId === 'openai' || providerId === 'openrouter') {
    result = await callOpenAI(providerConfig, request);
  } else if (providerId === 'stability' || providerId === 'stabilityai') {
    result = await callStability(providerConfig, request);
  } else if (providerId === 'replicate') {
    result = await callReplicate(providerConfig, request);
  } else {
    return { ok: false, error: `Unsupported provider: ${providerId}` };
  }

  // Save to disk if requested
  if (result.ok && result.imageData && saveDir) {
    try {
      mkdirSync(saveDir, { recursive: true });
      const fname = filename || `illustration-${Date.now()}.png`;
      const filePath = join(saveDir, fname);
      writeFileSync(filePath, Buffer.from(result.imageData, 'base64'));
      result.imagePath = filePath;
    } catch (e: any) {
      result.error = `Failed to save image: ${e.message}`;
    }
  }

  return result;
}

// ── Explain-with-Image: AI generates prompt from confused text ──────────────

const EXPLAIN_WITH_IMAGE_SYSTEM = `You are a visual educator generating illustrations in the Ian Xiaohei (小黑) style (https://github.com/helloianneo/ian-xiaohei-illustrations).

The user is confused about a concept. Your job is to:
1. Understand what they're confused about
2. Invent a low-tech physical metaphor that makes the abstract concept concrete (funnel, box, lever, scale, pipe, door, well, ladder, machine, sorting desk, postal service)
3. Put 小黑 (a small deadpan black creature with white dot eyes) IN the action — pulling, carrying, sorting, pushing, feeding, holding — NOT standing beside a diagram
4. Generate a prompt following the Ian Xiaohei style rules

STYLE RULES:
- Pure white background, black hand-drawn line art, slightly wobbly
- Generous white space (subject 40-60% of canvas)
- 1-3 sparse Chinese handwritten annotations (red for warnings, orange for flow, blue for notes)
- 16:9 horizontal format
- One image = one core concept only
- NOT cute, NOT cartoonish, NOT PPT infographic, NOT complex architecture

OUTPUT FORMAT (JSON only):
{
  "concept": "one-line summary of what the user is confused about",
  "metaphor": "the physical metaphor you chose (e.g. 'sorting desk', 'funnel machine', 'lever system')",
  "prompt": "the full prompt following the Ian Xiaohei template — include Visual DNA, 小黑 character, theme, structure type, core idea, composition, suggested elements, and Chinese labels",
  "annotations": ["中文标注1", "中文标注2"]
}`;

export async function generateExplainPrompt(
  confusedText: string,
  contextText: string,
  callAi: (prompt: string, systemPrompt: string, maxTokens?: number) => Promise<string>,
): Promise<{ ok: boolean; data?: { concept: string; metaphor: string; prompt: string; annotations: string[] }; error?: string }> {
  const userPrompt = `The user selected this text and is confused:
"${confusedText}"

Context around the selection:
"${contextText}"

Generate an illustration prompt that would visually explain this concept using the 小黑 character.`;

  try {
    const raw = await callAi(userPrompt, EXPLAIN_WITH_IMAGE_SYSTEM, 500);
    // Extract JSON from response
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return { ok: false, error: 'Failed to parse AI response' };
    const parsed = JSON.parse(jsonMatch[0]);
    return { ok: true, data: parsed };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}
