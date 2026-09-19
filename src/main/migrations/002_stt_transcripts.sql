CREATE TABLE IF NOT EXISTS stt_transcripts (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  title TEXT,
  note TEXT,
  prompt TEXT,
  project TEXT,
  created_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'other',
  tags TEXT NOT NULL DEFAULT '[]',
  project_id TEXT,
  project_name TEXT,
  is_favorite INTEGER NOT NULL DEFAULT 0,
  source TEXT
);

CREATE TABLE IF NOT EXISTS stt_vocabulary (
  id TEXT PRIMARY KEY,
  canonical TEXT NOT NULL,
  aliases TEXT NOT NULL DEFAULT '[]',
  priority INTEGER NOT NULL DEFAULT 5
);

CREATE INDEX IF NOT EXISTS idx_stt_transcripts_created ON stt_transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stt_transcripts_category ON stt_transcripts(category);
CREATE INDEX IF NOT EXISTS idx_stt_transcripts_favorite ON stt_transcripts(is_favorite);
