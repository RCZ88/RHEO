import * as React from "react";
import { Calendar } from 'lucide-react'

interface ScheduleBlockProps {
  title: string
  startTime: string
  endTime: string
  color?: string
  top: number
  height: number
}

export function ScheduleBlock({ title, startTime, endTime, color = '#22d3ee', top, height }: ScheduleBlockProps) {
  return (
    <div className="dk-schedule-block" style={{ top, height: Math.max(height, 24), '--block-color': color } as React.CSSProperties}>
      <div className="dk-schedule-block-content">
        <span className="dk-schedule-block-title">{title}</span>
        <span className="dk-schedule-block-time"><Calendar size={9} />{startTime}–{endTime}</span>
      </div>
    </div>
  )
}
