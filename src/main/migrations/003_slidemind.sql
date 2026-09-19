-- SlideMind (Lecture) module tables — migrated from lecturer-feature Supabase schema.
CREATE TABLE IF NOT EXISTS sm_decks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  filename TEXT DEFAULT '',
  slide_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ready',
  total_tokens INTEGER NOT NULL DEFAULT 0,
  language TEXT NOT NULL DEFAULT 'en',
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sm_slides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  deck_id INTEGER NOT NULL,
  slide_number INTEGER NOT NULL DEFAULT 1,
  title TEXT DEFAULT '',
  text_content TEXT DEFAULT '',
  shapes_json TEXT DEFAULT '[]',
  notes TEXT DEFAULT '',
  token_estimate INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sm_slide_elements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slide_id INTEGER NOT NULL,
  element_type TEXT NOT NULL DEFAULT 'text',
  content TEXT DEFAULT '',
  position_json TEXT DEFAULT '{}',
  token_estimate INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sm_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT DEFAULT '',
  ocr_text TEXT DEFAULT '',
  caption TEXT DEFAULT '',
  region_json TEXT,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  image_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sm_transcripts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'mic',
  language TEXT NOT NULL DEFAULT 'auto',
  detected_language TEXT NOT NULL DEFAULT 'en',
  content TEXT DEFAULT '',
  duration_sec INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sm_web_sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'website',
  title TEXT DEFAULT '',
  extracted_text TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  prompt_pack TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'ready',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sm_prompts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  prompt_type TEXT NOT NULL DEFAULT 'slide_qa',
  source_ref TEXT NOT NULL DEFAULT '',
  content TEXT DEFAULT '',
  token_estimate INTEGER NOT NULL DEFAULT 0,
  target_ai TEXT NOT NULL DEFAULT 'chatgpt',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sm_research_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL DEFAULT 'stack',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  tools TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  priority INTEGER NOT NULL DEFAULT 5,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sm_auth_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  service_name TEXT NOT NULL,
  username_label TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'not_connected',
  session_expires TEXT,
  script TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sm_slides_deck ON sm_slides(deck_id);
CREATE INDEX IF NOT EXISTS idx_sm_slide_elements_slide ON sm_slide_elements(slide_id);
CREATE INDEX IF NOT EXISTS idx_sm_images_created ON sm_images(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_transcripts_created ON sm_transcripts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_web_sources_created ON sm_web_sources(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sm_prompts_created ON sm_prompts(created_at DESC);