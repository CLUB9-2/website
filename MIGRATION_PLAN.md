# Migratie naar Supabase — Takenlijsten

## Jouw taken (handmatig / infra)

Onderstaande taken vereisen toegang tot de Supabase-dashboard, hosting-instellingen, of beslissingen die alleen jij kunt nemen.

### 1. Supabase-project aanmaken
- Ga naar [supabase.com](https://supabase.com), maak een gratis project aan.
- Noteer je **Project URL** en **anon key** (Settings → API).
- De **service_role key** bewaar je veilig en zet je nooit in client-side code.

### 2. Database-schema uitvoeren
- Open de SQL Editor in je Supabase-dashboard.
- Voer het SQL-script uit dat Sonnet voor je genereert (taak S1 + S2 hieronder).
- Controleer: tabellen `reigns`, `meals`, `signups` bestaan; RLS is enabled op alle drie.

### 3. Seed-data laden
- Voer het INSERT-script uit dat Sonnet genereert (taak S3).
- Controleer via Table Editor: 63 rijen in `reigns`, gap-row met nulls aanwezig.

### 4. Auth-configuratie
- Ga naar Authentication → Providers → Email: zet **Enable Email** aan, zet **Confirm Email** uit (voor magic link flow).
- Voeg je eigen e-mailadres toe als gebruiker, of gebruik de invite-functie.
- Optioneel: beperk sign-ups via Authentication → Settings zodat alleen jij kunt inloggen.

### 5. RLS-policies controleren
- Test in de SQL Editor:
  - `SET ROLE anon; SELECT * FROM reigns;` → moet werken (publieke leestoegang).
  - `SET ROLE anon; INSERT INTO reigns (...) VALUES (...);` → moet falen.
  - `SET ROLE authenticated; INSERT INTO reigns (...) VALUES (...);` → moet werken.
- Idem voor `meals` en `signups`.

### 6. Hosting-beslissing
- GitHub Pages werkt, maar je kunt `SUPABASE_URL` en `SUPABASE_ANON_KEY` niet in env vars zetten — ze moeten hardcoded in de HTML.
- Dat is **prima**: de anon key is per definitie publiek, RLS doet het beveiligingswerk.
- Als je later env vars wilt (of build-steps), overweeg Cloudflare Pages of Netlify.

### 7. Keys invullen en deployen
- Vervang de placeholder-waarden (`YOUR_SUPABASE_URL`, `YOUR_SUPABASE_ANON_KEY`) in de bestanden die Sonnet genereert door je echte waarden.
- Push naar GitHub, controleer of de site correct laadt.

### 8. End-to-end test
- Open `bierkoningschap.html` zonder login → tabel en grafiek laden vanuit Supabase.
- Log in via magic link → admin-UI verschijnt, voeg een test-reign toe, verwijder hem weer.
- Open `avondeten.html` → maaltijden + aanmeldingen werken.

---

## Sonnet-taken (delegeerbaar)

Elke taak hieronder is een zelfstandige prompt die je aan een Sonnet-model kunt geven. Ze zijn zo geschreven dat Sonnet geen extra context nodig heeft buiten wat in de prompt staat.

---

### S1 — SQL: `reigns`-tabel + RLS

**Prompt:**

> Schrijf een PostgreSQL-script voor Supabase met:
>
> 1. Een tabel `reigns` met kolommen:
>    - `id` (uuid, primary key, default gen_random_uuid())
>    - `datum` (date, not null)
>    - `bierkoning` (text, not null)
>    - `dagen` (integer, not null)
>    - `totaal_bk` (numeric, nullable — voor gap-periodes)
>    - `gem_bk` (numeric, nullable)
>    - `totaal_huis` (numeric, nullable)
>    - `gem_huis` (numeric, nullable)
>    - `pct` (numeric, nullable)
>    - `gap` (boolean, default false)
>    - `created_at` (timestamptz, default now())
>
> 2. Enable Row Level Security op de tabel.
>
> 3. Policies:
>    - `reigns_public_read`: iedereen (anon + authenticated) mag SELECT.
>    - `reigns_auth_insert`: alleen authenticated mag INSERT.
>    - `reigns_auth_update`: alleen authenticated mag UPDATE.
>    - `reigns_auth_delete`: alleen authenticated mag DELETE.
>
> Gebruik `CREATE POLICY ... ON reigns FOR ... TO ...` syntax. Geen `USING`-clause nodig voor de insert-policy (alleen `WITH CHECK (true)`).

---

### S2 — SQL: `meals` + `signups` tabellen + RLS

**Prompt:**

> Schrijf een PostgreSQL-script voor Supabase met twee tabellen voor een avondeten-planner:
>
> 1. Tabel `meals`:
>    - `id` (uuid, primary key, default gen_random_uuid())
>    - `datum` (date, not null, unique)
>    - `kok` (text, not null) — wie kookt
>    - `gerecht` (text) — optioneel, wat wordt er gekookt
>    - `created_at` (timestamptz, default now())
>
> 2. Tabel `signups`:
>    - `id` (uuid, primary key, default gen_random_uuid())
>    - `meal_id` (uuid, not null, references meals(id) on delete cascade)
>    - `naam` (text, not null) — wie eet mee
>    - `opmerking` (text) — bijv. "ben er om 19:30"
>    - `created_at` (timestamptz, default now())
>    - Unique constraint op (meal_id, naam).
>
> 3. RLS op beide tabellen: publieke leestoegang (anon + authenticated), alleen authenticated mag INSERT/UPDATE/DELETE.
>
> Zelfde policy-patroon als bij `reigns`.

---

### S3 — SQL: Seed de 63 bestaande reigns

**Prompt:**

> Gegeven onderstaande JavaScript-array, genereer een enkel `INSERT INTO reigns (datum, bierkoning, dagen, totaal_bk, gem_bk, totaal_huis, gem_huis, pct, gap) VALUES ...` statement dat alle 63 rijen in één keer insert. Gebruik `NULL` voor null-waarden. Zet de gap-rij op `gap = true`, alle andere op `gap = false`.
>
> ```js
> const reigns = [
>   {datum:"2010-08-22", bierkoning:"Jasper",  dagen:80,  totaal_bk:118, gem_bk:1.475,       totaal_huis:930,  gem_huis:11.625,      pct:0.12688},
>   {datum:"2010-10-24", bierkoning:"Kees",    dagen:63,  totaal_bk:256, gem_bk:4.063492063, totaal_huis:1487, gem_huis:23.6031746,  pct:0.17216},
>   // ... (plak hier de volledige array uit bierkoningschap.html, regels 224-288)
> ];
> ```
>
> Output alleen het SQL-statement, geen uitleg.

---

### S4 — Refactor `bierkoningschap.html`: hardcoded → Supabase fetch

**Prompt:**

> Ik heb een statische HTML-pagina `bierkoningschap.html` die een hardcoded JavaScript-array `reigns` gebruikt (63 objecten). De pagina gebruikt vanilla JS en Chart.js 4.4.1. Ik wil de hardcoded array vervangen door een fetch vanuit Supabase.
>
> Wat ik nodig heb:
>
> 1. Voeg de Supabase JS client toe via CDN (`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2`).
> 2. Initialiseer de client met placeholders `YOUR_SUPABASE_URL` en `YOUR_SUPABASE_ANON_KEY`.
> 3. Vervang de hardcoded `const reigns = [...]` door een async fetch: `const { data: reigns } = await supabase.from('reigns').select('*').order('datum')`.
> 4. Wrap de bestaande logica (tabel opbouwen, hero-sectie, chart) in een `async function init()` die wordt aangeroepen na de fetch.
> 5. Voeg een simpele loading-state toe (bijv. "Laden..." in de tabel) die verdwijnt zodra data beschikbaar is.
> 6. Voeg een foutmelding toe als de fetch faalt.
>
> De bestaande helper-functies (`fmtNL`, `fmtInt`, `fmtPct`, `fmtDate`), sortering, en Chart.js-logica moeten ongewijzigd blijven. Alleen de databron verandert.
>
> Geef me het volledige `<script>`-blok dat ik kan copy-pasten.

---

### S5 — Login-pagina met magic link

**Prompt:**

> Maak een minimale `login.html` pagina die werkt met Supabase magic link auth. Vereisten:
>
> 1. Supabase JS client via CDN, initialisatie met placeholders.
> 2. Een formulier met één e-mailinput en een "Stuur magic link"-knop.
> 3. Na verzending: toon "Check je inbox voor de magic link".
> 4. Na succesvolle auth (terug op de pagina via de link): redirect naar `bierkoningschap.html`.
> 5. Style consistent met de rest van de site: gebruik font-family `'TW Cen MT Condensed', sans-serif`, donkere achtergrond (#1a1a2e), gouden accent (#d4af37).
> 6. Voeg een link toe naar de homepage.
>
> De pagina moet ook werken als callback-URL voor de magic link (Supabase stuurt de gebruiker terug naar deze pagina met een token in de URL). Gebruik `supabase.auth.onAuthStateChange()` om de redirect te triggeren.

---

### S6 — Admin-UI voor reigns toevoegen/bewerken

**Prompt:**

> Ik heb een `bierkoningschap.html` pagina die reigns uit Supabase laadt. Voeg een admin-sectie toe die alleen zichtbaar is voor ingelogde gebruikers. Vereisten:
>
> 1. Check auth-status via `supabase.auth.getSession()`. Als ingelogd: toon admin-UI + een "Uitloggen"-knop. Als niet ingelogd: toon een "Inloggen"-link naar `login.html`.
> 2. Admin-UI bevat:
>    - Een "Nieuwe reign toevoegen"-formulier met velden voor: datum, bierkoning (text), dagen, totaal_bk, gem_bk, totaal_huis, gem_huis, pct. Alle numerieke velden accepteren komma's als decimaalteken (NL-formaat).
>    - Een "Bewerken"-knop per rij in de bestaande tabel die de rij inline bewerkbaar maakt.
>    - Een "Verwijderen"-knop per rij (met bevestiging).
> 3. Na elke mutatie: herlaad de data en rebuild de tabel + chart.
> 4. Style consistent: donker thema, gouden accenten, `TW Cen MT Condensed` font.
>
> De Supabase client is al geïnitialiseerd op de pagina. Geef me het JavaScript + HTML dat ik kan toevoegen.

---

### S7 — `avondeten.html`: maaltijdplanner

**Prompt:**

> Maak een nieuwe pagina `avondeten.html` voor een studentenhuis-maaltijdplanner. De pagina haalt data uit Supabase-tabellen `meals` en `signups`.
>
> **Publieke weergave (geen login nodig):**
> - Toon een weekoverzicht (ma-zo) met per dag: wie kookt, het gerecht, en wie zich heeft aangemeld.
> - Navigatie: vorige/volgende week knoppen.
> - Als er geen maaltijd is voor een dag: toon "Nog geen kok".
>
> **Admin-weergave (na login):**
> - Per dag: knop om jezelf als kok in te schrijven + gerecht invullen.
> - Per dag: knop om je aan/af te melden als eter.
> - Mogelijkheid om een bestaande maaltijd te bewerken of verwijderen.
>
> **Technisch:**
> - Supabase JS client via CDN, placeholders voor URL en key.
> - Auth-check via `supabase.auth.getSession()`.
> - Style: consistent met de rest van de site (donker thema, #1a1a2e achtergrond, #d4af37 accent, `TW Cen MT Condensed` font).
> - Voeg de standaard navigatiebalk van de site toe (kopieer uit `index.html`).
>
> Geef me het volledige HTML-bestand.

---

### S8 — Navigatie bijwerken

**Prompt:**

> Ik heb een statische website met deze HTML-bestanden: `index.html`, `bierkoningschap.html`, `huidige-bewoners.html`, `hal-van-faam.html`, `contact.html`, `biertimer.html`, `namenkiezer.html`, `soundboard.html`.
>
> De navigatie bevat een dropdown "Tools" met biertimer, namenkiezer, soundboard.
>
> Voeg twee items toe:
> 1. `avondeten.html` als nieuw top-level menu-item "Avondeten" (tussen "Bierkoningschap" en "Huidige Bewoners").
> 2. `login.html` als klein linkje rechtsboven in de navbar (niet als menu-item, maar als utility-link).
>
> Geef me de bijgewerkte `<nav>`-HTML die ik in elk bestand kan plakken.
