import { Bell, Target, Calendar, Clock, Mail, FileText, CheckCircle } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { ActionParam } from '../../../types/automation'

export interface ActionDef {
  id: string              // "notify", "goal:create", etc.
  label: string
  description: string
  icon: ComponentType<{ size?: number | string; style?: CSSProperties }>
  params: ActionParam[]
}

export const ACTIONS: ActionDef[] = [
  {
    id: 'notify',
    label: 'Send Notification',
    description: 'Show a desktop notification with a message',
    icon: Bell,
    params: [
      { name: 'message', type: 'string', label: 'Message', required: true, placeholder: 'Large transaction detected' },
    ],
  },
  {
    id: 'goal:create',
    label: 'Create Goal',
    description: 'Add a new goal to your goal list',
    icon: Target,
    params: [
      { name: 'title', type: 'string', label: 'Goal Title', required: true, placeholder: 'Review quarterly budget' },
      { name: 'category', type: 'select', label: 'Category', required: false, options: ['general', 'work', 'personal', 'health', 'finance'] },
    ],
  },
  {
    id: 'goal:complete',
    label: 'Complete Goal',
    description: 'Mark an existing goal as done',
    icon: CheckCircle,
    params: [
      { name: 'title', type: 'string', label: 'Goal Title', required: true, placeholder: 'Goal to mark complete' },
    ],
  },
  {
    id: 'schedule:add',
    label: 'Add to Schedule',
    description: 'Add an entry to your daily schedule',
    icon: Calendar,
    params: [
      { name: 'title', type: 'string', label: 'Title', required: true, placeholder: 'Review transaction' },
      { name: 'day', type: 'number', label: 'Day of Week (0=Sun)', required: true, placeholder: '1' },
      { name: 'start', type: 'string', label: 'Start Time', required: true, placeholder: '09:00' },
      { name: 'end', type: 'string', label: 'End Time', required: true, placeholder: '10:00' },
    ],
  },
  {
    id: 'deadline:add',
    label: 'Create Deadline',
    description: 'Create a new deadline with priority',
    icon: Clock,
    params: [
      { name: 'title', type: 'string', label: 'Title', required: true, placeholder: 'Pay invoice' },
      { name: 'dueDate', type: 'date', label: 'Due Date', required: true },
      { name: 'priority', type: 'select', label: 'Priority', required: false, options: ['low', 'medium', 'high', 'critical'] },
    ],
  },
  {
    id: 'email:send',
    label: 'Send Email',
    description: 'Send an email via configured connector',
    icon: Mail,
    params: [
      { name: 'to', type: 'string', label: 'To', required: true, placeholder: 'user@example.com' },
      { name: 'subject', type: 'string', label: 'Subject', required: true, placeholder: 'Automated alert' },
      { name: 'body', type: 'string', label: 'Body', required: true, placeholder: 'Email content...' },
    ],
  },
  {
    id: 'calendar:create',
    label: 'Create Calendar Event',
    description: 'Add an event to your connected calendar',
    icon: Calendar,
    params: [
      { name: 'title', type: 'string', label: 'Event Title', required: true, placeholder: 'Follow-up meeting' },
      { name: 'start', type: 'date', label: 'Start', required: true },
      { name: 'end', type: 'date', label: 'End', required: true },
    ],
  },
  {
    id: 'log',
    label: 'Write to Log',
    description: 'Append a message to the activity log',
    icon: FileText,
    params: [
      { name: 'message', type: 'string', label: 'Message', required: true, placeholder: 'Automation fired' },
      { name: 'level', type: 'select', label: 'Level', required: false, options: ['info', 'warn', 'error'] },
    ],
  },
]

export function getActionById(id: string): ActionDef | undefined {
  return ACTIONS.find(a => a.id === id)
}