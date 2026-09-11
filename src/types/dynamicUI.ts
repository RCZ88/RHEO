export type DynamicComponentType = 'card' | 'chart' | 'list' | 'form' | 'stat' | 'table' | 'timeline' | 'custom'
export type ChartVariant = 'bar' | 'line' | 'donut' | 'area'
export type FormFieldType = 'text' | 'number' | 'select' | 'toggle' | 'date'

export interface DynamicUIComponent {
  id: string
  type: DynamicComponentType
  title: string
  subtitle?: string
  accent: 'pink' | 'emerald' | 'amber' | 'violet' | 'red' | 'cyan'
  size: { w: number; h: number }
  position?: { x: number; y: number }
  data: DynamicComponentData
  actions?: DynamicAction[]
  createdAt: number
  source: 'ai-generated'
}

export type DynamicComponentData =
  | CardData | ChartData | ListData | FormData | StatData | TableData | TimelineData

export interface CardData { kind: 'card'; body: string; footer?: string; badge?: { label: string; color: string } }
export interface ChartData { kind: 'chart'; variant: ChartVariant; series: { label: string; values: number[]; color?: string }[]; xLabels?: string[]; unit?: string }
export interface ListData { kind: 'list'; items: { id: string; label: string; meta?: string; done?: boolean; icon?: string }[]; sortable?: boolean }
export interface FormData { kind: 'form'; fields: { name: string; label: string; type: FormFieldType; placeholder?: string; options?: string[]; defaultValue?: any; required?: boolean }[]; submitLabel?: string }
export interface StatData { kind: 'stat'; value: number; format?: 'number' | 'currency' | 'percent' | 'duration'; trend?: { direction: 'up' | 'down' | 'flat'; delta: number }; sparkline?: number[] }
export interface TableData { kind: 'table'; columns: { key: string; label: string; width?: number }[]; rows: Record<string, any>[] }
export interface TimelineData { kind: 'timeline'; events: { id: string; time: string; label: string; status?: 'done' | 'active' | 'pending' }[] }

export interface DynamicAction {
  id: string; label: string; icon?: string; variant: 'primary' | 'secondary' | 'danger'; action: string
}

export interface AiUIGenerationResponse {
  intent: 'generate-ui'
  components: DynamicUIComponent[]
  narration: string
  placement: 'canvas' | 'deck-slot'
  targetSlot?: string
}
