-- ============================================================================
-- RideLog — Migration v2: Bewertungen, Wartung, Notfallkontakt
-- ============================================================================
-- Idempotent — kann mehrfach ausgeführt werden.
--
-- Fügt hinzu:
--   1. route_ratings        (Strecken-Bewertungen, 1–5 Sterne)
--   2. maintenance_reminders (Wartungs-Erinnerungen pro Fahrzeug)
--   3. profiles.emergency_contact_name / _phone
-- ============================================================================

-- ── 1. route_ratings — Strecken-Bewertungen ─────────────────────────────────
CREATE TABLE IF NOT EXISTS route_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS route_ratings_post_idx ON route_ratings (post_id);
ALTER TABLE route_ratings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'route_ratings' AND policyname = 'route_ratings_select') THEN
    CREATE POLICY "route_ratings_select" ON route_ratings FOR SELECT USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'route_ratings' AND policyname = 'route_ratings_insert') THEN
    CREATE POLICY "route_ratings_insert" ON route_ratings FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'route_ratings' AND policyname = 'route_ratings_update') THEN
    CREATE POLICY "route_ratings_update" ON route_ratings FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'route_ratings' AND policyname = 'route_ratings_delete') THEN
    CREATE POLICY "route_ratings_delete" ON route_ratings FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- ── 2. maintenance_reminders — Wartungs-Erinnerungen ───────────────────────
CREATE TABLE IF NOT EXISTS maintenance_reminders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  motorcycle_id uuid NOT NULL REFERENCES motorcycles(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type          text NOT NULL DEFAULT 'other',
  label         text NOT NULL,
  due_date      date,
  due_km        int,
  notes         text,
  done          boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS maintenance_reminders_moto_idx ON maintenance_reminders (motorcycle_id);
ALTER TABLE maintenance_reminders ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_reminders' AND policyname = 'maintenance_select') THEN
    CREATE POLICY "maintenance_select" ON maintenance_reminders FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_reminders' AND policyname = 'maintenance_insert') THEN
    CREATE POLICY "maintenance_insert" ON maintenance_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_reminders' AND policyname = 'maintenance_update') THEN
    CREATE POLICY "maintenance_update" ON maintenance_reminders FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'maintenance_reminders' AND policyname = 'maintenance_delete') THEN
    CREATE POLICY "maintenance_delete" ON maintenance_reminders FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;


-- ── 3. Notfallkontakt-Felder auf profiles ──────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_name  text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- ============================================================================
-- Fertig. Die App nutzt diese Strukturen automatisch.
-- ============================================================================
