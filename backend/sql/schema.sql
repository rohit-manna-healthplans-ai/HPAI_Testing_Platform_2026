-- HPAI Assessment Platform schema (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin','proctor','candidate')),
  active boolean NOT NULL DEFAULT true,
  proctor_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_idx ON users (lower(email));
CREATE INDEX IF NOT EXISTS users_proctor_idx ON users (proctor_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

-- Questions and subjects live in CODE (question-bank/ -> backend/src/catalog.generated.js), never in the database.
-- subject_id is the subject slug (dsa, sql, nosql, ui, aiml).
CREATE TABLE IF NOT EXISTS proctor_subjects (
  proctor_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id text NOT NULL,
  PRIMARY KEY (proctor_id, subject_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  proctor_id uuid NOT NULL REFERENCES users(id),
  duration_mins int NOT NULL,
  subject_config jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  opens_at timestamptz NULL,
  closes_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS fixed_question_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
CREATE INDEX IF NOT EXISTS sessions_proctor_idx ON sessions (proctor_id);

CREATE TABLE IF NOT EXISTS session_candidates (
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (session_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS session_candidates_cand_idx ON session_candidates (candidate_id);

CREATE TABLE IF NOT EXISTS attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL REFERENCES users(id),
  proctor_id uuid NOT NULL REFERENCES users(id),
  started_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  submitted_at timestamptz NULL,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','auto_submitted','terminated')),
  question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  max_score numeric NOT NULL DEFAULT 0,
  total_score numeric NOT NULL DEFAULT 0,
  flag_count int NOT NULL DEFAULT 0,
  extra_minutes int NOT NULL DEFAULT 0,
  ip text NULL,
  user_agent text NULL,
  UNIQUE (session_id, candidate_id)
);
CREATE INDEX IF NOT EXISTS attempts_session_idx ON attempts (session_id);
CREATE INDEX IF NOT EXISTS attempts_candidate_idx ON attempts (candidate_id);
CREATE INDEX IF NOT EXISTS attempts_proctor_idx ON attempts (proctor_id);

CREATE TABLE IF NOT EXISTS answers (
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  question_id text NOT NULL, -- question-bank id, e.g. dsa-easy-reverse-words (no FK: questions live in code)
  response jsonb NOT NULL DEFAULT '{}'::jsonb,
  tests_passed numeric NOT NULL DEFAULT 0,
  tests_total numeric NOT NULL DEFAULT 0,
  score numeric NOT NULL DEFAULT 0,
  max_score numeric NOT NULL DEFAULT 0,
  time_spent_sec int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (attempt_id, question_id)
);
CREATE INDEX IF NOT EXISTS answers_attempt_idx ON answers (attempt_id);

CREATE TABLE IF NOT EXISTS proctor_events (
  id bigserial PRIMARY KEY,
  attempt_id uuid NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  type text NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS proctor_events_attempt_idx ON proctor_events (attempt_id);

CREATE TABLE IF NOT EXISTS certificates (
  attempt_id uuid PRIMARY KEY REFERENCES attempts(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  issued_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id bigserial PRIMARY KEY,
  actor_id uuid NULL,
  action text NOT NULL,
  entity text NULL,
  entity_id text NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_at_idx ON audit_logs (at DESC);

-- ---------- one-time invite links ----------
ALTER TABLE attempts ADD COLUMN IF NOT EXISTS tester_id text NULL;

CREATE TABLE IF NOT EXISTS invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash text NOT NULL UNIQUE,
  tester_id text NOT NULL,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  proctor_id uuid NOT NULL REFERENCES users(id),
  label text NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  revoked_at timestamptz NULL,
  attempt_id uuid NULL REFERENCES attempts(id) ON DELETE SET NULL,
  candidate_id uuid NULL REFERENCES users(id) ON DELETE SET NULL,
  purpose text NOT NULL DEFAULT 'start' CHECK (purpose IN ('start','resume')),
  replaced_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS invites_session_idx ON invites (session_id);
-- tester_id is unique among "live" invites; a reissued link keeps the same tester id while the old row is flagged replaced.
CREATE UNIQUE INDEX IF NOT EXISTS invites_tester_live_uq ON invites (tester_id) WHERE replaced_by IS NULL;

-- ---------- bulk invites / live board (additive) ----------
ALTER TABLE invites ADD COLUMN IF NOT EXISTS email text NULL;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS opened_at timestamptz NULL;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS open_count int NOT NULL DEFAULT 0;
ALTER TABLE invites ADD COLUMN IF NOT EXISTS name_locked boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS invites_session_created_idx ON invites (session_id, created_at);
CREATE INDEX IF NOT EXISTS attempts_session_status_idx ON attempts (session_id, status);
CREATE INDEX IF NOT EXISTS answers_attempt_updated_idx ON answers (attempt_id, updated_at);
CREATE INDEX IF NOT EXISTS proctor_events_attempt_type_idx ON proctor_events (attempt_id, type);
CREATE INDEX IF NOT EXISTS session_candidates_candidate_idx ON session_candidates (candidate_id);
