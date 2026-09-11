// Render-time mojibake sanitizer — last line of defense so corrupt bytes
// never display raw in the UI. Cheap char replacements; applies only when the
// string actually contains mojibake markers.

import { repairDoubleEncodedUtf8 } from './mojibake';

export function sanitizeMojibake(text: string): string {
  if (!text) return '';
  if (
    !text.includes('Ã') &&
    !text.includes('Â') &&
    !text.includes('â€') &&
    !text.includes('\uFFFD')
  ) {
    return text;
  }
  return repairDoubleEncodedUtf8(text);
}
