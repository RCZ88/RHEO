export type ExternalActivity = {
  id: number;
  name: string;
  type: 'stopwatch' | 'sleep' | 'checkin';
  color: string;
  icon: string;
  default_duration: number;
  is_default: number;
  is_visible: number;
  sort_order: number;
};

export type ExternalSession = {
  id: string;
  activity_id: string;
  activity_name: string;
  color?: string;
  started_at: string;
  ended_at: string;
  duration_seconds: number;
};

export type ExternalStats = {
  byActivity: Record<
    string,
    {
      total_seconds: number;
      session_count: number;
    }
  >;
  total_seconds?: number;
};

export type SelectedPeriod =
  | "today"
  | "week"
  | "7day"
  | "month"
  | "30day"
  | "all";
