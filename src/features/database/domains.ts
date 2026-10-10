import type { ErdDomain } from './ErdCanvas';

/**
 * Domain groupings for the schema views.
 *
 * Shared by DatabasePage and SettingsPage so the architecture view and the ERD
 * can never drift into classifying the same table differently.
 */
export const ARCH_GROUPS: ErdDomain[] = [
  { id:'core',     label:'Core Tracking',     color:'#10b981', tables:['logs','sessions','daily_stats','browser_sessions','productivity_sessions'] },
  { id:'stats',    label:'Aggregated Stats',  color:'#06b6d4', tables:['stats_hourly','stats_daily','daily_rollup','app_totals'] },
  { id:'ide',      label:'IDE / Projects',    color:'#8b5cf6', tables:['projects','ides','extensions','tools','code_activity','commits','ai_attribution','dora_metrics'] },
  { id:'ai',       label:'AI Usage & Chat',   color:'#d946ef', tables:['ai_usage','ai_chat_messages','ai_chat_threads','ai_context_captures'] },
  { id:'context',  label:'Context Brain',     color:'#f59e0b', tables:['context_entities','context_facts','context_episodes','user_context_profile','agent_memories'] },
  { id:'workspace',label:'Terminal',          color:'#6366f1', tables:['terminal_sessions','terminal_messages','workspace_state','workspace_problems','workspace_requests'] },
  { id:'finance',  label:'Finance',           color:'#84cc16', tables:['finance_accounts','finance_wallets','finance_transactions','finance_categories','finance_subscriptions'] },
  { id:'learn',    label:'Learn (Lyceum)',    color:'#f97316', tables:['learn_lessons','learn_nodes','learn_progress','learn_cards','learn_streaks'] },
  { id:'content',  label:'Content Engine',    color:'#f43f5e', tables:['content_ideas','content_episodes','themes','content_lessons','content_videos'] },
  { id:'focus',    label:'Focus',             color:'#14b8a6', tables:['deep_focus_sessions','focus_groups','focus_group_usage'] },
  { id:'external', label:'External',          color:'#0ea5e9', tables:['external_activities','external_sessions','schedule_entries','deadlines'] },
  { id:'conductor',label:'Conductor',         color:'#eab308', tables:['conductor_missions','conductor_nodes','conductor_messages'] },
];