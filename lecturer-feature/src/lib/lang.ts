const ID_WORDS = ['yang','dan','dengan','untuk','pada','adalah','tidak','dari','dalam','akan','juga','karena','sebagai','oleh','tentang','antara','dapat','harus','sudah','telah','saya','kami','kita','mereka','belajar','kuliah','dosen','tugas','materi','contoh','sehingga','namun','tetapi','permasalahan','pemahaman','penjelasan','berikut'];
const EN_WORDS = ['the','and','with','for','this','that','from','have','will','which','about','their','there','would','these','those','lecture','example','theorem','function','algorithm','because','therefore','however'];
export function detectLanguage(text: string): { lang: 'en' | 'id' | 'mixed'; confidence: number; enScore: number; idScore: number } {
  const lower = (' ' + text.toLowerCase() + ' ');
  let id = 0, en = 0;
  for (const w of ID_WORDS) { const m = lower.split(' ' + w + ' ').length - 1; id += m * (w.length > 5 ? 2 : 1); }
  for (const w of EN_WORDS) { const m = lower.split(' ' + w + ' ').length - 1; en += m; }
  const idChars = (lower.match(/[aiueo]ng\b/g) || []).length * 0.2;
  id += idChars;
  const total = id + en;
  if (total === 0) return { lang: 'en', confidence: 0.5, enScore: en, idScore: id };
  const idR = id / total;
  if (idR > 0.68) return { lang: 'id', confidence: idR, enScore: en, idScore: id };
  if (idR < 0.32) return { lang: 'en', confidence: 1 - idR, enScore: en, idScore: id };
  return { lang: 'mixed', confidence: 1 - Math.abs(0.5 - idR), enScore: en, idScore: id };
}
export const CS_MATH_TERMS = ['algorithm','theorem','lemma','proof','complexity','recurrence','matrix','eigenvalue','derivative','integral','gradient','probability','distribution','graph','tree','hash','recursion','induction','polynomial','vector','regression','neural','entropy','algoritma','teorema','matriks','turunan','integral','peluang','graf','pohon','rekursi','induksi','vektor','fungsi','persamaan'];
export function highlightTerms(text: string): string[] { const l = text.toLowerCase(); return CS_MATH_TERMS.filter(t => l.includes(t)); }
