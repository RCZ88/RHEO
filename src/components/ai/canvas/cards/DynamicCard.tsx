import type { CanvasCard as CanvasCardType } from '../../../types/canvas'
import type { DynamicUIComponent } from '../../../types/dynamicUI'
import { DynamicCardRenderer } from './DynamicCardRenderer'
import { StateView } from '../shared/StateView'
import { Blocks } from 'lucide-react'

interface DynamicCardProps {
  card: CanvasCardType
  onDismiss?: (id: string) => void
  onAction?: (id: string, actionId: string) => void
}

export function DynamicCard({ card, onDismiss, onAction }: DynamicCardProps) {
  const comp: DynamicUIComponent | undefined = card.data?.dynamicComponent
  if (!comp) {
    return (
      <StateView
        state="empty"
        emptyProps={{
          icon: Blocks,
          title: 'Empty component',
          description: 'Ask the AI to generate an interactive component to fill this card.',
        }}
      >
        {null}
      </StateView>
    )
  }

  return (
    <DynamicCardRenderer
      component={comp}
      onDismiss={onDismiss}
      onAction={onAction}
    />
  )
}
