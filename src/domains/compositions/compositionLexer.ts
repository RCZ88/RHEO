import { Token, TokenType } from './compositionTypes';

const TOKEN_PATTERNS: { type: TokenType; pattern: RegExp }[] = [
  { type: 'WHEN',     pattern: /^when\b/i },
  { type: 'IF',       pattern: /^if\b/i },
  { type: 'THEN',     pattern: /^then\b/i },
  { type: 'ELSE',     pattern: /^else\b/i },
  { type: 'AND',      pattern: /^and\b/i },
  { type: 'OR',       pattern: /^or\b/i },
  { type: 'NOT',      pattern: /^not\b/i },
  { type: 'ON',       pattern: /^on\b/i },
  { type: 'EVERY',    pattern: /^every\b/i },
  { type: 'DO',       pattern: /^do\b/i },
  { type: 'LET',      pattern: /^let\b/i },
  { type: 'AS',       pattern: /^as\b/i },
  { type: 'BOOLEAN',  pattern: /^true|false\b/i },
  { type: 'NUMBER',   pattern: /^\d+(\.\d+)?/ },
  { type: 'STRING',   pattern: /^'[^']*'|^"[^"]*"/ },
  { type: 'NEQW',     pattern: /^neq\b/i },
  { type: 'EQW',      pattern: /^eq\b/i },
  { type: 'GTEW',     pattern: /^gte\b/i },
  { type: 'GTW',      pattern: /^gt\b/i },
  { type: 'LTEW',     pattern: /^lte\b/i },
  { type: 'LTW',      pattern: /^lt\b/i },
  { type: 'CONTAINS', pattern: /^contains\b/i },
  { type: 'MATCHES',  pattern: /^matches\b/i },
  { type: 'EXISTS',   pattern: /^exists\b/i },
  { type: 'NOT_EXISTS', pattern: /^not_exists\b/i },
  { type: 'IDENTIFIER', pattern: /^[a-zA-Z_][a-zA-Z0-9_]*/ },
  { type: 'ARROW',    pattern: /^=>/ },
  { type: 'PIPE',     pattern: /^\|>/ },
  { type: 'EQ',       pattern: /^==/ },
  { type: 'NEQ',      pattern: /^!=/ },
  { type: 'GTE',      pattern: /^>=/ },
  { type: 'LTE',      pattern: /^<=/ },
  { type: 'GT',       pattern: /^>/ },
  { type: 'LT',       pattern: /^</ },
  { type: 'EQ',       pattern: /^=/ },
  { type: 'DOT',      pattern: /^\./ },
  { type: 'COMMA',    pattern: /^,/ },
  { type: 'COLON',    pattern: /^:/ },
  { type: 'LPAREN',   pattern: /^\(/ },
  { type: 'RPAREN',   pattern: /^\)/ },
  { type: 'LBRACE',   pattern: /^\{/ },
  { type: 'RBRACE',   pattern: /^\}/ },
  { type: 'LBRACKET', pattern: /^\[/ },
  { type: 'RBRACKET', pattern: /^\]/ },
  { type: 'PLUS',     pattern: /^\+/ },
  { type: 'MINUS',    pattern: /^-/ },
  { type: 'STAR',     pattern: /^\*/ },
  { type: 'SLASH',    pattern: /^\// },
];

export function lex(input: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;
  let line = 1;
  let col = 1;

  while (pos < input.length) {
    const ch = input[pos];

    if (ch === '\n') {
      tokens.push({ type: 'NEWLINE', value: '\n', line, col });
      line++;
      col = 1;
      pos++;
      continue;
    }

    if (ch === '\r') { pos++; col++; continue; }

    if (ch === ' ' || ch === '\t') { pos++; col++; continue; }

    if (ch === '#') {
      while (pos < input.length && input[pos] !== '\n') pos++;
      continue;
    }

    let matched = false;
    for (const { type, pattern } of TOKEN_PATTERNS) {
      const slice = input.slice(pos);
      const m = slice.match(pattern);
      if (m && m[0].length > 0) {
        let value = m[0];
        if (type === 'STRING') value = value.slice(1, -1);
        tokens.push({ type, value, line, col });
        pos += m[0].length;
        col += m[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      tokens.push({ type: 'ERROR', value: ch, line, col });
      pos++;
      col++;
    }
  }

  tokens.push({ type: 'EOF', value: '', line, col });
  return tokens;
}
