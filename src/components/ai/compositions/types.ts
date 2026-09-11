export interface CompositionRule {
  id: string; name: string; description: string | null; dsl_source: string;
  version: number; enabled: number; priority: number; category: string;
  lifecycle: string; schedule_cron: string | null; created_at: string; updated_at: string;
}

export interface ExecutionStatus {
  rule_id: string; last_status: string; last_error: string | null;
  consecutive_failures: number; last_run_at: string | null;
}

export interface ExecutionLog {
  id: number; rule_id: string; action_name: string; status: string;
  result: string | null; error: string | null; duration_ms: number | null;
  started_at: string; completed_at: string | null;
}
