-- S2 (v2): meals + signups tabellen + RLS
-- Uitvoeren in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS meals (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  datum      date        NOT NULL UNIQUE,
  kok1       text        NOT NULL,
  kok2       text,                                           -- tweede kok (optioneel)
  afwasser   text,                                           -- afwasser (optioneel)
  gerecht    text,
  mode       text        NOT NULL DEFAULT 'uitschrijf'
               CHECK (mode IN ('uitschrijf', 'inschrijf')), -- uitschrijf = iedereen eet tenzij afgemeld
  created_at timestamptz NOT NULL DEFAULT now()
);

-- signups: in uitschrijf-mode = mensen die NIET eten
--          in inschrijf-mode  = mensen die WEL eten
CREATE TABLE IF NOT EXISTS signups (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id    uuid        NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  naam       text        NOT NULL,
  opmerking  text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meal_id, naam)
);

-- Row Level Security
ALTER TABLE meals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE signups ENABLE ROW LEVEL SECURITY;

-- meals: publieke leestoegang
CREATE POLICY meals_public_read
  ON meals FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY meals_auth_insert
  ON meals FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY meals_auth_update
  ON meals FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY meals_auth_delete
  ON meals FOR DELETE
  TO authenticated
  USING (true);

-- signups: publieke leestoegang
CREATE POLICY signups_public_read
  ON signups FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY signups_auth_insert
  ON signups FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY signups_auth_update
  ON signups FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY signups_auth_delete
  ON signups FOR DELETE
  TO authenticated
  USING (true);
