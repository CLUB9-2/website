# CLUB 9-2 website — verbeteringsplan (handoff aan Sonnet)

**Context:** Statische HTML/CSS-site gedeployed op GitHub Pages, met een Supabase-backend voor `bierkoningschap` en `avondeten`. Geen build-step, geen framework, geen bundler. Deze audit is gedaan op basis van een code-review van alle bestanden op `C:\Users\niels\OneDrive\Desktop\website-main\`. Een live visuele test in Chrome was in deze sessie niet mogelijk (extensie offline + network-egress geblokkeerd voor `*.github.io`).

**Structuur:** Bevindingen zijn ingedeeld in P0 (blockers — moet eerst), P1 (hoge impact) en P2 (polish). Per item: _probleem_, _impact_, _aanpak_, _acceptance criteria_. File-refs gebruiken `path:regel`. Sonnet kan dit doc als takenlijst gebruiken.

---

## P0 — Integriteit van de bronbestanden

### 1. Bestandstruncatie systeemcheck

**Probleem:** Van de 10 HTML-bestanden zijn er 8 die op disk eindigen midden in een tag, comment of tekst. Concrete bewijzen (laatste byte op disk):

- `index.html` (2329 B, 54 regels) — eindigt in `<h2>...of gewoon lekker samen ` (geen sluitende h2/div/main/body/html)
- `biertimer.html` (3841 B, 120 regels) — eindigt met `// only warn if timer is running` (geen sluit van script/body/html, `onbeforeunload`-logica ontbreekt vermoedelijk)
- `contact.html` (1341 B, 38 regels) — eindigt met `<p` (midden in tag)
- `hal-van-faam.html` (1144 B, 31 regels) — eindigt met `</a` (midden in sluittag, bevat alleen de nav, verder geen content)
- `huidige-bewoners.html` (2842 B, 99 regels) — eindigt met whitespace na 10e `bewoner-card`, ontbrekende sluit van grid/main/body/html
- `namenkiezer.html` (4122 B, 127 regels) — eindigt met `requestAn` (midden in `requestAnimationFrame`), rest van de animatie-logica ontbreekt
- `soundboard.html` (3971 B, 87 regels) — eindigt met `new Audio(soundFi` (midden in expression), play-logica ontbreekt
- `bierkoningschap.html` was ook truncated (fix al toegepast in deze sessie)

**Impact:** Browsers zijn verrassend forgiving met onafgesloten HTML (de parser fixed stilzwijgend de DOM), dus de pagina's _lijken_ te werken. Maar JavaScript-blocks die mid-expression afbreken produceren een `SyntaxError` en draaien _niet_. Concreet: `namenkiezer.html` en `biertimer.html` en `soundboard.html` hebben kapotte of ontbrekende script-blocks en functioneren daardoor vrijwel zeker niet volledig op de live site. De eerste vraag voor Sonnet is: **is dit een lokaal-only probleem (editor/OneDrive sync) of is het ook gepusht naar GitHub?**

**Aanpak:**

1. Controleer de remote versie op `github.com/club9-2/website`. Als het daar compleet is, is dit een lokaal sync-probleem — git pull overschrijft de lokale truncaties en klaar.
2. Als het remote óók kapot is: reconstrueer elk bestand volgens hetzelfde patroon als `bierkoningschap.html` (we hebben de tail geschreven en `node --check` geverifieerd). Voor namenkiezer/biertimer/soundboard betekent dat reverse-engineering van de afgebroken functies op basis van wat er wel staat en de semantische intentie.
3. Voeg een CI-check toe (zie P2 item 10) om deze klasse van fouten voortaan vroeg te vangen.

**Acceptance criteria:** Elke `.html` eindigt met `</html>`. Elke geopende `<script>` heeft een bijbehorende `</script>`. `node --check` op geëxtraheerde script-blocks geeft geen syntaxfouten. Alle pagina's laden zonder rode errors in de console.

---

## P1 — Hoge-impact verbeteringen

### 2. Mobile-first responsive navigatie

**Probleem:** De nav-bar is in elk bestand identiek gekopieerd (zie `index.html:9-33` en idem op 9 andere pagina's) en bevat 7 tekstlinks + een hover-dropdown met 3 extra links + een logo + een "Inloggen"-link. Op mobiel (viewport <600px) past dit niet op één rij. De `style.css` heeft **geen media queries voor de nav**. Ook: `.grid-soundboard` en `.grid-bewoners` gebruiken `repeat(6, 2fr)` zonder breakpoint, dus op mobiel krijg je 6 minuscule kolommen met knoppen die niet te tikken zijn (< 44×44px WCAG touch-target minimum). `avondeten.html` en `bierkoningschap.html` hebben wél `@media` regels maar alleen voor hun eigen grids, niet voor de nav.

**Impact:** Site is vrijwel onbruikbaar op telefoon. Gezien het publiek (studenten) is dit een groot deel van het verkeer.

**Aanpak:**

1. Hamburger-menu op `<800px`: toon logo + hamburger-icon, verberg links. Klik op hamburger toggelt een overlay met alle links in een vertikale lijst.
2. Responsive grids: `grid-soundboard` en `grid-bewoners` krijgen `repeat(auto-fit, minmax(140px, 1fr))` in plaats van hardcoded 6 kolommen.
3. Touch-targets minimaal 44×44px: vergroot padding op nav-links en knoppen op mobiel.
4. Typografische schaal: `h1 { font-size: clamp(1.8rem, 5vw, 3rem); }` zodat titels niet de hele viewport vullen.
5. Fix `.section { height: 100vh; }` → gebruik `min-height: 100svh` (small-viewport-unit) om iOS Safari URL-bar issues te vermijden.

**Acceptance criteria:** Site is bruikbaar op iPhone SE (375px) en Pixel 4 (412px) viewport. Alle interactieve elementen zijn ≥44×44px. Nav past op één schermbreedte in alle viewport-groottes. Lighthouse mobile accessibility score ≥90.

### 3. DRY de navigatie — één bron van waarheid

**Probleem:** De nav-bar staat identiek gekopieerd in 10 HTML-bestanden. Een kleine wijziging (bijv. een link toevoegen) vereist 10 edits en introduceert onvermijdelijk drift. Er is al drift: sommige pagina's gebruiken 2-space indent, andere 4-space; sommige hebben `id="nav-login-link"` op de Inloggen-link (bierkoningschap, avondeten), andere niet (rest). Dat maakt auth-state synchronisatie inconsistent — op 8 van de 10 pagina's blijft "Inloggen" staan zelfs als je ingelogd bent.

**Impact:** Hoge onderhoudslast, inconsistente UI, bugs slippen makkelijk door.

**Aanpak:** Twee opties met verschillende trade-offs.

_Optie A (eenvoudig, geen build-step):_ Maak `nav.html` met de nav-markup. Voeg in elke pagina een `<div id="nav-placeholder"></div>` toe en een klein inline-script: `fetch('nav.html').then(r => r.text()).then(html => document.getElementById('nav-placeholder').outerHTML = html).then(initNavAuth);`. Nadeel: flash-of-missing-nav op slow connections. Voordeel: nul tooling.

_Optie B (robuuster):_ Introduceer een minimale build-step. Gebruik `eleventy` of `astro` (beide GitHub Pages-compatible) om tijdens build de nav als includable partial te injecteren. Voeg een GitHub Action toe die bij elke push de statische output in `dist/` genereert en die naar de `gh-pages` branch pusht. Nadeel: meer tooling. Voordeel: geen runtime-flash, en je kunt meteen de truncatie-bug-preventie (P2 item 10) daar integreren.

Advies: kies **Optie A** als quick-win nu, en evalueer **Optie B** als de site verder groeit.

In beide gevallen: maak één `auth.js` die op elke pagina draait, `sb.auth.getSession()` aanroept, en de Inloggen-link overschrijft naar "Uitloggen" waar relevant. Gebruik `sb.auth.onAuthStateChange` zodat de UI in sync blijft als de sessie verloopt in een andere tab.

**Acceptance criteria:** Eén bron van waarheid voor de nav. Op elke pagina toont de nav consistent "Uitloggen" wanneer ingelogd, "Inloggen" wanneer uitgelogd. Eén nav-wijziging vereist één edit.

### 4. Accessibility (WCAG AA) pass

**Probleem:** Meerdere serieuze a11y-issues:

- `<drop class="dropbtn">Gereedschappen</drop>` (zie `index.html:25` en 9 andere plekken) — `<drop>` is geen bestaande HTML-tag. Het werkt door browser-tolerantie maar krijgt geen button-semantiek, geen keyboard-focus, geen role. Moet `<button type="button" class="dropbtn" aria-haspopup="true" aria-expanded="false">` worden.
- Dropdown opent alleen op `:hover` (`style.css:147`), dus niet bedienbaar met toetsenbord én onbruikbaar op touch-devices (geen hover state).
- Kleurcontrast: de nav-links gebruiken `#384c60` (dof blauw) op `#000524` (bijna zwart) — contrast ratio ~2.1:1, ruim onder WCAG AA minimum van 4.5:1 voor normale tekst. Zelfs de body-kleur `#384c60` op `#060f2d` is ontoereikend. Testen via WebAIM Contrast Checker.
- `alt`-teksten zijn te minimaal: `<img src="img/Koert.JPG" alt="Koert">` zou `alt="Portretfoto van Koert v.d. Plaat, nestor sinds 2019"` moeten zijn.
- `<main>` mist skip-to-content-link voor screenreader-gebruikers.
- Formulieren op `bierkoningschap.html` missen fieldset + legend voor de groep; labels zijn wel aanwezig (goed).
- `bierkoningschap.html` tabel-sorteer-headers zijn `<th>` met `cursor: pointer` maar geen `role="button"` of `aria-sort` attribute.

**Impact:** Site is niet bruikbaar voor iemand met een screenreader of alleen toetsenbord. Dropdown-navigatie werkt niet op mobiel. Kleurcontrast-falen maakt tekst moeilijk leesbaar voor iedereen met lichte visuele beperking.

**Aanpak:**

1. Vervang `<drop>` door `<button>` en implementeer dropdown-toggle in JS (click + keyboard).
2. Herzie het kleurpalet: houd de gele accent (`#ffde00`) maar verhoog de secondaire tekstkleur van `#384c60` naar iets als `#8b9bb4` voor AA contrast op donkere achtergrond.
3. Voeg `aria-label` of betere `alt`-tekst toe aan alle `img`. Zet decoratieve images op `alt=""`.
4. Voeg `<a href="#main" class="skip-link">Naar hoofdinhoud</a>` toe bovenaan elke pagina, met CSS om hem alleen te tonen op `:focus`.
5. Gebruik `aria-sort="ascending|descending|none"` op de tabel-headers en update via JS bij sorteren.

**Acceptance criteria:** Lighthouse accessibility score ≥95. Alle interactieve elementen bereikbaar met Tab. Kleurcontrast ≥4.5:1 voor alle tekst.

### 5. Admin-UX op bierkoningschap

**Probleem:** Op `bierkoningschap.html` gebruikt de admin-UI native `alert()` (regel 598) en `confirm()` (regel 605) voor fout-feedback en delete-bevestiging. `alert()` blokkeert de UI, is onstylebaar en ziet er goedkoop uit. `confirm()` idem. Verder: er is geen undo voor delete (harde remove uit database), geen succes-toast na save, de "Toegevoegd!"-message verdwijnt na 2s zonder bevestiging. De edit-inline-UI heeft geen "Opslaan" disabled-state tijdens de request, dus dubbel-klikken kan dubbele updates veroorzaken.

**Impact:** Admin-ervaring voelt ruw. Delete zonder undo is riskant — één mis-click en 13 jaar data is weg.

**Aanpak:**

1. Vervang `alert()` door een inline toast component (styled `<div>` die 3s vanuit rechtsboven inschuift).
2. Vervang `confirm()` door een styled modal met een 5s-undo-toast na delete ("Reign verwijderd. [Ongedaan maken]").
3. Soft-delete: voeg een `deleted_at` kolom toe aan `reigns`, filter in SELECT op `deleted_at IS NULL`, delete zet alleen de timestamp. Undo keert de timestamp terug. Na bijv. 30 dagen hard-delete via een cron.
4. Disable save-button + toon spinner tijdens await van insert/update.
5. Valideer de pct-input (het wordt als fractie opgeslagen 0.15, maar users typen 15%) — maak de UI-hint expliciet of accepteer beide formaten.

**Acceptance criteria:** Geen `alert()` of `confirm()` meer in de codebase. Delete heeft een undo-mechanisme. Alle async-buttons hebben een loading-state.

### 6. Centralize Supabase config + auth state sync

**Probleem:** `SUPABASE_URL` en `SUPABASE_ANON` zijn op 4 plekken geduplicate gecopy-paste (`avondeten.html:251-252`, `bierkoningschap.html:371-372`, `login.html:127-128`, en impliciet in elke pagina die later Supabase zou willen gebruiken). Eén key-rotatie = 4 edits. Ook: `sb.auth.onAuthStateChange` wordt nergens gebruikt, dus als je in één tab uitlogt terwijl een andere tab open is, blijft die tweede tab "ingelogd" tonen tot je refresht.

**Impact:** Rotatie is foutgevoelig. UI kan desynchroniseren van werkelijke auth state.

**Aanpak:**

1. Maak `config.js` met `export const SUPABASE_URL = '...'; export const SUPABASE_ANON = '...';` (of niet-module variant met globals als je geen ESM wil).
2. Maak `supabase-client.js` dat `sb` creëert en exporteert.
3. Verwijder de duplicatie uit alle `.html` bestanden en include `<script src="supabase-client.js"></script>` in plaats.
4. In `auth.js`: abonneer op `sb.auth.onAuthStateChange((event, session) => applyAdminUI(session))` en update de nav-link en admin-secties realtime.

**Acceptance criteria:** `SUPABASE_URL` komt precies één keer voor in de repo (via grep). Uitloggen in tab A werkt zichtbaar door in tab B zonder refresh.

---

## P2 — Polish & productie-hygiëne

### 7. CSS custom properties + typografische schaal

**Probleem:** De kleuren (`#ffde00`, `#060f2d`, `#000524`, `#384c60`, `#8b1a1a`, etc.) en font-family staan hardcoded door de hele CSS. Tegen-voorbeeld: wil je het gele accent iets minder fel maken? Dan is het een find-replace van `#ffde00` op minimaal 60 plekken. Typografische schaal is ook inconsistent: `h1=3em`, `h2=2em`, `h3=2em`, `h5=3em` — semantische hiërarchie en visuele grootte matchen niet.

**Impact:** Theming en visuele tweaks zijn onnodig arbeidsintensief.

**Aanpak:** Definieer tokens bovenaan `style.css`:

```css
:root {
  --bg: #060f2d;
  --bg-elevated: #000524;
  --accent: #ffde00;
  --accent-hover: #ffd700;
  --text-muted: #8b9bb4;  /* verhoogd voor AA contrast */
  --border: #384c60;
  --danger: #8b1a1a;
  --danger-hover: #aa2222;

  --font-display: 'Tw Cen MT Condensed Extra Bold', Arial, sans-serif;

  --fs-h1: clamp(1.8rem, 5vw, 3rem);
  --fs-h2: clamp(1.4rem, 3.5vw, 2rem);
  --fs-body: 1rem;
}
```

Vervang alle kleurcodes door `var(--name)`. Herzie de heading-schaal zodat h1 > h2 > h3 > h4 > h5 in grootte.

**Acceptance criteria:** Eén wijziging van `--accent` in `:root` verandert de accent-kleur overal. Heading-schaal is consistent oplopend.

### 8. Font-loading + WOFF2

**Probleem:** `style.css:1-6` laadt de custom font als TTF. Er is geen `font-display` gespecificeerd, dus op slow connections is tekst onzichtbaar tot het font geladen is (FOIT). TTF is ook onnodig groot — WOFF2 comprimeert ~30% beter.

**Aanpak:** Converteer de TTF naar WOFF2 (`woff2_compress` CLI of fontsquirrel webfont generator). Update de `@font-face`:

```css
@font-face {
  font-family: 'Tw Cen MT Condensed Extra Bold';
  src: url('fonts/tw-cen-mt-condensed-extrabold.woff2') format('woff2'),
       url('fonts/tw-cen-mt-condensed-extrabold.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
  font-display: swap;
}
```

**Acceptance criteria:** Tekst is leesbaar binnen 100ms na page load, ook op slow 3G. Fontbestand is kleiner.

### 9. SEO + sharing metadata

**Probleem:** Titels zijn niet descriptief (`<title>CLUB 9-2</title>` op _elke_ pagina). Geen `<meta name="description">`, geen Open Graph tags, geen favicon (gebruiker rapporteerde al een 404 op favicon). Delen van een URL naar WhatsApp/Discord toont geen preview.

**Aanpak:** Per pagina: unieke `<title>`, `<meta name="description">`, Open Graph tags (`og:title`, `og:description`, `og:image` met bijv. `img/logo.svg` of een huisfoto), en een `favicon.ico` + `apple-touch-icon.png` vanuit de logo-SVG.

```html
<meta name="description" content="CLUB 9-2 — studentenhuis in Enschede. 12 mannen, bier, traditie sinds 2010.">
<meta property="og:title" content="CLUB 9-2 — Bierkoningschap">
<meta property="og:description" content="...">
<meta property="og:image" content="https://club9-2.github.io/website/img/logo.svg">
<link rel="icon" href="favicon.ico">
```

**Acceptance criteria:** Elke pagina heeft een unieke, descriptive title. URL delen in WhatsApp toont een preview-card.

### 10. CI: html-validate + JS syntax-check

**Probleem:** Er is geen guardrail tegen het type fout dat we net gezien hebben (truncated file, broken JS). Eén commit met een half-saved bestand gaat rechtstreeks naar productie.

**Aanpak:** Voeg `.github/workflows/validate.yml` toe:

```yaml
name: Validate
on: [push, pull_request]
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm install -g html-validate
      - run: html-validate '**/*.html'
      - name: Check JS syntax in script blocks
        run: |
          for f in *.html; do
            awk '/^  <script>$/{flag=1;next}/^  <\/script>$/{flag=0}flag' "$f" > /tmp/extracted.js
            [ -s /tmp/extracted.js ] && node --check /tmp/extracted.js
          done
```

Voor preventie van de truncatie-bug zelf: combineer met een pre-commit hook (`husky` + `lint-staged`) die dezelfde check lokaal draait vóór commit.

**Acceptance criteria:** PR met een truncated HTML-file of broken JS-block faalt in CI. Een groene build garandeert syntactisch valide output.

---

## Bonusobservaties (geen apart agendapunt)

- **login-flow mismatch:** `MIGRATION_PLAN.md:22` zegt magic-link-flow, maar `login.html:143` gebruikt `signInWithPassword`. Kies één en consolideer de documentatie + implementatie.
- **RLS = all-or-nothing admin:** de huidige policies geven elke `authenticated` user volledige CRUD op `reigns`. Als je later niet-admin residents wil inviten (bijv. om zichzelf aan/af te melden voor avondeten zonder ook de koningschap-tabel te kunnen editen), heb je een `profiles.role` kolom en conditionele RLS-policies nodig.
- **`weekMode` zit in localStorage per device** (`avondeten.html:280`): de "uitschrijf/inschrijf" instelling is dus niet gesynchroniseerd tussen bewoners. Een admin die op zijn laptop "uitschrijf" zet, ziet op zijn telefoon misschien nog "inschrijf". Overweeg dit aan de `meals` row te hangen of aan een aparte `week_settings` tabel.
- **`<drop>` element** (zie item 4) zorgt bij strikte HTML-validators voor een hele reeks warnings.
- **Geen `lang` op formulier-elementen:** browsers kunnen daardoor verkeerd spell-checken of datum-formats interpreteren. `<html lang="nl">` staat wel, goed.

---

## Suggested order voor Sonnet

1. **P0-1** eerst — zonder integere bronbestanden is de rest zinloos.
2. Daarna **P1-2** (mobile) en **P1-4** (a11y) parallel, want beide raken alle bestanden en samen uitvoeren voorkomt twee rondes wijzigen van dezelfde files.
3. **P1-3** (DRY nav) is een goed moment om direct de `config.js` / `auth.js` uit **P1-6** mee te nemen in de refactor.
4. **P1-5** (admin UX) staat los en kan op elk moment.
5. **P2** items 7-10 zijn onafhankelijk en kunnen op volgorde van appetite.

---

## Wat ik niet kon testen

- Live visuele weergave (Chrome-extensie was offline, GitHub Pages geblokkeerd in network allowlist)
- Gedrag op echte mobiele devices
- Performance metrics (Lighthouse, WebPageTest)
- Of de truncatie-bug ook op de remote `club9-2/website` repo staat of alleen lokaal

Deze punten moet Sonnet of jij eerst verifiëren voor item P0.
