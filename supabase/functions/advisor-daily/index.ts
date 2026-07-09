// Lottis Fürsorge — täglicher Berater-Job (Cron).
//
// Wird stündlich per pg_cron aufgerufen und verarbeitet nur die Nutzer,
// bei denen es gerade ~8 Uhr Ortszeit ist (advisor_settings.timezone).
// Pro Nutzer/Baby: Signale aus der DB + Wetter sammeln, Regel-Engine,
// optional OpenAI-Formulierung, advisor_messages schreiben, Expo-Push.
//
// Secrets: ADVISOR_CRON_SECRET (Pflicht), OPENAI_API_KEY (optional, sonst
// Templates). Wetter kommt keyless von Open-Meteo (Tagesforecast inkl.
// UV-Index und Regenwahrscheinlichkeit).
//
// Test-Aufruf (verarbeitet einen Nutzer sofort, unabhängig von der Uhrzeit):
//   POST { "force": true, "userId": "<uuid>" }

// @ts-ignore - Deno edge function import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno edge function import.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import {
  evaluateRules,
  selectCandidate,
  type AdvisorCategory,
  type RuleSignals,
} from './advisorRules.ts';
import { generateAiText } from './advisorAi.ts';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const SEND_HOUR_LOCAL = 8; // Versand um ~8 Uhr Ortszeit
const HOT_THRESHOLD_C = 27;
const COLD_THRESHOLD_C = 5;

interface SettingsRow {
  user_id: string;
  enabled: boolean;
  frequency: 'daily' | 'critical_only' | 'off';
  themes: AdvisorCategory[] | null;
  quiet_hours_start: number;
  quiet_hours_end: number;
  timezone: string | null;
  latitude: number | null;
  longitude: number | null;
  ai_enabled: boolean | null;
  /** Explizites Push-Opt-in aus der App (Default false). */
  push_enabled: boolean | null;
}

/** Lokale Stunde / lokales Datum in einer IANA-Zeitzone. */
const localParts = (tz: string): { hour: number; date: string } => {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      hour12: false,
    }).formatToParts(new Date());
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return {
      hour: Number(get('hour')) % 24,
      date: `${get('year')}-${get('month')}-${get('day')}`,
    };
  } catch {
    return localParts('Europe/Berlin');
  }
};

const localDateOf = (iso: string, tz: string): string => {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
};

const ageMonthsOf = (birthDate: string | null): number | null => {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;
  const now = new Date();
  let months =
    (now.getFullYear() - birth.getFullYear()) * 12 +
    (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
};

const ageTextOf = (ageMonths: number | null): string => {
  if (ageMonths == null) return '';
  if (ageMonths < 24) return `${ageMonths} Monate alt`;
  return `${Math.floor(ageMonths / 12)} Jahre alt`;
};

/** WMO-Wettercode → kurze deutsche Beschreibung (Open-Meteo). */
const describeWeatherCode = (code: number | null): string => {
  if (code == null) return '';
  if (code === 0) return 'sonnig';
  if (code <= 2) return 'leicht bewölkt';
  if (code === 3) return 'bewölkt';
  if (code === 45 || code === 48) return 'neblig';
  if (code <= 57) return 'Nieselregen';
  if (code <= 67) return 'Regen';
  if (code <= 77) return 'Schnee';
  if (code <= 82) return 'Regenschauer';
  if (code <= 86) return 'Schneeschauer';
  return 'Gewitter';
};

/**
 * Tagesforecast von Open-Meteo (keyless): Tmax, gefühltes Maximum,
 * UV-Index-Maximum und Regenwahrscheinlichkeit für HEUTE (Ortszeit).
 * Schwellen identisch zum Client (buildDailySignals.ts).
 */
const HIGH_UV_THRESHOLD = 5;
const RAIN_PROB_THRESHOLD = 60;

const fetchWeather = async (
  lat: number,
  lon: number,
  tz: string,
): Promise<RuleSignals['weather'] | null> => {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast' +
        `?latitude=${lat}&longitude=${lon}` +
        '&daily=temperature_2m_max,apparent_temperature_max,uv_index_max,precipitation_probability_max,weather_code' +
        `&timezone=${encodeURIComponent(tz)}&forecast_days=1`,
    );
    if (!res.ok) return null;
    const data = await res.json();
    const daily = data?.daily;
    const num = (v: unknown): number | null =>
      typeof v === 'number' && Number.isFinite(v) ? v : null;
    const tmax = num(daily?.temperature_2m_max?.[0]);
    if (tmax == null) return null;
    const feelsMax = num(daily?.apparent_temperature_max?.[0]) ?? tmax;
    const uvRaw = num(daily?.uv_index_max?.[0]);
    const uvIndex = uvRaw != null ? Math.round(uvRaw * 10) / 10 : null;
    const rainProbability = num(daily?.precipitation_probability_max?.[0]);
    return {
      available: true,
      temperature: Math.round(tmax),
      feelsLike: Math.round(feelsMax),
      description: describeWeatherCode(num(daily?.weather_code?.[0])),
      isHot: tmax >= HOT_THRESHOLD_C || feelsMax >= HOT_THRESHOLD_C + 2,
      isCold: tmax <= COLD_THRESHOLD_C || feelsMax <= 0,
      isReal: true,
      uvIndex,
      rainProbability,
      isHighUv: uvIndex != null && uvIndex >= HIGH_UV_THRESHOLD,
      isRainy: rainProbability != null && rainProbability >= RAIN_PROB_THRESHOLD,
    };
  } catch (err) {
    console.error('Weather fetch failed:', err);
    return null;
  }
};

serve(async (req: Request) => {
  // Zugriffsschutz: nur der Cron-Job (bzw. du beim Testen) kennt das Secret.
  const secret = Deno.env.get('ADVISOR_CRON_SECRET');
  if (!secret || req.headers.get('x-advisor-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), { status: 403 });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let force = false;
  let onlyUserId: string | null = null;
  try {
    const body = await req.json();
    force = body?.force === true;
    onlyUserId = typeof body?.userId === 'string' ? body.userId : null;
  } catch {
    // leerer Body (Cron) ist okay
  }

  let query = supabase
    .from('advisor_settings')
    .select(
      'user_id, enabled, frequency, themes, quiet_hours_start, quiet_hours_end, timezone, latitude, longitude, ai_enabled, push_enabled',
    )
    .eq('enabled', true)
    .neq('frequency', 'off');
  if (onlyUserId) query = query.eq('user_id', onlyUserId);

  const { data: allSettings, error: settingsError } = await query;
  if (settingsError) {
    console.error('Failed to load advisor_settings:', settingsError);
    return new Response(JSON.stringify({ error: 'settings query failed' }), {
      status: 500,
    });
  }

  const results: Record<string, string> = {};

  for (const settings of (allSettings ?? []) as SettingsRow[]) {
    try {
      const tz = settings.timezone || 'Europe/Berlin';
      const { hour: localHour, date: localDate } = localParts(tz);

      // Nur im 8-Uhr-Fenster der jeweiligen Zeitzone verarbeiten.
      if (!force && localHour !== SEND_HOUR_LOCAL) continue;

      // Zugriff: in Erprobung nur Premiumtester/Admins.
      // TODO(Premium-Abo): später zusätzlich Premium-Entitlement zulassen.
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, paywall_access_role')
        .eq('id', settings.user_id)
        .maybeSingle();
      const hasAccess =
        profile?.is_admin === true ||
        profile?.paywall_access_role === 'premium_tester';
      if (!hasAccess) {
        results[settings.user_id] = 'no_access';
        continue;
      }

      // Babys des Nutzers (Mehrbaby-Support via baby_members).
      const { data: memberRows } = await supabase
        .from('baby_members')
        .select('baby_id')
        .eq('user_id', settings.user_id);
      let babyIds: string[] = (memberRows ?? []).map(
        (r: { baby_id: string }) => r.baby_id,
      );
      if (babyIds.length === 0) {
        const { data: ownRows } = await supabase
          .from('baby_info')
          .select('id')
          .eq('user_id', settings.user_id);
        babyIds = (ownRows ?? []).map((r: { id: string }) => r.id);
      }
      if (babyIds.length === 0) {
        results[settings.user_id] = 'no_baby';
        continue;
      }

      // Wetter einmal pro Nutzer (Standort ist nutzer-, nicht babybezogen).
      const weather =
        settings.latitude != null && settings.longitude != null
          ? await fetchWeather(settings.latitude, settings.longitude, tz)
          : null;

      for (const babyId of babyIds) {
        // Heute schon ein Hinweis (z. B. via advisor-generate)? Dann nichts tun.
        const { data: existing } = await supabase
          .from('advisor_messages')
          .select('id')
          .eq('user_id', settings.user_id)
          .eq('baby_id', babyId)
          .eq('local_date', localDate)
          .maybeSingle();
        if (existing) {
          results[`${settings.user_id}/${babyId}`] = 'already_exists';
          continue;
        }

        const { data: baby } = await supabase
          .from('baby_info')
          .select('id, name, birth_date')
          .eq('id', babyId)
          .maybeSingle();
        const ageMonths = ageMonthsOf(baby?.birth_date ?? null);

        // Care-Einträge der letzten 21 Tage: heutige Werte + Feeding-Profil
        // (Fütter-Modus, letzte Mahlzeit, eigene Baseline) in einer Abfrage.
        // Bewusst nur nach baby_id gefiltert (Service-Role): So zählen auch
        // die Einträge des Partners für dasselbe Baby mit.
        const since = new Date(Date.now() - 21 * 86_400_000).toISOString();
        const { data: careEntries } = await supabase
          .from('baby_care_entries')
          .select('entry_type, feeding_type, diaper_type, start_time')
          .eq('baby_id', babyId)
          .gte('start_time', since);
        type CareRow = {
          entry_type: string;
          feeding_type: string | null;
          diaper_type: string | null;
          start_time: string;
        };
        const care = (careEntries ?? []) as CareRow[];
        const feedings = care.filter((e) => e.entry_type === 'feeding');
        const todayFeedings = feedings.filter(
          (e) => localDateOf(e.start_time, tz) === localDate,
        );
        const countType = (list: CareRow[], ...types: string[]) =>
          list.filter((e) => types.includes(e.feeding_type ?? '')).length;

        const breast21 = countType(feedings, 'BREAST');
        const bottle21 = countType(feedings, 'BOTTLE', 'PUMP');
        const solids21 = countType(feedings, 'SOLIDS');
        const likelyFeedingMode =
          breast21 > 0 && bottle21 > 0
            ? ('mixed' as const)
            : breast21 > 0
              ? ('breast' as const)
              : bottle21 > 0
                ? ('bottle' as const)
                : solids21 > 0
                  ? ('solids' as const)
                  : ('unknown' as const);

        const latestOf = (list: CareRow[]): Date | null =>
          list.reduce((latest: Date | null, e) => {
            const d = new Date(e.start_time);
            if (Number.isNaN(d.getTime())) return latest;
            return !latest || d > latest ? d : latest;
          }, null);
        const lastFeeding = latestOf(feedings);
        const lastBreast = latestOf(
          feedings.filter((e) => e.feeding_type === 'BREAST'),
        );
        const nowMs = Date.now();

        // Eigene Baseline: Ø Mahlzeiten/Tag der letzten 14 Tage (ohne heute),
        // nur Tage mit Einträgen; ab 3 solchen Tagen aussagekräftig.
        const perDay = new Map<string, number>();
        for (const e of feedings) {
          const day = localDateOf(e.start_time, tz);
          if (day === localDate) continue;
          if (nowMs - new Date(e.start_time).getTime() > 14 * 86_400_000) continue;
          perDay.set(day, (perDay.get(day) ?? 0) + 1);
        }
        const typicalPerDay =
          perDay.size >= 3
            ? Array.from(perDay.values()).reduce((a, b) => a + b, 0) / perDay.size
            : null;

        const todayDiapers = care.filter(
          (e) =>
            e.entry_type === 'diaper' &&
            localDateOf(e.start_time, tz) === localDate,
        );
        const wetDiapers = todayDiapers.filter(
          (e) => e.diaper_type === 'WET' || e.diaper_type === 'BOTH',
        );
        const lastWet = latestOf(wetDiapers);

        // Schlaf, der heute (Ortszeit) geendet oder begonnen hat — damit
        // zählt der Nachtschlaf von gestern Abend bis heute Morgen mit,
        // aber nicht mehr das gestrige Nickerchen.
        // Tabelle heißt `sleep_entries` (das Rename auf _new wurde nie
        // scharfgeschaltet) und wird pro Baby gefiltert.
        const sleepSince = new Date(Date.now() - 36 * 3600_000).toISOString();
        const { data: sleepEntries } = await supabase
          .from('sleep_entries')
          .select('duration_minutes, start_time, end_time')
          .eq('baby_id', babyId)
          .gte('start_time', sleepSince);
        const sleepMinutes = (sleepEntries ?? []).reduce(
          (sum: number, e: { duration_minutes: number | null; start_time: string; end_time: string | null }) => {
            const endsToday =
              !!e.end_time && localDateOf(e.end_time, tz) === localDate;
            const startsToday = localDateOf(e.start_time, tz) === localDate;
            if (!endsToday && !startsToday) return sum;
            if (typeof e.duration_minutes === 'number' && e.duration_minutes > 0) {
              return sum + e.duration_minutes;
            }
            if (e.end_time) {
              const ms = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
              if (ms > 0) return sum + Math.round(ms / 60_000);
            }
            return sum;
          },
          0,
        );

        const signals: RuleSignals = {
          babyName: baby?.name?.trim() || 'dein Baby',
          ageMonths,
          ageText: ageTextOf(ageMonths),
          feeding: {
            totalCount: todayFeedings.length,
            isReal: true,
            bottleCount: countType(todayFeedings, 'BOTTLE', 'PUMP'),
            breastCount: countType(todayFeedings, 'BREAST'),
            solidsCount: countType(todayFeedings, 'SOLIDS'),
            waterCount: countType(todayFeedings, 'WATER'),
            lastFeedingAt: lastFeeding ? lastFeeding.toISOString() : null,
            hoursSinceLastFeeding: lastFeeding
              ? Math.round(((nowMs - lastFeeding.getTime()) / 3_600_000) * 10) / 10
              : null,
            lastBreastAt: lastBreast ? lastBreast.toISOString() : null,
            daysSinceLastBreast: lastBreast
              ? Math.floor((nowMs - lastBreast.getTime()) / 86_400_000)
              : null,
            breastCountLast21Days: breast21,
            bottleCountLast21Days: bottle21,
            solidsCountLast21Days: solids21,
            likelyFeedingMode,
            typicalPerDay,
          },
          diaper: {
            count: todayDiapers.length,
            isReal: true,
            wetCountToday: wetDiapers.length,
            lastWetAt: lastWet ? lastWet.toISOString() : null,
          },
          sleep: { minutes: sleepMinutes, isReal: sleepMinutes > 0 },
          weather: weather ?? {
            available: false,
            temperature: null,
            feelsLike: null,
            description: '',
            isHot: false,
            isCold: false,
            isReal: false,
          },
        };

        // Cooldown: Regeln der letzten 3 Tage nicht wiederholen.
        const cooldownStart = new Date(Date.now() - 3 * 86_400_000)
          .toISOString()
          .slice(0, 10);
        const { data: recent } = await supabase
          .from('advisor_messages')
          .select('rule_id')
          .eq('user_id', settings.user_id)
          .eq('baby_id', babyId)
          .gte('local_date', cooldownStart);
        const recentRuleIds = (recent ?? []).map(
          (r: { rule_id: string }) => r.rule_id,
        );

        const candidate = selectCandidate(evaluateRules(signals), {
          themes: settings.themes,
          recentRuleIds,
        });

        // „Nur Wichtiges": bei niedriger Priorität weder speichern noch pushen.
        if (settings.frequency === 'critical_only' && candidate.priority > 2) {
          results[`${settings.user_id}/${babyId}`] = 'skipped_not_critical';
          continue;
        }

        // Text: OpenAI (optional) oder Template.
        let headline = candidate.headline;
        let text = candidate.body;
        let source = 'rules';
        if (settings.ai_enabled !== false) {
          const ai = await generateAiText(candidate, signals);
          if (ai) {
            headline = ai.headline;
            text = ai.body;
            source = 'ai';
          }
        }

        // Push? Nur mit explizitem Opt-in (push_enabled), all_good ist nur
        // In-App, kein Push. Stille Zeiten beachten.
        const quietStart = settings.quiet_hours_start ?? 21;
        const quietEnd = settings.quiet_hours_end ?? 7;
        const inQuietHours =
          quietStart > quietEnd
            ? localHour >= quietStart || localHour < quietEnd
            : localHour >= quietStart && localHour < quietEnd;
        const wantsPush =
          settings.push_enabled === true &&
          candidate.priority <= 4 &&
          candidate.ruleId !== 'all_good';

        let pushStatus = settings.push_enabled === true ? 'skipped' : 'opt_out';
        let pushedAt: string | null = null;
        if (wantsPush && !inQuietHours) {
          const { data: tokens } = await supabase
            .from('user_push_tokens')
            .select('token')
            .eq('user_id', settings.user_id);
          if (!tokens || tokens.length === 0) {
            pushStatus = 'no_token';
          } else {
            const messages = tokens.map((t: { token: string }) => ({
              to: t.token,
              sound: 'default',
              title: `${candidate.emoji} ${headline}`,
              body: text,
              data: { type: 'advisor_message', babyId, ruleId: candidate.ruleId },
            }));
            const pushRes = await fetch(EXPO_PUSH_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(messages),
            });
            pushStatus = pushRes.ok ? 'sent' : 'error';
            if (pushRes.ok) pushedAt = new Date().toISOString();
            else console.error('Expo push failed:', await pushRes.text());
          }
        } else if (wantsPush && inQuietHours) {
          pushStatus = 'quiet_hours';
        }

        const { error: insertError } = await supabase.from('advisor_messages').upsert(
          {
            user_id: settings.user_id,
            baby_id: babyId,
            local_date: localDate,
            rule_id: candidate.ruleId,
            title: candidate.title,
            headline,
            body: text,
            emoji: candidate.emoji,
            tone: candidate.tone,
            category: candidate.category,
            priority: candidate.priority,
            facts: { ...candidate.facts, reasons: candidate.reasons },
            source,
            pushed_at: pushedAt,
            push_status: pushStatus,
          },
          { onConflict: 'user_id,baby_id,local_date' },
        );
        if (insertError) {
          console.error('advisor_messages upsert failed:', insertError);
          results[`${settings.user_id}/${babyId}`] = 'save_error';
        } else {
          results[`${settings.user_id}/${babyId}`] =
            `${candidate.ruleId} (${source}, push: ${pushStatus})`;
        }
      }
    } catch (err) {
      console.error(`Failed for user ${settings.user_id}:`, err);
      results[settings.user_id] = 'error';
    }
  }

  return new Response(JSON.stringify({ processed: results }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
