export interface CompositionManifest {
  id: string;
  name: string;
  description?: string;
  version: number;
  enabled: boolean;
  priority: number;
  category: string;
  tags: string[];
  lifecycle: 'forever' | 'once' | 'schedule' | 'manual';
  schedule?: string;
  conditions?: ComposedCondition;
  actions: ComposedAction[];
  metadata?: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

export interface ComposedCondition {
  operator: 'and' | 'or' | 'not';
  conditions: (ComposedCondition | AtomicCondition)[];
}

export interface AtomicCondition {
  type: string;
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'matches' | 'exists' | 'not_exists';
  value: any;
}

export interface ComposedAction {
  id: string;
  action: string;
  params: Record<string, any>;
  fallback?: ComposedAction[];
  errorHandling?: 'abort' | 'continue' | 'fallback';
}

export type TokenType =
  | 'WHEN' | 'IF' | 'THEN' | 'ELSE' | 'AND' | 'OR' | 'NOT'
  | 'ON' | 'EVERY' | 'DO' | 'LET' | 'AS'
  | 'IDENTIFIER' | 'STRING' | 'NUMBER' | 'BOOLEAN'
  | 'DOT' | 'COMMA' | 'COLON' | 'ARROW' | 'PIPE'
  | 'LPAREN' | 'RPAREN' | 'LBRACE' | 'RBRACE' | 'LBRACKET' | 'RBRACKET'
  | 'EQ' | 'NEQ' | 'GT' | 'GTE' | 'LT' | 'LTE'
  | 'EQW' | 'NEQW' | 'GTW' | 'GTEW' | 'LTW' | 'LTEW'
  | 'CONTAINS' | 'MATCHES' | 'EXISTS' | 'NOT_EXISTS'
  | 'PLUS' | 'MINUS' | 'STAR' | 'SLASH'
  | 'NEWLINE' | 'EOF' | 'ERROR';

export interface Token {
  type: TokenType;
  value: string;
  line: number;
  col: number;
}

export type ASTNode =
  | CompositionRule
  | ConditionClause
  | ActionBlock
  | EventPattern
  | SchedulePattern
  | BindingDeclaration
  | ExpressionNode
  | LiteralNode
  | IdentifierNode;

export interface CompositionRule {
  kind: 'rule';
  trigger?: EventPattern;
  schedule?: SchedulePattern;
  conditions: ConditionClause;
  actions: ActionBlock;
  bindings?: BindingDeclaration[];
}

export interface EventPattern {
  kind: 'event';
  source: string;
  eventName: string;
  filters?: ConditionClause;
}

export interface SchedulePattern {
  kind: 'schedule';
  cron: string;
  timezone?: string;
}

export interface ConditionClause {
  kind: 'condition';
  operator: 'and' | 'or' | 'not';
  operands: (ConditionClause | ExpressionNode)[];
}

export interface ActionBlock {
  kind: 'actions';
  items: ActionItem[];
}

export interface ActionItem {
  kind: 'action';
  name: string;
  params: Record<string, ExpressionNode>;
  fallback?: ActionItem[];
}

export interface BindingDeclaration {
  kind: 'binding';
  name: string;
  source: string;
  transform?: string;
}

export interface ExpressionNode {
  kind: 'expr';
  operator: string;
  left: ExpressionNode | LiteralNode | IdentifierNode;
  right: ExpressionNode | LiteralNode | IdentifierNode;
}

export interface LiteralNode {
  kind: 'literal';
  type: 'string' | 'number' | 'boolean' | 'null';
  value: any;
}

export interface IdentifierNode {
  kind: 'identifier';
  name: string;
  path?: string[];
}

export interface EventBusEvent {
  topic: string;
  source: string;
  payload: any;
  timestamp: string;
  dedupeKey?: string;
  ttlMs?: number;
}

export interface SafeQuery {
  table: string;
  columns: string[];
  where?: Record<string, any>;
  orderBy?: { column: string; dir: 'ASC' | 'DESC' };
  limit?: number;
}

export interface ScopeReport {
  manifestId: string;
  valid: boolean;
  errors: ScopeError[];
  warnings: ScopeWarning[];
  suggestedFix?: string;
}

export interface ScopeError {
  line: number;
  col: number;
  message: string;
  code: string;
}

export interface ScopeWarning {
  line: number;
  col: number;
  message: string;
}

export interface ExecutionResult {
  ruleId: string;
  actionId: string;
  action: string;
  status: 'pending' | 'running' | 'success' | 'failure' | 'skipped' | 'error';
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  result?: any;
  error?: string;
}

export type DataSourceName = 'finance' | 'focus' | 'goals' | 'learning' | 'ide' | 'system';

export interface DataAdapter {
  name: DataSourceName;
  safeQuery: (query: SafeQuery) => any[];
  listEvents: () => string[];
  subscribe: (topic: string, handler: (event: EventBusEvent) => void) => () => void;
}
