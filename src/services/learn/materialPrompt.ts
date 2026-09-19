export type MaterialType =
  | 'image'
  | 'video'
  | 'slides'
  | 'word'
  | 'pdf'
  | 'ebook'
  | 'audio'
  | 'text'
  | 'other';

export interface MaterialSource {
  name: string;
  meta?: string;
  note?: string;
  content?: string;
}

export const MATERIAL_IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg|bmp|avif|ico|heic)$/i;
export const MATERIAL_VIDEO_EXT = /\.(mp4|mov|webm|mkv|avi|wmv|m4v|flv|mpeg|mpg)$/i;
export const MATERIAL_SLIDES_EXT = /\.(pptx?|key|odp)$/i;
export const MATERIAL_WORD_EXT = /\.(docx?|rtf|odt)$/i;
export const MATERIAL_PDF_EXT = /\.pdf$/i;
export const MATERIAL_EBOOK_EXT = /\.(epub|mobi|azw3?|fb2)$/i;
export const MATERIAL_AUDIO_EXT = /\.(mp3|wav|m4a|ogg|flac|wma|aac)$/i;
export const MATERIAL_TEXT_EXT = /\.(txt|md|markdown|json)$/i;

export function materialTypeFromName(name: string): MaterialType {
  if (MATERIAL_IMAGE_EXT.test(name)) return 'image';
  if (MATERIAL_VIDEO_EXT.test(name)) return 'video';
  if (MATERIAL_SLIDES_EXT.test(name)) return 'slides';
  if (MATERIAL_WORD_EXT.test(name)) return 'word';
  if (MATERIAL_PDF_EXT.test(name)) return 'pdf';
  if (MATERIAL_EBOOK_EXT.test(name)) return 'ebook';
  if (MATERIAL_AUDIO_EXT.test(name)) return 'audio';
  if (MATERIAL_TEXT_EXT.test(name)) return 'text';
  return 'other';
}

export const MATERIAL_TYPE_LABEL: Record<MaterialType, string> = {
  image: 'image',
  video: 'video',
  slides: 'slides',
  word: 'word doc',
  pdf: 'pdf',
  ebook: 'ebook',
  audio: 'audio',
  text: 'text',
  other: 'reference',
};

const LIGHT_TERMS = '3–5 concrete terms with a one-line definition each';
const LIGHT_EXAMPLE = '1 worked example or concrete illustration';
const LIGHT_MISCONCEPTION = '1 likely misconception a beginner would hold';
const LIGHT_PROMPT_LINE = 'one buildable one-sentence lesson prompt the Lyceum builder can run as-is';

export const MATERIAL_TRANSLATOR_SYSTEM = `You are the Lesson Material Translator for the Lyceum lesson builder.

You receive reference materials — images, videos, slides (PPT), Word documents, PDFs, ebooks, audio, and plain text — and you translate EACH ONE into a lightweight, self-contained prompt text that a lesson builder can consume.

Rules (hard, always):
1. Translate every listed material into its own compact digest. Never skip an item.
2. Read binary materials (images, videos, slides, Word, PDF, ebooks, audio) directly from whatever the user attached — never refuse them.
3. For text materials, use the inline text I provide; do not ask for it back.
4. Each digest is TINY: the ONE governing concept + ${LIGHT_TERMS} + ${LIGHT_EXAMPLE} + ${LIGHT_MISCONCEPTION} + ${LIGHT_PROMPT_LINE}.
5. Keep every digest under ~120 words. Cut ruthlessly. No backticks, no JSON, no raw transcription, no repeated boilerplate.
6. If a material is thin or unreadable, say so in one line and output the best-one-sentence lesson prompt you can from its filename alone — never output nothing.
7. Output markdown. A blank line between digests. No preamble, no outro.`;

export function materialToLightweightPrompt(material: MaterialSource, index: number): string {
  const type = materialTypeFromName(material.name);
  const label = MATERIAL_TYPE_LABEL[type];
  const meta = material.meta ? ` · ${material.meta}` : '';
  const header = `### ${index}. ${material.name} — ${label}${meta}`;

  const inlineText = material.content?.trim();
  const body = inlineText
    ? `Inline text: ${inlineText.length > 1200 ? inlineText.slice(0, 1200) + '…' : inlineText}`
    : material.note?.trim()
    ? `User note: ${material.note.trim()}`
    : 'Read the attached file directly.';

  const driving = {
    image: 'Describe what the image shows and distil it into a lesson.',
    video: 'Watch/listen the video and distil its teaching content into a lesson.',
    slides: 'Walk the slides top-to-bottom and distil them into a lesson.',
    word: 'Read the document and distil it into a lesson.',
    pdf: 'Read the PDF and distil it into a lesson.',
    ebook: 'Read the ebook and distil it into a lesson.',
    audio: 'Listen to the recording and distil it into a lesson.',
    text: 'Use the inline text exactly as your source of truth.',
    other: 'Use whatever this reference is and distil it into a lesson.',
  }[type];

  return `${header}
${body}
${driving} Extract: the ONE governing concept; ${LIGHT_TERMS}; ${LIGHT_EXAMPLE}; ${LIGHT_MISCONCEPTION}. Finish with ${LIGHT_PROMPT_LINE}.
`;
}

export function buildMaterialPackPrompt(materials: MaterialSource[], goal?: string): string {
  const numbered = materials.map((m, i) => materialToLightweightPrompt(m, i + 1)).join('\n');
  const objective = goal?.trim()
    ? goal.trim()
    : 'a well-structured Lyceum lesson (5 concepts, balanced depth)';
  const user = `Translate these reference materials for me. I am building ${objective}.

${numbered}
For the pack, add one final line: the combined lesson prompt that folds every digest into a single lesson.`;
  return `${MATERIAL_TRANSLATOR_SYSTEM}

---
USER
${user}`;
}

export const MATERIAL_TO_PROMPT_SNIPPET = `Translate these reference materials (images, videos, PPT, Word, PDF, ebooks, audio) into lightweight lesson-builder prompt texts. For each: one governing concept, 3–5 terms with one-line definitions, one worked example, one misconception, and one buildable one-sentence lesson prompt. Keep each digest under ~120 words, no backticks, no transcription.`;