// Lottis Fürsorge — On-Demand-Analyse beim Öffnen der Seite.
//
// Die App sammelt die Tagessignale lokal (buildDailySignals) und schickt sie
// hierher. Die Function wählt per Regel-Engine den wichtigsten Hinweis,
// lässt ihn optional von OpenAI warm formulieren (Template-Fallback) und
// speichert ihn als heutigen Eintrag in advisor_messages.
//
// Auth: normaler Nutzer-JWT (supabase.functions.invoke aus der App).

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
import { generateAiText, generatePregnancyAiText } from './advisorAi.ts';
import {
  evaluatePregnancyRules,
  selectPregnancyCandidate,
  type PregnancyRuleSignals,
} from './pregnancyRules.ts';
import { localizeAdvisorCandidate } from '../_shared/advisorLocalization.ts';
import { normalizeLocale } from '../_shared/localization.ts';
import { verifySubscriptionFeatureAccess } from '../_shared/premiumAccess.ts';

declare const Deno: { env: { get: (key: string) => string | undefined } };

/** Max. KI-Formulierungen pro Nutzer/Baby/Tag (Admins ausgenommen). */
const MAX_AI_RUNS_PER_DAY = 3;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });

interface GenerateRequest {
  /** 'pregnancy' = noch kein Baby; Hinweis wird mit baby_id = NULL gespeichert. */
  mode?: 'baby' | 'pregnancy';
  babyId?: string;
  locale?: string;
  /** Lokales Datum des Geräts (YYYY-MM-DD) — maßgeblich für den Tages-Upsert. */
  localDate: string;
  signals: RuleSignals | PregnancyRuleSignals;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Nutzer aus dem JWT auflösen (RLS-sauber, kein Vertrauen in den Body).
    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as GenerateRequest;
    const isPregnancy = body?.mode === 'pregnancy';
    // Schwangerschaft: kein Baby → Zeilen laufen über baby_id IS NULL.
    const babyId: string | null = isPregnancy ? null : (body?.babyId ?? null);
    if ((!isPregnancy && !babyId) || !body?.signals || !body?.localDate) {
      return json({ error: 'babyId, localDate and signals are required' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) {
      return json({ error: 'invalid localDate' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const locale = normalizeLocale(body.locale);

    const featureAccess = await verifySubscriptionFeatureAccess(
      admin,
      user.id,
      'fuersorge',
      Deno.env.get('REVENUECAT_SECRET_API_KEY'),
      Deno.env.get('REVENUECAT_PROJECT_ID'),
      {
        premium: Deno.env.get('REVENUECAT_PREMIUM_ENTITLEMENT_ID'),
        standard: Deno.env.get('REVENUECAT_STANDARD_ENTITLEMENT_ID'),
        lite: Deno.env.get('REVENUECAT_LITE_ENTITLEMENT_ID'),
      },
    );
    if (!featureAccess.allowed) {
      return json(
        { error: featureAccess.reason === 'unavailable' ? 'Subscription check unavailable' : 'Feature not unlocked' },
        featureAccess.reason === 'unavailable' ? 503 : 403,
      );
    }

    // Wird zusätzlich für die bestehende Admin-Ausnahme am KI-Tageslimit benötigt.
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, paywall_access_role')
      .eq('id', user.id)
      .maybeSingle();

    // Einstellungen (Themen, KI an/aus) + Cooldown der letzten 3 Tage laden.
    const threeDaysAgo = new Date(`${body.localDate}T00:00:00Z`);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    const cooldownStart = threeDaysAgo.toISOString().slice(0, 10);

    const scopeBaby = (query: any) =>
      babyId ? query.eq('baby_id', babyId) : query.is('baby_id', null);
    const [settingsRes, recentRes, todayRes] = await Promise.all([
      admin
        .from('advisor_settings')
        .select('themes, ai_enabled, frequency, enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
      scopeBaby(
        admin
          .from('advisor_messages')
          .select('rule_id, local_date')
          .eq('user_id', user.id),
      )
        .gte('local_date', cooldownStart)
        .lt('local_date', body.localDate),
      scopeBaby(
        admin
          .from('advisor_messages')
          .select('id, rule_id, title, headline, body, emoji, tone, source, facts')
          .eq('user_id', user.id),
      )
        .eq('local_date', body.localDate)
        .maybeSingle(),
    ]);

    const settings = settingsRes.data;
    const themes = (settings?.themes ?? null) as AdvisorCategory[] | null;
    const recentRuleIds = (recentRes.data ?? []).map(
      (r: { rule_id: string }) => r.rule_id,
    );
    const todayRow = todayRes.data;
    const isAdmin = profile?.is_admin === true;

    // Baby: Regeln + nachträgliche Lokalisierung. Schwangerschaft: Regeln
    // liefern bereits lokalisierte Texte (gemeinsame Quelle mit der App).
    const candidate = isPregnancy
      ? selectPregnancyCandidate(
          evaluatePregnancyRules(body.signals as PregnancyRuleSignals, locale),
          { themes, recentRuleIds },
        )
      : localizeAdvisorCandidate(
          selectCandidate(evaluateRules(body.signals as RuleSignals), {
            themes,
            recentRuleIds,
          }),
          body.signals as RuleSignals,
          locale,
        );

    // Kostenbremse: Hat sich die Regel seit dem letzten Speichern nicht
    // geändert, den bereits formulierten KI-Text wiederverwenden — kein
    // neuer KI-Call. (Admins bekommen zum Testen immer frischen Text.)
    if (
      !isAdmin &&
      todayRow &&
      todayRow.rule_id === candidate.ruleId &&
      todayRow.source === 'ai' &&
      (todayRow.facts as { locale?: string } | null)?.locale === locale
    ) {
      return json({
        main: {
          id: todayRow.rule_id,
          tone: todayRow.tone ?? candidate.tone,
          emoji: todayRow.emoji ?? candidate.emoji,
          title: todayRow.title ?? candidate.title,
          headline: todayRow.headline,
          body: todayRow.body,
        },
        reasons: candidate.reasons,
        source: 'ai',
        persisted: true,
        messageId: todayRow.id,
      });
    }

    // KI-Formulierung (optional) mit Template-Fallback.
    // Max. MAX_AI_RUNS_PER_DAY Formulierungen pro Tag (Admins ausgenommen).
    const aiRunsToday = Number((todayRow?.facts as any)?.ai_runs ?? 0) || 0;
    const underCap = isAdmin || aiRunsToday < MAX_AI_RUNS_PER_DAY;
    let aiRuns = aiRunsToday;
    let headline = candidate.headline;
    let text = candidate.body;
    let source = 'rules';
    if (settings?.ai_enabled !== false && underCap) {
      const ai = isPregnancy
        ? await generatePregnancyAiText(
            candidate as any,
            body.signals as PregnancyRuleSignals,
            locale,
          )
        : await generateAiText(candidate as any, body.signals as RuleSignals, locale);
      if (ai) {
        headline = ai.headline;
        text = ai.body;
        source = 'ai';
        aiRuns += 1;
      }
    }

    // Heutigen Hinweis upserten — read_at/acted_at bleiben erhalten.
    const row = {
      user_id: user.id,
      baby_id: babyId,
      local_date: body.localDate,
      rule_id: candidate.ruleId,
      title: candidate.title,
      headline,
      body: text,
      emoji: candidate.emoji,
      tone: candidate.tone,
      category: candidate.category,
      priority: candidate.priority,
      facts: {
        ...(candidate.facts as Record<string, unknown>),
        reasons: candidate.reasons,
        ai_runs: aiRuns,
        locale,
      },
      source,
    };
    let saved: { id: string } | null = null;
    let saveError: unknown = null;
    if (babyId) {
      const result = await admin
        .from('advisor_messages')
        .upsert(row, { onConflict: 'user_id,baby_id,local_date' })
        .select('id')
        .maybeSingle();
      saved = result.data;
      saveError = result.error;
    } else if (todayRow?.id) {
      // Upsert greift bei NULL im Konflikt-Ziel nicht → Update der Tageszeile.
      const result = await admin
        .from('advisor_messages')
        .update(row)
        .eq('id', todayRow.id)
        .select('id')
        .maybeSingle();
      saved = result.data;
      saveError = result.error;
    } else {
      const result = await admin
        .from('advisor_messages')
        .insert(row)
        .select('id')
        .maybeSingle();
      saved = result.data;
      saveError = result.error;
    }
    if (saveError) console.error('advisor_messages upsert failed:', saveError);

    return json({
      main: {
        id: candidate.ruleId,
        tone: candidate.tone,
        emoji: candidate.emoji,
        title: candidate.title,
        headline,
        body: text,
      },
      reasons: candidate.reasons,
      source,
      persisted: !saveError,
      messageId: saved?.id ?? null,
    });
  } catch (err) {
    console.error('advisor-generate error:', err);
    return json({ error: 'Internal error' }, 500);
  }
});
