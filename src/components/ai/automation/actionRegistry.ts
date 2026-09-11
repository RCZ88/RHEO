export interface ActionParamDef {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean'
  placeholder?: string
  options?: string[]
}

export interface ActionDef {
  id: string
  label: string
  description: string
  params: ActionParamDef[]
}

export const ACTION_DEFS: ActionDef[] = [
  {
    id: 'notify', label: 'Notify', description: 'Send a desktop notification',
    params: [
      { key: 'message', label: 'Message', type: 'string', placeholder: 'Alert text' },
      { key: 'title', label: 'Title', type: 'string', placeholder: 'Alert' },
      { key: 'level', label: 'Level', type: 'string', options: ['info', 'warning', 'error'] },
      { key: 'channel', label: 'Channel', type: 'string', placeholder: 'default' },
    ],
  },
  {
    id: 'log', label: 'Log', description: 'Write a log entry',
    params: [
      { key: 'message', label: 'Message', type: 'string', placeholder: 'Log text' },
      { key: 'level', label: 'Level', type: 'string', options: ['info', 'warn', 'error'] },
      { key: 'data', label: 'Data', type: 'string', placeholder: 'extra data' },
    ],
  },
  {
    id: 'query', label: 'Query', description: 'Query a data source',
    params: [
      { key: 'table', label: 'Table', type: 'string', placeholder: 'finance_transactions' },
      { key: 'columns', label: 'Columns', type: 'string', placeholder: 'amount, category' },
      { key: 'where', label: 'Where', type: 'string', placeholder: 'amount > 100' },
      { key: 'limit', label: 'Limit', type: 'number', placeholder: '50' },
    ],
  },
  {
    id: 'http', label: 'HTTP request', description: 'Call a webhook or API',
    params: [
      { key: 'url', label: 'URL', type: 'string', placeholder: 'https://…' },
      { key: 'method', label: 'Method', type: 'string', options: ['GET', 'POST', 'PUT', 'DELETE'] },
      { key: 'body', label: 'Body', type: 'string', placeholder: 'JSON payload' },
    ],
  },
  {
    id: 'sleep', label: 'Sleep', description: 'Pause before the next action',
    params: [
      { key: 'ms', label: 'Milliseconds', type: 'number', placeholder: '500' },
    ],
  },
  {
    id: 'exec', label: 'Exec', description: 'Run a shell command',
    params: [
      { key: 'command', label: 'Command', type: 'string', placeholder: 'echo hi' },
      { key: 'timeout', label: 'Timeout (ms)', type: 'number', placeholder: '10000' },
    ],
  },
  {
    id: 'trigger', label: 'Trigger', description: 'Emit another event',
    params: [
      { key: 'event', label: 'Event', type: 'string', placeholder: 'system.app.launched' },
      { key: 'source', label: 'Source', type: 'string', placeholder: 'system' },
    ],
  },
  {
    id: 'transform', label: 'Transform', description: 'Transform data',
    params: [
      { key: 'expression', label: 'Expression', type: 'string', placeholder: 'amount * 2' },
      { key: 'as', label: 'Alias', type: 'string', placeholder: 'result' },
    ],
  },
]

export function actionDef(name: string): ActionDef | undefined {
  return ACTION_DEFS.find(a => a.id === name)
}
