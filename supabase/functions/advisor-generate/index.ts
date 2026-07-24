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
import { generateAiText } from './advisorAi.ts';

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
  babyId: string;
  /** Lokales Datum des Geräts (YYYY-MM-DD) — maßgeblich für den Tages-Upsert. */
  localDate: string;
  signals: RuleSignals;
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
    if (!body?.babyId || !body?.signals || !body?.localDate) {
      return json({ error: 'babyId, localDate and signals are required' }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.localDate)) {
      return json({ error: 'invalid localDate' }, 400);
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Zugriff: in Erprobung nur Premiumtester/Admins.
    // TODO(Premium-Abo): später zusätzlich Premium-Entitlement zulassen.
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, paywall_access_role')
      .eq('id', user.id)
      .maybeSingle();
    const hasAccess =
      profile?.is_admin === true ||
      profile?.paywall_access_role === 'premium_tester';
    if (!hasAccess) return json({ error: 'Feature not unlocked' }, 403);

    // Einstellungen (Themen, KI an/aus) + Cooldown der letzten 3 Tage laden.
    const threeDaysAgo = new Date(`${body.localDate}T00:00:00Z`);
    threeDaysAgo.setUTCDate(threeDaysAgo.getUTCDate() - 3);
    const cooldownStart = threeDaysAgo.toISOString().slice(0, 10);

    const [settingsRes, recentRes, todayRes] = await Promise.all([
      admin
        .from('advisor_settings')
        .select('themes, ai_enabled, frequency, enabled')
        .eq('user_id', user.id)
        .maybeSingle(),
      admin
        .from('advisor_messages')
        .select('rule_id, local_date')
        .eq('user_id', user.id)
        .eq('baby_id', body.babyId)
        .gte('local_date', cooldownStart)
        .lt('local_date', body.localDate),
      admin
        .from('advisor_messages')
        .select('id, rule_id, title, headline, body, emoji, tone, source, facts')
        .eq('user_id', user.id)
        .eq('baby_id', body.babyId)
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

    const candidates = evaluateRules(body.signals);
    const candidate = selectCandidate(candidates, { themes, recentRuleIds });

    // Kostenbremse: Hat sich die Regel seit dem letzten Speichern nicht
    // geändert, den bereits formulierten KI-Text wiederverwenden — kein
    // neuer KI-Call. (Admins bekommen zum Testen immer frischen Text.)
    if (
      !isAdmin &&
      todayRow &&
      todayRow.rule_id === candidate.ruleId &&
      todayRow.source === 'ai'
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
      const ai = await generateAiText(candidate, body.signals);
      if (ai) {
        headline = ai.headline;
        text = ai.body;
        source = 'ai';
        aiRuns += 1;
      }
    }

    // Heutigen Hinweis upserten — read_at/acted_at bleiben erhalten.
    const { data: saved, error: saveError } = await admin
      .from('advisor_messages')
      .upsert(
        {
          user_id: user.id,
          baby_id: body.babyId,
          local_date: body.localDate,
          rule_id: candidate.ruleId,
          title: candidate.title,
          headline,
          body: text,
          emoji: candidate.emoji,
          tone: candidate.tone,
          category: candidate.category,
          priority: candidate.priority,
          facts: { ...candidate.facts, reasons: candidate.reasons, ai_runs: aiRuns },
          source,
        },
        { onConflict: 'user_id,baby_id,local_date' },
      )
      .select('id')
      .maybeSingle();
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
