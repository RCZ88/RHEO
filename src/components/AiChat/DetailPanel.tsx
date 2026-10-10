import { type FC, useEffect } from 'react'

type Props = {
  title: string
  detail: string
  onClose: () => void
}

export const DetailPanel: FC<Props> = ({ title, detail, onClose }) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-80 bg-zinc-950 light:bg-[var(--ws-surface)] border-l border-zinc-800 shadow-2xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-4 h-12 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-200 truncate">{title}</h3>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-lg leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <p className="text-sm text-zinc-400 whitespace-pre-wrap">{detail}</p>
        </div>
      </div>
    </>
  )
}
