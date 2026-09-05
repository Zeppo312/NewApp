# Lottis Fürsorge — KI-Berater (Premium-Feature)

**Status:** In Umsetzung — Tabellen, Regel-Engine, Edge Functions
(`advisor-generate`, `advisor-daily`) und App-Anbindung sind gebaut.
Einrichtung in Supabase: siehe `docs/ANLEITUNG_SUPABASE_FUERSORGE.md`.
**Premium-Tier:** Premium (über `canUse('advisor', tier)`)
**Marken-Stimme:** „Lotti" (analog zu *Lottis Empfehlungen*)

---

## 1. Vision

Ein **proaktiver KI-Berater**, der einmal täglich (und bei kritischen Ereignissen) die
vorhandenen Datenquellen der App kombiniert und nur dann eine kurze, warme,
personalisierte Nachricht schickt, wenn es heute wirklich relevant ist.

Das Alleinstellungsmerkmal: Andere Apps kennen nur eine Datenquelle. LottiBaby hat
**Wetter + Schlaf + Ernährung + Babyalter + Standort an einem Ort** — nur damit lassen
sich *Kombinations-Hinweise* erzeugen, die ein echter Mehrwert sind.

> Beispiel:
> 🔥 **Heißer Tag + Lotti hat heute erst 2× getrunken.** An so warmen Tagen brauchen
> Babys mehr Flüssigkeit. Schau, ob du noch eine Mahlzeit unterbringst.

---

## 2. Datenquellen (Ist-Stand im Code)

| Signal | Quelle | Status |
|---|---|---|
| Temperatur, gefühlt, Luftfeuchte, Wind | `lib/weatherService.ts` (`WeatherData`) | ✅ vorhanden (nur **aktuelles** Wetter) |
| **Tages-Höchsttemperatur / Forecast** | – | ⚠️ **muss ergänzt werden** (s. u.) |
| **UV-Index** | – | ⚠️ **muss ergänzt werden** (s. u.) |
| Standort / Region | `expo-location` | ✅ vorhanden |
| Babyalter | `birth_date` in `lib/baby.ts` | ✅ vorhanden |
| Schlaf letzte Nacht | `lib/sleepData.ts` | ✅ vorhanden |
| Ernährung / Trinken | `lib/feeding-interval.ts`, `BabyCareEntry` (`entry_type='feeding'`) | ✅ vorhanden |
| Push-Auslieferung | `lib/notificationService.ts` u. a. | ✅ vorhanden |
| KI-Textgenerierung | Claude API (serverseitig) | 🆕 neu |

### Nötige Erweiterung am Wetter
`weatherService` liefert aktuell nur das *aktuelle* Wetter. Für einen Morgen-Berater
braucht es die **Tagesvorhersage (Tmax, Tmin, UV-Index, Niederschlagswahrscheinlichkeit)**.

- Lösung: OpenWeather **One Call API** (`/data/3.0/onecall`) ergänzen — liefert `daily[]`
  mit `temp.max`, `temp.min`, `uvi`, `pop`.
- Neue Funktion z. B. `getDailyForecast(lat, lon)` in `weatherService.ts`.

---

## 3. Architektur (Hybrid: Regeln entscheiden WANN, KI formuliert den TEXT)

```
┌─ Täglicher Job: Supabase Edge Function (Cron, morgens je Zeitzone) ──────────┐
│                                                                              │
│  1. Pro Premium-Nutzer Signale sammeln:                                      │
│       • Tagesvorhersage (Tmax, UV, Regen) via Standort                       │
│       • Babyalter (birth_date → ageMonths)                                   │
│       • Schlaf letzte Nacht (Dauer, Unterbrechungen)                         │
│       • Ernährung heute/gestern (Anzahl, letztes Intervall)                  │
│                                                                              │
│  2. Regel-Engine (lib/advisor/rules.ts) wertet "Situationen" aus:            │
│       → z. B. ["hitze", "wenig_getrunken"]                                    │
│       (rein deterministisch, ohne KI, voll testbar)                          │
│                                                                              │
│  3. Priorisierung + Anti-Spam:                                               │
│       max. 1 Nachricht/Tag, höchste Priorität gewinnt,                        │
│       Theme-Opt-outs & Cooldown beachten                                     │
│                                                                              │
│  4. NUR wenn relevante Situation aktiv:                                       │
│       Claude API formuliert aus den Fakten 1 warme, kurze Nachricht           │
│       (strenger Prompt, JSON-Output, Sicherheits-Leitplanken)                │
│                                                                              │
│  5. Speichern in `advisor_messages` + Push via Expo Push Token                │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Warum Hybrid (wichtig!)
- **Regeln zuerst = Kontrolle.** Babygesundheit ist heikel. Die *Bedingungen* und der
  *medizinische Kerninhalt* jeder Nachricht sind fest definiert und geprüft. Die KI
  erfindet **keine** Empfehlungen, sie macht den geprüften Inhalt nur sprachlich schön
  und persönlich (Babyname, Alter, konkrete Zahlen).
- **KI nur für Text = günstig.** 0–1 kurzer Call pro Nutzer/Tag.
- **Fallback:** Fällt die KI aus, wird die hinterlegte Template-Version der Regel
  verschickt. Der Berater funktioniert also auch ohne KI.

---

## 4. Trigger-Regelkatalog

Jede Regel: `id`, `priorität` (1 = höchste), `bedingung`, `altersfilter`,
`kerninhalt` (geprüft, fix), `template` (KI-Fallback), `beispieltext`.

> **Altersgruppen:** `neugeboren` 0–3 Mon · `säugling` 3–12 Mon · `kleinkind` 12 Mon+

### 4.1 Wetter — Hitze

| Feld | Wert |
|---|---|
| **id** | `hitze` |
| **Bedingung** | `forecast.tmax >= 28°C` (oder `feelsLike >= 30`) |
| **Priorität** | 2 (bei `neugeboren`: 1) |
| **Kerninhalt** | Mehr Flüssigkeit anbieten; direkte Sonne meiden; dünne, lange Kleidung; Räume kühl halten. Bei <6 Mon.: **kein zusätzliches Wasser** geben — mehr Stillen/Flasche. |

> ☀️ **Heute bis 32°C in {region}.** {babyname} ist erst {alter} alt — biete öfter
> Brust/Flasche an und halte sie aus der direkten Sonne. Dünne, lange Kleidung schützt
> besser als nackte Haut.

### 4.2 Wetter — Hohe UV-Belastung

| Feld | Wert |
|---|---|
| **id** | `uv_hoch` |
| **Bedingung** | `forecast.uvi >= 6` |
| **Priorität** | 2 |
| **Kerninhalt** | Schatten suchen; Spaziergang vor 11 / nach 16 Uhr. Bei <6 Mon.: **Schatten & Kleidung statt Sonnencreme**. Ab 6 Mon.: Sonnencreme an freien Stellen. |

> 🌤️ **UV-Index heute sehr hoch (8) in {region}.** Für Babys unter 6 Monaten gilt:
> Schatten statt Sonnencreme. Plant den Spaziergang am besten vor 11 oder nach 16 Uhr.

### 4.3 Wetter — Kälte

| Feld | Wert |
|---|---|
| **id** | `kaelte` |
| **Bedingung** | `forecast.tmax <= 5°C` (oder `feelsLike <= 0`) |
| **Priorität** | 2 |
| **Kerninhalt** | Zwiebelschicht-Prinzip; Mütze (Kopf kühlt am schnellsten aus); Hände/Füße prüfen; im Auto/Tragesitz dicke Jacke ausziehen (Sicherheit). |

> 🥶 **Morgen nur 2°C bei euch.** Denk an eine Extraschicht für {babyname} — bei Babys
> kühlt der Kopf am schnellsten aus, Mütze nicht vergessen.

### 4.4 Wetter — Regen/Sturm

| Feld | Wert |
|---|---|
| **id** | `regen` |
| **Bedingung** | `forecast.pop >= 0.7` oder Sturm-Icon |
| **Priorität** | 4 |
| **Kerninhalt** | Regenschutz für Kinderwagen; alternativ Indoor-Beschäftigungsidee passend zum Alter. |

> 🌧️ **Heute fast durchgehend Regen.** Falls ihr raus wollt: Regenverdeck einpacken —
> oder wie wär's mit {indoor_idee_passend_zum_alter}?

### 4.5 Schlaf — Unruhige Nacht

| Feld | Wert |
|---|---|
| **id** | `schlechte_nacht` |
| **Bedingung** | Schlafdauer < altersabh. Sollwert **oder** ≥ 4 Unterbrechungen |
| **Priorität** | 3 |
| **Kerninhalt** | Mittagsschlaf nicht zu spät; Schlaffenster ggf. vorziehen; ruhiger Tag; Eltern-Selbstfürsorge erwähnen. |

> 😴 **{babyname} hatte eine unruhige Nacht (nur 5,5 Std).** Plant heute den
> Mittagsschlaf etwas früher — und denk auch an dich, leg eine Pause ein, wenn's geht.

### 4.6 Ernährung — Lange keine Mahlzeit

| Feld | Wert |
|---|---|
| **id** | `langes_intervall` |
| **Bedingung** | `jetzt - letzteMahlzeit > erwartetesIntervall * 1.3` (via `predictNextFeedingTime`) |
| **Priorität** | 3 |
| **Kerninhalt** | Sanfter Reminder zur nächsten Mahlzeit; bei Hitze früher. (Kein Alarm — informativ.) |

> 🍼 **Letzte Mahlzeit war vor 4,5 Std.** Bei {babyname}s Alter liegt das Intervall eher
> bei 3,5 Std — magst du gleich nochmal anbieten?

### 4.7 KOMBI — Hitze + wenig getrunken (Kern-USP)

| Feld | Wert |
|---|---|
| **id** | `hitze_dehydrierung` |
| **Bedingung** | `hitze` aktiv **UND** Mahlzeiten heute < Tagesdurchschnitt |
| **Priorität** | **1** |
| **Kerninhalt** | An heißen Tagen mehr Flüssigkeitsbedarf; öfter anbieten; auf Anzeichen achten (weniger nasse Windeln, eingesunkene Fontanelle → ärztlich abklären). |

> 🔥 **Heißer Tag und {babyname} hat heute erst 2× getrunken.** An so warmen Tagen
> brauchen Babys mehr Flüssigkeit als sonst. Biete ruhig öfter an — und beobachte, ob
> die Windeln nass genug bleiben.

### 4.8 KOMBI — Hitze + schlechte Nacht

| Feld | Wert |
|---|---|
| **id** | `hitze_schlaf` |
| **Bedingung** | `hitze` aktiv **UND** `schlechte_nacht` aktiv |
| **Priorität** | 1 |
| **Kerninhalt** | Hitze stört Babyschlaf; kühlster Raum für Mittagsschlaf; leichte Kleidung/Schlafsack-Tog senken; Schlaffenster früher. |

> 😴🔥 **Unruhige Nacht und heute wird's schwül.** Hitze stört den Babyschlaf zusätzlich.
> Tipp: Mittagsschlaf in den kühlsten Raum verlegen und einen dünneren Schlafsack wählen.

### 4.9 Optionale „positive" Trigger (Bindung, nicht nur Warnungen)

| id | Bedingung | Beispieltext |
|---|---|---|
| `schoenwetter` | Tmax 18–24°C, kein Regen | 🌳 Perfektes Spaziergangswetter heute — genießt die frische Luft mit {babyname}! |
| `meilenstein` | Babyalter trifft Entwicklungswoche | 🎉 {babyname} ist diese Woche {alter} — viele Babys fangen jetzt an, {meilenstein}. |
| `gute_nacht` | Schlaf deutlich besser als Schnitt | 🌙 {babyname} hat super geschlafen ({stunden} Std) — das tut euch beiden gut! |

---

## 5. Priorisierung & Anti-Spam

- **Max. 1 Nachricht pro Tag** (Standard, in Settings auf „nur kritische" reduzierbar).
- Bei mehreren aktiven Situationen gewinnt die **höchste Priorität**; Kombi-Regeln (Prio 1)
  schlagen Einzel-Regeln.
- **Cooldown pro Regel-id:** dieselbe Regel max. 1×/72 h, damit es nicht repetitiv wird.
- **Theme-Opt-outs:** Nutzer kann Kategorien (Wetter / Schlaf / Ernährung / Motivation)
  einzeln abschalten.
- **Stille Zeiten:** kein Push vor 7:00 / nach 21:00 (lokale Zeit).

---

## 6. KI-Schicht (Claude)

**Modell:** `claude-haiku-4-5` (schnell + günstig; Aufgabe ist reine Textformulierung).

**Aufruf:** serverseitig in der Edge Function. Input = strukturierte Fakten + geprüfter
Kerninhalt. Output = JSON mit fertiger Push-Nachricht. KI darf **nur umformulieren**,
keine neuen medizinischen Aussagen treffen.

### System-Prompt (Entwurf)

```
Du bist "Lotti", die fürsorgliche Begleiterin in einer Baby-App. Du schreibst eine
EINZIGE kurze Push-Nachricht an ein Elternteil auf Deutsch.

REGELN:
- Nutze NUR die Fakten und den "kerninhalt" aus dem Input. Erfinde KEINE zusätzlichen
  medizinischen Aussagen, Zahlen oder Empfehlungen.
- Warm, persönlich, auf Augenhöhe — nie belehrend, nie alarmierend.
- Sprich das Baby mit Namen an, beziehe Alter und konkrete Zahlen ein, wenn vorhanden.
- Maximal 2 Sätze, höchstens ~240 Zeichen. Genau 1 passendes Emoji am Anfang.
- Kein medizinischer Rat im engeren Sinn; bei ernsten Anzeichen sanft auf
  Hebamme/Kinderärztin verweisen, NUR wenn der kerninhalt das vorsieht.
- Antworte ausschließlich als JSON: {"title": "...", "body": "..."}
```

### User-Prompt (Beispiel-Payload)

```json
{
  "babyname": "Lotti",
  "alter": "4 Monate",
  "ageMonths": 4,
  "region": "Hamburg",
  "situationen": ["hitze_dehydrierung"],
  "fakten": {
    "tmax": 32,
    "mahlzeiten_heute": 2,
    "mahlzeiten_schnitt": 5
  },
  "kerninhalt": "An heißen Tagen brauchen Babys mehr Flüssigkeit. Öfter Brust/Flasche anbieten. Unter 6 Monaten KEIN zusätzliches Wasser. Auf nasse Windeln achten."
}
```

### Sicherheits-Leitplanken
- KI-Output wird **validiert** (Länge, JSON, kein Link/keine Dosierung/keine erfundenen Zahlen).
- Schlägt Validierung fehl → **Template-Fallback** der Regel verschicken.
- Heikle Themen (Fieber, Medikamente, Dehydrierung) haben Pflicht-Disclaimer im kerninhalt.

---

## 7. Datenmodell (Supabase)

> ✅ **Umgesetzt:** Fertiges, idempotentes SQL liegt in
> `supabase/create_advisor_tables.sql` (inkl. RLS + Unique-Constraint pro
> Nutzer/Baby/Tag). App-Anbindung: `lib/advisor/advisorStorage.ts`.

```sql
create table advisor_messages (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id),
  baby_id       uuid,
  rule_id       text not null,
  title         text not null,
  body          text not null,
  category      text not null,          -- weather | sleep | feeding | motivation
  priority      int  not null,
  facts         jsonb,                  -- Audit: welche Fakten führten zur Nachricht
  source        text not null default 'ai', -- ai | template_fallback
  created_at    timestamptz default now(),
  read_at       timestamptz,
  dismissed_at  timestamptz,
  acted_at      timestamptz             -- "erledigt" im In-App-Feed
);
-- RLS: user sieht nur eigene Zeilen.

create table advisor_settings (
  user_id            uuid primary key references auth.users(id),
  enabled            boolean default true,
  frequency          text default 'daily',   -- daily | critical_only | off
  themes             text[] default '{weather,sleep,feeding,motivation}',
  quiet_hours_start  int default 21,
  quiet_hours_end    int default 7,
  updated_at         timestamptz default now()
);
```

---

## 8. In-App-Teil: „Lottis Fürsorge"-Feed

- Eigener Screen / Tab-Eintrag: Verlauf aller Hinweise als Karten (Liquid-Glass-Stil wie
  *Lottis Empfehlungen*).
- Pro Karte: Emoji, Titel, Text, Zeitstempel, „Erledigt"-Häkchen (`acted_at`).
- Badge mit Anzahl ungelesener Hinweise (vorhandenes `NotificationBadge` nutzbar).
- Einstellungen: Themen an/aus, Frequenz, stille Zeiten (`advisor_settings`).
- **Premium-Gate:** Nicht-Premium sieht den Feed als Teaser (1 Beispielkarte verschwommen)
  + Upsell zur Paywall.

---

## 9. Premium-Gating

- Feature-Key `advisor` in `lib/features.ts` → `FEATURE_MIN_TIER.advisor = 'premium'`.
- Edge Function verarbeitet **nur** Nutzer mit aktivem `premium`-Entitlement
  (Check gegen Subscription-Status / RevenueCat-Webhook-gepflegte Tabelle).
- In-App-Feed + Settings hinter `canUse('advisor', tier)`.

---

## 10. Datenschutz & Haftung (Pflicht vor Launch)

- **Datenschutzerklärung** (`Datenschutz.html`) ergänzen: Standort- + Gesundheitsdaten
  werden zur Tipp-Erstellung verarbeitet, inkl. Weitergabe der **anonymisierten Fakten**
  (keine Klarnamen nötig — Babyname kann optional lokal eingesetzt werden) an den
  KI-Dienst (Anthropic). Auftragsverarbeitung / EU-Datenstandort prüfen.
- **Opt-in:** Feature beim ersten Aktivieren explizit zustimmen lassen.
- **Haftungs-Rahmung:** Jede Nachricht/der Feed trägt den Hinweis
  „Tipps, kein medizinischer Rat. Im Zweifel Hebamme oder Kinderärztin fragen."
- **Datenminimierung:** Nur die für die aktive Regel nötigen Fakten an die KI senden.

---

## 11. Build-Plan (Phasen)

**Phase 0 — Datengrundlage**
1. `getDailyForecast()` in `weatherService.ts` (One Call API: Tmax/Tmin/UV/pop).
2. Hilfsfunktionen: `ageMonths(birth_date)`, Schlaf-Soll je Alter, Mahlzeiten-Tagesschnitt.

**Phase 1 — Regel-Engine (ohne KI, voll testbar)**
3. `lib/advisor/rules.ts` — Regelkatalog (Abschnitt 4) + `evaluateSituations(signals)`.
4. `lib/advisor/select.ts` — Priorisierung, Anti-Spam, Cooldown, Theme-Filter.
5. Unit-Tests pro Regel (heiß/kalt/Kombi/Edge Cases).

**Phase 2 — Auslieferung**
6. Supabase Edge Function `advisor-daily` (Cron je Zeitzone) → Signale sammeln, Regeln,
   Template-Nachricht schreiben + Push. (Noch **ohne** KI → früh live testbar.)
7. Tabellen `advisor_messages` + `advisor_settings` + RLS.

**Phase 3 — KI-Schicht**
8. Claude-Call mit Prompt (Abschnitt 6) + Output-Validierung + Template-Fallback.

**Phase 4 — App**
9. „Lottis Fürsorge"-Feed-Screen + Badge + Settings.
10. Premium-Gate + Paywall-Teaser.
11. Onboarding/Opt-in + Datenschutz-Update.

**Phase 5 — Feinschliff**
12. A/B-Test Frequenz & Texte; Positive-Trigger ergänzen; Analytics (Öffnungs-/Erledigt-Rate).

---

## 12. Offene Entscheidungen

- **KI-Modell-Kosten** final wählen (Haiku empfohlen).
- **Babyname an KI senden?** Alternativ Platzhalter lokal ersetzen (datensparsamer).
- **Eigener Tab vs. Eintrag unter „Mehr"** für den Feed.
- **Push-Anbieter:** Expo Push direkt vs. vorhandener `notificationService`-Pfad.
- **Mehrere Kinder:** pro Baby eigene Hinweise oder gebündelt.
