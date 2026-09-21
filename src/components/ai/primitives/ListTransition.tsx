import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { listItemAddVariants, listItemRemoveVariants } from '../lib/motion'
import { cn } from '../lib/cn'

interface ListTransitionProps<T extends { id: string }> {
  items: T[]
  renderItem: (item: T, index: number) => React.ReactNode
  className?: string
  itemClassName?: string
}

export function ListTransition<T extends { id: string }>({ items, renderItem, className, itemClassName }: ListTransitionProps<T>) {
  const reduce = useReducedMotion()
  return (
    <div className={cn('space-y-2', className)}>
      <AnimatePresence initial={false} mode={reduce ? 'sync' : 'popLayout'}>
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            layout
            variants={{ ...listItemAddVariants, exit: listItemRemoveVariants.exit }}
            initial="hidden"
            animate="show"
            exit="exit"
            className={cn(itemClassName)}
          >
            {renderItem(item, i)}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}
