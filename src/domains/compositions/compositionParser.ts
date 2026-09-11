import { Token, TokenType, ASTNode, CompositionRule, EventPattern, SchedulePattern, ConditionClause, ActionBlock, ActionItem, BindingDeclaration, ExpressionNode, LiteralNode, IdentifierNode } from './compositionTypes';

export class ParserError extends Error {
  constructor(public token: Token, message: string) {
    super(`[${token.line}:${token.col}] ${message}`);
  }
}

// Maps human-readable word operators (emitted by the visual builder's
// dslGenerator + NL parser) to the engine's canonical operator strings.
const WORD_OP_MAP: Partial<Record<TokenType, string>> = {
  EQW: '==', NEQW: '!=', GTW: '>', GTEW: '>=', LTW: '<', LTEW: '<=',
  CONTAINS: 'contains', MATCHES: 'matches', EXISTS: 'exists', NOT_EXISTS: 'not_exists',
};

export class Parser {
  private pos = 0;

  constructor(private tokens: Token[]) {}

  parse(): ASTNode[] {
    const nodes: ASTNode[] = [];
    while (this.peek().type !== 'EOF') {
      nodes.push(this.parseRule());
    }
    return nodes;
  }

  private parseRule(): CompositionRule {
    const trigger = this.tryParseEventTrigger();
    const schedule = this.tryParseSchedule();
    const conditions = this.parseConditionClause();
    const actions = this.parseActionBlock();
    const bindings = this.tryParseBindings();
    return { kind: 'rule', trigger, schedule, conditions, actions, bindings };
  }

  private tryParseEventTrigger(): EventPattern | undefined {
    if (this.peek().type !== 'ON') return undefined;
    this.advance('ON');
    const source = this.advance('IDENTIFIER').value;
    let eventName = source;
    while (this.peek().type === 'DOT') {
      this.advance('DOT');
      eventName = this.advance('IDENTIFIER').value;
    }
    return { kind: 'event', source, eventName, filters: undefined };
  }

  private tryParseSchedule(): SchedulePattern | undefined {
    if (this.peek().type !== 'EVERY') return undefined;
    this.advance('EVERY');
    let parts: string[] = [];
    while (this.peek().type !== 'DO' && this.peek().type !== 'NEWLINE' && this.peek().type !== 'EOF' && this.peek().type !== 'STRING') {
      parts.push(this.advance().value);
    }
    let cron: string;
    const raw = parts.join(' ');
    if (/^\d+/.test(raw)) {
      const m = raw.match(/^(\d+)\s+(\S+)/);
      if (m) {
        const n = parseInt(m[1]);
        const unit = m[2].toLowerCase();
        const cronMap: Record<string, string> = {
          minute: `*/${n} * * * *`, minutes: `*/${n} * * * *`,
          hour: `0 */${n} * * *`, hours: `0 */${n} * * *`,
          day: `0 0 */${n} * *`, days: `0 0 */${n} * *`,
          week: `0 0 * * 0/${n}`, weeks: `0 0 * * 0/${n}`,
        };
        cron = cronMap[unit] || `*/${n} * * * *`;
      } else {
        cron = `*/5 * * * *`;
      }
    } else {
      const named: Record<string, string> = {
        minute: '* * * * *', hour: '0 * * * *', day: '0 0 * * *', week: '0 0 * * 0', month: '0 0 1 * *',
      };
      cron = named[raw.toLowerCase()] || `*/5 * * * *`;
    }
    let timezone: string | undefined;
    if (this.peek().type === 'STRING') timezone = this.advance('STRING').value;
    return { kind: 'schedule', cron, timezone };
  }

  private parseConditionClause(): ConditionClause {
    while (this.peek().type === 'NEWLINE') this.advance('NEWLINE');
    let hadIf = false;
    if (this.peek().type === 'IF') {
      this.advance('IF');
      hadIf = true;
    }
    if (!this.isConditionStart(this.peek().type)) {
      if (hadIf) throw new ParserError(this.peek(), `Expected condition after 'if'`);
      return { kind: 'condition', operator: 'and', operands: [] };
    }
    const operands: (ConditionClause | ExpressionNode)[] = [];
    operands.push(this.parseExpression());

    let operator: 'and' | 'or' = 'and';
    while (this.peek().type === 'AND' || this.peek().type === 'OR') {
      operator = this.advance().type === 'OR' ? 'or' : 'and';
      operands.push(this.parseExpression());
    }

    if (operands.length === 1) {
      const single = operands[0];
      if (single.kind === 'condition') return single;
      return { kind: 'condition', operator: 'and', operands: [single] };
    }
    return { kind: 'condition', operator, operands };
  }

  private isConditionStart(t: TokenType): boolean {
    return ['IDENTIFIER', 'STRING', 'NUMBER', 'BOOLEAN', 'LPAREN', 'NOT', 'MINUS'].includes(t);
  }

  private parseExpression(): ExpressionNode | LiteralNode | IdentifierNode {
    let left = this.parsePrimary();

    while (this.isComparisonOp(this.peek().type)) {
      const opToken = this.advance();
      const operator = WORD_OP_MAP[opToken.type] ?? opToken.value;
      if (operator === 'exists' || operator === 'not_exists') {
        left = { kind: 'expr', operator, left, right: { kind: 'literal', type: 'null', value: null } };
        continue;
      }
      const right = this.parsePrimary();
      left = { kind: 'expr', operator, left, right };
    }
    return left;
  }

  private parsePrimary(): ExpressionNode | LiteralNode | IdentifierNode {
    const token = this.peek();
    if (token.type === 'NOT') {
      this.advance('NOT');
      const operand = this.parsePrimary();
      return { kind: 'expr', operator: 'not', left: operand, right: { kind: 'literal', type: 'null', value: null } };
    }
    if (token.type === 'STRING') {
      this.advance('STRING');
      return { kind: 'literal', type: 'string', value: token.value };
    }
    if (token.type === 'NUMBER') {
      this.advance('NUMBER');
      const num = token.value.includes('.') ? parseFloat(token.value) : parseInt(token.value, 10);
      return { kind: 'literal', type: 'number', value: num };
    }
    if (token.type === 'BOOLEAN') {
      this.advance('BOOLEAN');
      return { kind: 'literal', type: 'boolean', value: token.value.toLowerCase() === 'true' };
    }
    if (token.type === 'IDENTIFIER') {
      return this.parseIdentifier();
    }
    if (token.type === 'LPAREN') {
      this.advance('LPAREN');
      const expr = this.parseExpression();
      this.advance('RPAREN');
      return expr;
    }
    if (token.type === 'MINUS') {
      this.advance('MINUS');
      const operand = this.parsePrimary();
      if (operand.kind === 'literal' && operand.type === 'number') {
        operand.value = -(operand.value as number);
      }
      return operand;
    }
    throw new ParserError(token, `Unexpected token: ${token.value}`);
  }

  private parseIdentifier(): IdentifierNode {
    const name = this.advance('IDENTIFIER').value;
    const path: string[] = [];
    while (this.peek().type === 'DOT') {
      this.advance('DOT');
      path.push(this.advance('IDENTIFIER').value);
    }
    return { kind: 'identifier', name, path: path.length > 0 ? path : undefined };
  }

  private parseActionBlock(): ActionBlock {
    this.advance('DO');
    const items: ActionItem[] = [];
    items.push(this.parseActionItem());
    while (this.peek().type === 'NEWLINE' || this.peek().type === 'PIPE') {
      if (this.peek().type === 'NEWLINE') {
        this.advance('NEWLINE');
        continue;
      }
      this.advance('PIPE');
      items.push(this.parseActionItem());
    }
    return { kind: 'actions', items };
  }

  private parseActionItem(): ActionItem {
    const name = this.advance('IDENTIFIER').value;
    const params: Record<string, ExpressionNode> = {};

    if (this.peek().type === 'COLON') {
      this.advance('COLON');
      while (this.peek().type !== 'NEWLINE' && this.peek().type !== 'PIPE' && this.peek().type !== 'EOF' && this.peek().type !== 'RBRACE') {
        const key = this.advance('IDENTIFIER').value;
        const eqToken = this.peek();
        if (eqToken.type === 'EQ' || eqToken.type === 'COLON') {
          this.advance();
          params[key] = this.parseExpression();
        }
        if (this.peek().type === 'COMMA') this.advance('COMMA');
      }
    }

    let fallback: ActionItem[] | undefined;
    if (this.peek().type === 'ELSE') {
      this.advance('ELSE');
      fallback = [this.parseActionItem()];
    }

    return { kind: 'action', name, params, fallback };
  }

  private tryParseBindings(): BindingDeclaration[] | undefined {
    const bindings: BindingDeclaration[] = [];
    while (this.peek().type === 'LET') {
      this.advance('LET');
      const name = this.advance('IDENTIFIER').value;
      this.advance('EQ');
      const source = this.advance('IDENTIFIER').value;
      let transform: string | undefined;
      if (this.peek().type === 'AS') { this.advance('AS'); transform = this.advance('IDENTIFIER').value; }
      bindings.push({ kind: 'binding', name, source, transform });
    }
    return bindings.length > 0 ? bindings : undefined;
  }

  private isComparisonOp(t: TokenType): boolean {
    return ['EQ', 'NEQ', 'GT', 'GTE', 'LT', 'LTE', 'EQW', 'NEQW', 'GTW', 'GTEW', 'LTW', 'LTEW', 'CONTAINS', 'MATCHES', 'EXISTS', 'NOT_EXISTS'].includes(t);
  }

  private peek(): Token { return this.tokens[this.pos]; }

  private advance(expected?: TokenType): Token {
    if (expected && this.peek().type !== expected) {
      throw new ParserError(this.peek(), `Expected ${expected} but got ${this.peek().type} ('${this.peek().value}')`);
    }
    const token = this.tokens[this.pos];
    if (this.peek().type !== 'EOF') this.pos++;
    while (this.peek().type === 'NEWLINE') this.pos++;
    return token;
  }
}

export function parse(tokens: Token[]): ASTNode[] {
  return new Parser(tokens).parse();
}
