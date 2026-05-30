-- ============================================================================
-- RideLog — Migration: Erweiterte "Erstellen"-Inhalte
-- ============================================================================
-- Führe dieses Skript EINMAL im Supabase SQL-Editor aus.
-- Es ist idempotent — mehrfaches Ausführen schadet nicht.
--
-- Fügt hinzu:
--   1. posts.post_type   (Art des Beitrags: standard, route_tip, ride_buddy,
--                         poll, marketplace, tour_report, challenge)
--   2. posts.metadata    (JSONB mit typ-spezifischen Feldern)
--   3. Tabelle poll_votes         (Abstimmungen für Umfragen)
--   4. Tabelle post_participants  (Teilnahme an Mitfahrer-Posts & Challenges)
-- ============================================================================

-- ── 1. Neue Spalten auf posts ───────────────────────────────────────────────
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type text NOT NULL DEFAULT 'standard';
ALTER TABLE posts ADD COLUMN IF NOT EXISTS metadata  jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Index für schnelles Filtern nach Typ
CREATE INDEX IF NOT EXISTS posts_post_type_idx ON posts (post_type);


-- ── 2. poll_votes — eine Stimme pro User pro Umfrage ────────────────────────
CREATE TABLE IF NOT EXISTS poll_votes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id      uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  option_index int  NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS poll_votes_post_idx ON poll_votes (post_id);

ALTER TABLE poll_votes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poll_votes' AND policyname = 'poll_votes_select') THEN
    CREATE POLICY "poll_votes_select" ON poll_votes FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poll_votes' AND policyname = 'poll_votes_insert') THEN
    CREATE POLICY "poll_votes_insert" ON poll_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poll_votes' AND policyname = 'poll_votes_update') THEN
    CREATE POLICY "poll_votes_update" ON poll_votes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'poll_votes' AND policyname = 'poll_votes_delete') THEN
    CREATE POLICY "poll_votes_delete" ON poll_votes FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- ── 3. post_participants — Teilnahme (Mitfahrer + Challenges) ───────────────
CREATE TABLE IF NOT EXISTS post_participants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS post_participants_post_idx ON post_participants (post_id);

ALTER TABLE post_participants ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_participants' AND policyname = 'post_participants_select') THEN
    CREATE POLICY "post_participants_select" ON post_participants FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_participants' AND policyname = 'post_participants_insert') THEN
    CREATE POLICY "post_participants_insert" ON post_participants FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'post_participants' AND policyname = 'post_participants_delete') THEN
    CREATE POLICY "post_participants_delete" ON post_participants FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- Fertig. Die App nutzt diese Strukturen automatisch.
-- ============================================================================
