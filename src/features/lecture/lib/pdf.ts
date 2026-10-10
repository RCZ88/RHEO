// Renderer wrapper for PDF text extraction.
//
// The work happens in the MAIN process because a renderer cannot exec Poppler,
// and because a multi-hundred-page PDF would otherwise block the UI thread.
// Scanned pages come back as base64 PNGs so they can be handed straight to the
// local vision model instead of importing as blank pages.

const w = window as any;

export interface PdfPage {
  number: number;
  text: string;
  chars: number;
  /** Few characters on the page ⇒ almost certainly a scan with no text layer. */
  scanned: boolean;
  title: string;
  /** Rasterised PNG of the page, when rasterisation was requested and possible. */
  imageBase64?: string | null;
  hasImage?: boolean;
  /** Filled in by the caller after the local vision model reads the page. */
  ocrText?: string;
}

export interface PdfMeta {
  fileName: string;
  title: string;
  author: string;
  pageCount: number;
  scannedPages: number;
  /** False ⇒ the document has no text layer; importing it would store nothing. */
  hasTextLayer: boolean;
  tools: { pdftotext: boolean; pdftoppm: boolean; rasterised: boolean };
  bytes: number;
}

export interface PdfParseResult {
  pages: PdfPage[];
  meta: PdfMeta;
  error?: string;
}

export async function parsePdf(
  file: File,
  opts?: { rasteriseScanned?: boolean; maxPageImages?: number },
): Promise<PdfParseResult> {
  try {
    const base64 = await fileToBase64(file);
    const res = await w.deskflowAPI.lectureParsePdf({
      pdfBase64: base64,
      filename: file.name,
      rasteriseScanned: opts?.rasteriseScanned ?? false,
      maxPageImages: opts?.maxPageImages ?? 6,
    });
    if (!res) return { pages: [], meta: emptyMeta(file.name), error: 'No response from the main process.' };
    if (res.error) return { pages: [], meta: emptyMeta(file.name), error: String(res.error) };
    return { pages: res.pages || [], meta: res.meta || emptyMeta(file.name) };
  } catch (e: any) {
    return { pages: [], meta: emptyMeta(file.name), error: e?.message || String(e) };
  }
}

function emptyMeta(fileName: string): PdfMeta {
  return {
    fileName, title: fileName, author: '', pageCount: 0, scannedPages: 0,
    hasTextLayer: false, tools: { pdftotext: false, pdftoppm: false, rasterised: false }, bytes: 0,
  };
}

function fileToBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.onload = () => {
      const s = String(reader.result || '');
      const comma = s.indexOf(',');
      resolve(comma >= 0 ? s.slice(comma + 1) : s);
    };
    reader.readAsDataURL(file);
  });
}