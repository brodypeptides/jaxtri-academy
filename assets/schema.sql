-- Jaxtri Platform Cloudflare D1 schema draft
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  role TEXT NOT NULL CHECK(role IN ('owner','manager','affiliate')) DEFAULT 'affiliate',
  status TEXT NOT NULL CHECK(status IN ('pending','approved','suspended')) DEFAULT 'pending',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  discord_username TEXT,
  platforms TEXT,
  audience_size TEXT,
  reason TEXT,
  status TEXT NOT NULL CHECK(status IN ('new','reviewing','approved','rejected','archived')) DEFAULT 'new',
  reviewer_id TEXT,
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS content_items (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL,
  reviewer_id TEXT,
  type TEXT NOT NULL CHECK(type IN ('feed_post','hook','script','video_idea','caption','broll','resource','training','announcement','challenge')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT,
  tags TEXT,
  visibility TEXT NOT NULL CHECK(visibility IN ('private','academy','public')) DEFAULT 'academy',
  review_status TEXT NOT NULL CHECK(review_status IN ('draft','pending_review','approved','rejected','archived')) DEFAULT 'draft',
  review_notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  published_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
