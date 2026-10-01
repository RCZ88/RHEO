import { Component, type ReactNode } from 'react'
import { StatusScreen } from '../../../components/StatusScreen'

interface Props {
  children: ReactNode
}
interface State {
  error: Error | null
}

export class SelfErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error) {
    console.error('[SelfOrchestrator] render error:', error)
  }

  render() {
    if (this.state.error) {
      // Same StatusScreen as the app-wide boundary and the 404 — one style.
      return (
        <div className="rounded-xl border border-white/10 bg-zinc-900/40">
          <StatusScreen
            tone="error"
            eyebrow="Self tab"
            title="This tab stopped responding"
            description="The Self orchestrator hit an error while rendering. Retry re-mounts it; the rest of the app is unaffected."
            detail={this.state.error.message}
            detailLabel="Error message"
            actions={[
              {
                label: 'Retry Self tab',
                onClick: () => this.setState({ error: null }),
                primary: true,
              },
            ]}
            className="min-h-0 px-5 py-6"
          />
        </div>
      )
    }
    return this.props.children
  }
}
