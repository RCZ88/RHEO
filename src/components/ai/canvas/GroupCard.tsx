import { useState, useRef, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Edit3, Palette, Ungroup, Layers } from 'lucide-react'
import { GROUP_COLORS, type CanvasCard, type CanvasGroup } from '../../../types/canvas'

const CELL = 40

interface GroupCardProps {
  group: CanvasGroup
  cards: CanvasCard[]
  renderChild: (card: CanvasCard) => ReactNode
  onUpdateGroup: (patch: Partial<Pick<CanvasGroup, 'label' | 'colorId'>>) => void
  onUngroup: (mode: 'restore' | 'scatter') => void
  onRemoveFromGroup: (cardId: string, newPosition?: { x: number; y: number }) => void
}

export function GroupCard({ group, cards, renderChild, onUpdateGroup, onUngroup, onRemoveFromGroup }: GroupCardProps) {
  const [expanded, setExpanded] = useState(true)
  const [editing, setEditing] = useState(false)
  const [editLabel, setEditLabel] = useState(group.label)
  const [showColorPicker, setShowColorPicker] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const colorRef = useRef<HTMLDivElement>(null)

  const color = GROUP_COLORS.find(c => c.id === group.colorId) || GROUP_COLORS[0]

  // Children are placed at their real canvas positions (relative to the group
  // container) with their real sizes — grouping only wraps them in a box.
  const { placed, contentW, contentH } = useMemo(() => {
    const baseX = group.position?.x || 0
    const baseY = group.position?.y || 0
    const placed = cards.map(card => {
      const left = Math.max(0, (card.position?.x || 0) - baseX - 10)
      const top = Math.max(0, (card.position?.y || 0) - baseY - 30)
      return { card, left, top, right: left + card.size.w * CELL, bottom: top + card.size.h * CELL }
    })
    let w = 0
    let h = 0
    for (const p of placed) {
      w = Math.max(w, p.right)
      h = Math.max(h, p.bottom)
    }
    return { placed, contentW: w, contentH: cards.length === 0 ? 64 : h }
  }, [cards, group.position])

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) {
        setShowColorPicker(false)
      }
    }
    if (showColorPicker) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showColorPicker])

  const handleRename = useCallback(() => {
    if (editLabel.trim() && editLabel.trim() !== group.label) {
      onUpdateGroup({ label: editLabel.trim() })
    }
    setEditing(false)
  }, [editLabel, group.label, onUpdateGroup])

  return (
    <div
      className="group-card"
      style={{
        '--group-accent': color.accent,
        '--group-bg': color.bg,
        '--group-border': color.border,
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="group-card-header">
        <button className="group-expand-btn" onClick={() => setExpanded(v => !v)}>
          <motion.div
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
          >
            <ChevronDown size={14} style={{ color: color.accent }} />
          </motion.div>
        </button>

        <div className="group-color-dot" style={{ background: color.accent }} />

        {editing ? (
          <input
            ref={inputRef}
            value={editLabel}
            onChange={e => setEditLabel(e.target.value)}
            onBlur={handleRename}
            onKeyDown={e => {
              if (e.key === 'Enter') handleRename()
              if (e.key === 'Escape') { setEditing(false); setEditLabel(group.label) }
            }}
            className="group-name-input"
            style={{ color: color.accent }}
          />
        ) : (
          <span
            className="group-name"
            style={{ color: color.accent }}
            onDoubleClick={() => { setEditing(true); setEditLabel(group.label) }}
          >
            {group.label}
          </span>
        )}

        <span className="group-count">{cards.length}</span>

        <div className="group-actions">
          <button
            onClick={() => { setEditing(true); setEditLabel(group.label) }}
            title="Rename"
            className="group-action-btn"
          >
            <Edit3 size={12} />
          </button>

          <div ref={colorRef} className="group-color-wrapper">
            <button
              onClick={() => setShowColorPicker(v => !v)}
              title="Change color"
              className="group-action-btn"
            >
              <Palette size={12} />
            </button>

            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="group-color-picker"
                >
                  {GROUP_COLORS.map(c => (
                    <button
                      key={c.id}
                      className={`group-color-swatch ${c.id === group.colorId ? 'active' : ''}`}
                      style={{ background: c.accent }}
                      onClick={() => { onUpdateGroup({ colorId: c.id }); setShowColorPicker(false) }}
                      title={c.label}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <button
            onClick={() => onUngroup(cards.length > 5 ? 'scatter' : 'restore')}
            title="Ungroup cards"
            className="group-action-btn group-action-danger"
          >
            <Ungroup size={12} />
          </button>
        </div>
      </div>

      {/* Body — real cards at their real positions, just wrapped */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: contentH, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="group-body-wrapper"
          >
            <div
              className="group-cards"
              style={{
                position: 'relative',
                display: 'block',
                width: contentW,
                height: contentH,
                padding: 0,
                maxHeight: 'none',
                overflow: 'visible',
              } as React.CSSProperties}
            >
              {cards.length === 0 ? (
                <div className="group-empty">
                  <Layers size={16} className="group-empty-icon" />
                  <span>No cards yet</span>
                </div>
              ) : (
                placed.map(({ card, left, top }) => (
                  <div
                    key={card.id}
                    className="group-real-card dk-canvas-card"
                    style={{
                      left, top, width: card.size.w * CELL, height: card.size.h * CELL,
                      position: 'absolute', zIndex: 0, cursor: 'default',
                      // Override hover transform (group cards shouldn't lift)
                      transform: 'none',
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="dk-canvas-card-header" style={{ cursor: 'default' }}>
                      <span className="dk-canvas-card-type">{card.type}</span>
                      <div className="dk-canvas-card-actions">
                        <button
                          className="dk-canvas-dismiss"
                          onClick={(e) => { e.stopPropagation(); onRemoveFromGroup(card.id) }}
                          title="Remove from group"
                        >✕</button>
                      </div>
                    </div>
                    <div className="dk-canvas-card-body" style={{ overflow: 'hidden' }}>
                      {renderChild(card)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
