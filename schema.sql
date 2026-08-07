-- Arlecchino: King of Riddles Database Schema
-- Compatible with PostgreSQL (Neon) and SQLite (Cloudflare D1)

CREATE TABLE IF NOT EXISTS quiz (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  duration_ms   INTEGER NOT NULL,      -- e.g. 420000 for 7 min
  grace_ms      INTEGER NOT NULL DEFAULT 60000,
  opens_at      TIMESTAMPTZ,
  closes_at     TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS question (
  id            TEXT PRIMARY KEY,
  quiz_id       TEXT NOT NULL REFERENCES quiz(id),
  position      INTEGER NOT NULL,
  prompt        TEXT NOT NULL,
  image_url     TEXT,
  options       JSONB NOT NULL,        -- [{key:"a", label:"..."}, ...]
  correct_key   TEXT NOT NULL,         -- NEVER serialized to participants
  points        INTEGER NOT NULL DEFAULT 1,
  UNIQUE (quiz_id, position)
);

CREATE TABLE IF NOT EXISTS participant (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id       TEXT NOT NULL REFERENCES quiz(id),
  display_name  TEXT NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS submission (
  participant_id UUID PRIMARY KEY REFERENCES participant(id),
  answers        JSONB NOT NULL,       -- {"q1":"b","q7":"d",...} sparse
  score          INTEGER NOT NULL,
  correct_count  INTEGER NOT NULL,
  answered_count INTEGER NOT NULL,
  elapsed_ms     INTEGER NOT NULL,
  auto_submitted BOOLEAN NOT NULL DEFAULT false,
  was_late       BOOLEAN NOT NULL DEFAULT false,
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Leaderboard composite index for fast ranking queries
CREATE INDEX IF NOT EXISTS idx_submission_leaderboard ON submission (score DESC, elapsed_ms ASC, submitted_at ASC);
