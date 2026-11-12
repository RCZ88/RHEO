/** Removes obvious secrets before text is stored, embedded, extracted or served. */
const RULES: Array<[RegExp, string]> = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g, '[redacted:private-key]'],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g, '[redacted:jwt]'],
  [/\bsk-[A-Za-z0-9_-]{20,}\b/g, '[redacted:key]'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/g, '[redacted:key]'],
  [/\bAKIA[0-9A-Z]{16}\b/g, '[redacted:key]'],
  [/\bAIza[0-9A-Za-z_-]{30,}\b/g, '[redacted:key]'],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g, '[redacted:key]'],
  [/\b(Bearer)\s+[A-Za-z0-9._~+\/=-]{20,}/gi, '$1 [redacted]'],
  [/\b((?:api[_-]?key|secret|token|password|passwd)\s*[:=]\s*)["']?[^\s"']{6,}["']?/gi, '$1[redacted]'],
]

export function redactSecrets(text: string): string {
  if (!text) return text
  let out = text
  for (const [re, rep] of RULES) out = out.replace(re, rep)
  return out
}
