import { BookOpen, Code, Monitor, DollarSign, Clock, Target } from 'lucide-react'
import type { ComponentType, CSSProperties } from 'react'
import type { TriggerField } from '../../../types/automation'
import type { DataSourceName } from '../../../domains/compositions/compositionTypes'

export interface TriggerDef {
  id: string                    // "finance.transaction.created"
  source: DataSourceName
  event: string
  label: string
  description: string
  icon: ComponentType<{ size?: number | string; style?: CSSProperties }>
  fields: TriggerField[]
}

export const SOURCE_META: Record<DataSourceName, { color: string; accentKey: string; label: string }> = {
  finance: { color: '#f59e0b', accentKey: 'amber',   label: 'Finance' },
  focus:   { color: '#10b981', accentKey: 'emerald', label: 'Focus' },
  goals:   { color: '#8b5cf6', accentKey: 'violet',  label: 'Goals' },
  learning:{ color: '#22d3ee', accentKey: 'cyan',    label: 'Learning' },
  ide:     { color: '#f472b6', accentKey: 'pink',    label: 'IDE' },
  system:  { color: '#64748b', accentKey: 'slate',   label: 'System' },
}

export const TRIGGERS: TriggerDef[] = [
  // ─── Finance ────────────────────────────────────────────
  {
    id: 'finance.transaction.created',
    source: 'finance', event: 'transaction.created',
    label: 'Transaction Created',
    description: 'Fires when a new financial transaction is recorded',
    icon: DollarSign,
    fields: [
      { name: 'amount', type: 'number', label: 'Amount' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'description', type: 'string', label: 'Description' },
      { name: 'wallet', type: 'string', label: 'Wallet' },
    ],
  },
  {
    id: 'finance.transaction.updated',
    source: 'finance', event: 'transaction.updated',
    label: 'Transaction Updated',
    description: 'Fires when an existing transaction is modified',
    icon: DollarSign,
    fields: [
      { name: 'amount', type: 'number', label: 'Amount' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'description', type: 'string', label: 'Description' },
    ],
  },
  {
    id: 'finance.account.created',
    source: 'finance', event: 'account.created',
    label: 'Account Created',
    description: 'Fires when a new financial account is added',
    icon: DollarSign,
    fields: [
      { name: 'name', type: 'string', label: 'Account Name' },
      { name: 'type', type: 'string', label: 'Account Type' },
      { name: 'balance', type: 'number', label: 'Balance' },
    ],
  },

  // ─── Focus ──────────────────────────────────────────────
  {
    id: 'focus.session.started',
    source: 'focus', event: 'session.started',
    label: 'Focus Session Started',
    description: 'Fires when a tracked focus session begins',
    icon: Clock,
    fields: [
      { name: 'app', type: 'string', label: 'Application' },
      { name: 'category', type: 'string', label: 'Category' },
    ],
  },
  {
    id: 'focus.session.ended',
    source: 'focus', event: 'session.ended',
    label: 'Focus Session Ended',
    description: 'Fires when a tracked focus session completes',
    icon: Clock,
    fields: [
      { name: 'app', type: 'string', label: 'Application' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'duration', type: 'number', label: 'Duration (min)' },
      { name: 'productive', type: 'boolean', label: 'Productive' },
    ],
  },
  {
    id: 'focus.session.paused',
    source: 'focus', event: 'session.paused',
    label: 'Focus Session Paused',
    description: 'Fires when a focus session is paused',
    icon: Clock,
    fields: [
      { name: 'app', type: 'string', label: 'Application' },
      { name: 'duration', type: 'number', label: 'Duration (min)' },
    ],
  },

  // ─── Goals ──────────────────────────────────────────────
  {
    id: 'goals.goal.created',
    source: 'goals', event: 'goal.created',
    label: 'Goal Created',
    description: 'Fires when a new goal is added',
    icon: Target,
    fields: [
      { name: 'title', type: 'string', label: 'Goal Title' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'period', type: 'string', label: 'Period' },
    ],
  },
  {
    id: 'goals.goal.completed',
    source: 'goals', event: 'goal.completed',
    label: 'Goal Completed',
    description: 'Fires when a goal is marked as done',
    icon: Target,
    fields: [
      { name: 'title', type: 'string', label: 'Goal Title' },
      { name: 'category', type: 'string', label: 'Category' },
      { name: 'completedAt', type: 'date', label: 'Completed At' },
    ],
  },
  {
    id: 'goals.goal.deleted',
    source: 'goals', event: 'goal.deleted',
    label: 'Goal Deleted',
    description: 'Fires when a goal is removed',
    icon: Target,
    fields: [
      { name: 'title', type: 'string', label: 'Goal Title' },
      { name: 'category', type: 'string', label: 'Category' },
    ],
  },

  // ─── Learning ───────────────────────────────────────────
  {
    id: 'learning.lesson.completed',
    source: 'learning', event: 'lesson.completed',
    label: 'Lesson Completed',
    description: 'Fires when a learning lesson is finished',
    icon: BookOpen,
    fields: [
      { name: 'title', type: 'string', label: 'Lesson Title' },
      { name: 'score', type: 'number', label: 'Score' },
    ],
  },
  {
    id: 'learning.quiz.passed',
    source: 'learning', event: 'quiz.passed',
    label: 'Quiz Passed',
    description: 'Fires when a quiz is passed',
    icon: BookOpen,
    fields: [
      { name: 'title', type: 'string', label: 'Quiz Title' },
      { name: 'score', type: 'number', label: 'Score' },
      { name: 'passingScore', type: 'number', label: 'Passing Score' },
    ],
  },

  // ─── IDE ────────────────────────────────────────────────
  {
    id: 'ide.project.opened',
    source: 'ide', event: 'project.opened',
    label: 'Project Opened',
    description: 'Fires when a project is opened in the IDE',
    icon: Code,
    fields: [
      { name: 'name', type: 'string', label: 'Project Name' },
      { name: 'language', type: 'string', label: 'Language' },
    ],
  },
  {
    id: 'ide.commit.made',
    source: 'ide', event: 'commit.made',
    label: 'Commit Made',
    description: 'Fires when a git commit is created',
    icon: Code,
    fields: [
      { name: 'message', type: 'string', label: 'Commit Message' },
      { name: 'filesChanged', type: 'number', label: 'Files Changed' },
    ],
  },

  // ─── System ─────────────────────────────────────────────
  {
    id: 'system.app.started',
    source: 'system', event: 'app.started',
    label: 'App Started',
    description: 'Fires when the application launches',
    icon: Monitor,
    fields: [
      { name: 'version', type: 'string', label: 'Version' },
    ],
  },
  {
    id: 'system.app.idle',
    source: 'system', event: 'app.idle',
    label: 'App Idle',
    description: 'Fires after the app detects user inactivity',
    icon: Monitor,
    fields: [
      { name: 'idleDuration', type: 'number', label: 'Idle Duration (min)' },
    ],
  },
  {
    id: 'system.app.resumed',
    source: 'system', event: 'app.resumed',
    label: 'App Resumed',
    description: 'Fires when the app resumes from suspend',
    icon: Monitor,
    fields: [
      { name: 'suspendDuration', type: 'number', label: 'Suspend Duration (min)' },
    ],
  },
]

export function getTriggerById(id: string): TriggerDef | undefined {
  return TRIGGERS.find(t => t.id === id)
}

export function getTriggersBySource(source: DataSourceName): TriggerDef[] {
  return TRIGGERS.filter(t => t.source === source)
}