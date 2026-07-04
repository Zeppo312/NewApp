# Lottis Fürsorge — Supabase-Einrichtung (Schritt für Schritt)

Diese Anleitung bringt den Server-Teil von „Lottis Fürsorge" live:
Tabellen, zwei Edge Functions und den täglichen Cron-Job.

**Was danach funktioniert:**
- Beim Öffnen der Seite formuliert der Server (Regel-Engine + OpenAI) den
  Tages-Hinweis und speichert ihn in `advisor_messages` (Function `advisor-generate`).
- Jeden Morgen ~8 Uhr Ortszeit erzeugt ein Cron-Job pro Nutzer/Baby einen
  Hinweis und schickt ihn als Push (Function `advisor-daily`).
- Fällt irgendetwas aus (kein Deploy, kein API-Key, offline), fällt die App
  automatisch auf die bisherige lokale Logik zurück — nichts geht kaputt.

---

> **Zugriff (Stand jetzt):** Das Feature ist nur für **Premiumtester** und Admins
> sichtbar — App-seitig (Einstiegskarte + Seite) und serverseitig (beide Functions
> prüfen `profiles.paywall_access_role`). Premiumtester ernennst du als Superadmin
> in der Paywall-Zugangsverwaltung der App. Später kommt zusätzlich das
> Premium-Abo dazu (Stellen im Code mit `TODO(Premium-Abo)` markiert).

## Schritt 1 — SQL ausführen (Tabellen + Erweiterungen)

1. Supabase Dashboard → dein Projekt → **SQL Editor** → *New query*.
2. Kompletten Inhalt von **`supabase/create_advisor_tables.sql`** einfügen → **Run**.
3. Danach ebenso **`supabase/migrations/20270413000000_add_premium_tester_role.sql`**
   ausführen — das ergänzt die neue Paywall-Rolle **„Premiumtester"**
   (Check-Constraint + Admin-Funktion `admin_set_paywall_access_role`).

Das Skript ist idempotent (mehrfaches Ausführen ist harmlos). Es legt an bzw. ergänzt:

| Objekt | Zweck |
|---|---|
| `advisor_messages` | 1 Hinweis pro Nutzer/Baby/Tag (inkl. `pushed_at`, `push_status`) |
| `advisor_settings` | Einstellungen + **neu:** `timezone`, `latitude`, `longitude`, `location_updated_at`, `ai_enabled` |
| Index `advisor_messages_cooldown_idx` | schnelle Cooldown-Abfragen (gleiche Regel max. 1×/72 h) |

**Prüfen:** Table Editor → beide Tabellen vorhanden, `advisor_settings` hat die Spalte `timezone`.

---

## Schritt 2 — Secrets setzen

Dashboard → **Edge Functions → Secrets** (oder per CLI, siehe unten). Drei Secrets:

| Secret | Pflicht? | Woher |
|---|---|---|
| `ADVISOR_CRON_SECRET` | **Ja** | Selbst ausdenken (langer Zufallsstring, z. B. Terminal: `openssl rand -hex 32`). Schützt `advisor-daily` vor fremden Aufrufen. |
| `OPENAI_API_KEY` | Nein | https://platform.openai.com → API Keys. Ohne Key: Hinweise kommen als (gute) Template-Texte statt KI-formuliert. |
| `OPENWEATHER_API_KEY` | Nein | **Dein vorhandener OpenWeatherMap-Key** — derselbe wie `WEATHER_API_KEY` in `lib/config.ts` (die App nutzt schon `api.openweathermap.org/data/2.5`, die Function auch). Ohne Key: der Morgen-Job kennt kein Wetter — Wetter-Regeln greifen dann nur beim Öffnen der App (dort liefert das Gerät das Wetter). |

Per CLI alternativ:

```bash
supabase secrets set ADVISOR_CRON_SECRET=<dein-zufallsstring>
supabase secrets set OPENAI_API_KEY=sk-...
supabase secrets set OPENWEATHER_API_KEY=...
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` und `SUPABASE_SERVICE_ROLE_KEY` sind in Edge
Functions automatisch verfügbar — nichts zu tun.

---

## Schritt 3 — Edge Functions deployen

Im Projektordner (`LottiBaby/`), eingeloggt und Projekt verlinkt
(`supabase login`, `supabase link --project-ref <ref>` falls noch nicht geschehen):

```bash
supabase functions deploy advisor-generate
supabase functions deploy advisor-daily
```

Jede Function ist **eigenständig** — ihr Ordner enthält alle drei Dateien:
`index.ts`, `advisorRules.ts` (Regel-Engine) und `advisorAi.ts` (KI-Schicht, OpenAI).
Es gibt bewusst keinen `_shared`-Ordner, weil der je nach Deploy-Weg nicht
mit hochgeladen wird („Module not found"-Fehler).

**Alternativ über das Dashboard** (ohne CLI): Edge Functions → *Deploy a new
function* → Name eingeben → im Editor neben `index.ts` über **Add file** auch
`advisorRules.ts` und `advisorAi.ts` anlegen und den Inhalt aus dem Repo
einfügen → Deploy. Wichtig: alle drei Dateien pro Function.

> ⚠️ Wenn du eine der geteilten Dateien änderst, müssen **beide Kopien**
> (in `advisor-generate/` und `advisor-daily/`) angepasst und beide Functions
> neu deployt werden.

> `advisor-generate` wird aus der App mit dem Nutzer-Login aufgerufen (JWT-geschützt).
> `advisor-daily` prüft zusätzlich den Header `x-advisor-cron-secret`.

---

## Schritt 4 — Testen (vor dem Cron!)

**a) `advisor-daily` von Hand anstoßen** (ersetze `<ref>`, `<ANON_KEY>`, `<CRON_SECRET>`, `<USER_UUID>`):

```bash
curl -X POST "https://<ref>.supabase.co/functions/v1/advisor-daily" \
  -H "Authorization: Bearer <ANON_KEY>" \
  -H "x-advisor-cron-secret: <CRON_SECRET>" \
  -H "Content-Type: application/json" \
  -d '{"force": true, "userId": "<USER_UUID>"}'
```

`force: true` ignoriert das 8-Uhr-Fenster, `userId` beschränkt auf deinen Test-Account
(deine User-UUID findest du im Dashboard unter **Authentication → Users**).

Erwartete Antwort: `{"processed": {"<user>/<baby>": "hot (ai, push: sent)"}}` o. ä.
Danach: Table Editor → `advisor_messages` → neue Zeile für heute vorhanden?

> Hinweis: Der Test-User braucht (1) die Rolle **Premiumtester** (oder Admin) —
> als Superadmin in der App unter Paywall-Zugänge setzen — und (2) eine Zeile in
> `advisor_settings`. Die entsteht automatisch, sobald du die Fürsorge-Seite in
> der App einmal öffnest (die App schreibt dann auch Zeitzone + grobe
> Koordinaten für das Wetter).

**b) App-Test:** Fürsorge-Seite öffnen → der Haupt-Hinweis sollte jetzt vom Server
kommen (in `advisor_messages` steht `source = 'ai'` bzw. `'rules'`). Logs bei Problemen:
Dashboard → **Edge Functions → advisor-generate → Logs**.

---

## Schritt 5 — Cron-Job einrichten (stündlich)

Der Job läuft **stündlich** und verarbeitet intern nur Nutzer, bei denen es gerade
8 Uhr Ortszeit ist (Spalte `timezone`). SQL Editor → ausführen
(ersetze `<ref>`, `<ANON_KEY>`, `<CRON_SECRET>`):

```sql
-- Extensions einmalig aktivieren (im Dashboard unter Database → Extensions
-- heißen sie pg_cron und pg_net):
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Stündlich zur Minute 5 die Function aufrufen:
SELECT cron.schedule(
  'advisor-daily-hourly',
  '5 * * * *',
  $$
  SELECT net.http_post(
    url     := 'https://<ref>.supabase.co/functions/v1/advisor-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>',
      'x-advisor-cron-secret', '<CRON_SECRET>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

**Prüfen / verwalten:**

```sql
SELECT * FROM cron.job;                                        -- Job angelegt?
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;  -- Läufe
-- Entfernen: SELECT cron.unschedule('advisor-daily-hourly');
```

---

## Schritt 6 — Kontrolle nach dem ersten Morgen

- `advisor_messages`: pro aktivem Nutzer/Baby eine Zeile mit heutigem `local_date`;
  `push_status` = `sent` (oder `no_token` / `quiet_hours` / `skipped`).
- Push kam aufs Gerät an (Titel = Emoji + Headline).
- Edge-Function-Logs von `advisor-daily` auf Fehler prüfen.

---

## Wie die Teile zusammenspielen (Kurzüberblick)

```
App öffnet Fürsorge-Seite
  ├─ buildDailySignals (lokal: Ernährung, Schlaf, Wetter am Gerät)
  ├─ updateAdvisorContext → advisor_settings (timezone, grobe Koordinaten)
  ├─ advisor-generate (Edge) → Regel-Engine → OpenAI → advisor_messages
  └─ Fallback: buildMockAnalysis, falls Function nicht erreichbar

Cron (stündlich) → advisor-daily (Edge)
  ├─ Nutzer mit lokaler Uhrzeit == 8 h
  ├─ Signale aus DB (baby_care_entries, sleep_entries_new) + OpenWeather
  ├─ Regel-Engine + Cooldown (72 h) + Themen-Opt-outs + „Nur Wichtiges"
  ├─ OpenAI-Formulierung (Fallback: Template)
  └─ advisor_messages + Expo-Push (user_push_tokens, stille Zeiten beachtet)
```

**Kostenbremse (advisor-generate)**
- Bleibt die Regel gleich, wird der heute schon formulierte KI-Text
  wiederverwendet — kein neuer API-Call beim bloßen Neuöffnen der Seite.
- Ändert sich die Regel im Tagesverlauf: max. **3 KI-Formulierungen pro
  Nutzer/Baby/Tag** (Zähler in `advisor_messages.facts.ai_runs`), danach
  Template-Texte. **Admins sind ausgenommen** (immer frischer Text zum Testen).

**Sicherheits-/Datenschutz-Notizen**
- Die KI bekommt nur die Fakten der aktiven Regel + geprüften Kerninhalt —
  sie erfindet keine medizinischen Aussagen (Validierung + Template-Fallback).
- Koordinaten werden auf ~1 km gerundet gespeichert und nur fürs Tageswetter genutzt.
- `ai_enabled = false` in `advisor_settings` schaltet die KI pro Nutzer ab
  (Templates bleiben aktiv).
