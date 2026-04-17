-- S1: reigns tabel + RLS
-- Uitvoeren in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS reigns (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  datum        date        NOT NULL,
  bierkoning   text        NOT NULL,
  dagen        integer     NOT NULL,
  totaal_bk    numeric,
  gem_bk       numeric,
  totaal_huis  numeric,
  gem_huis     numeric,
  pct          numeric,
  gap          boolean     NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Row Level Security
ALTER TABLE reigns ENABLE ROW LEVEL SECURITY;

-- Publieke leestoegang (anon + authenticated)
CREATE POLICY reigns_public_read
  ON reigns FOR SELECT
  TO anon, authenticated
  USING (true);

-- Alleen authenticated mag invoegen
CREATE POLICY reigns_auth_insert
  ON reigns FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Alleen authenticated mag bijwerken
CREATE POLICY reigns_auth_update
  ON reigns FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Alleen authenticated mag verwijderen
CREATE POLICY reigns_auth_delete
  ON reigns FOR DELETE
  TO authenticated
  USING (true);
