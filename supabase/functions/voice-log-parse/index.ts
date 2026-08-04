// Sprach-Logging (Premium) — nimmt eine kurze Sprachaufnahme entgegen,
// transkribiert sie (OpenAI Whisper) und extrahiert daraus strukturierte
// Baby-Einträge (Schlaf / Füttern / Windel) als Vorschläge.
//
// Die Function speichert selbst NICHTS: Die App zeigt die erkannten
// Einträge zur Bestätigung an und schreibt sie erst danach über die
// normalen Client-Pfade (RLS-sauber) in die Datenbank.
//
// Auth: normaler Nutzer-JWT (supabase.functions.invoke aus der App).
// Benötigt das Secret OPENAI_API_KEY.

// @ts-ignore - Deno edge function import.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-ignore - Deno edge function import.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { localize, normalizeLocale, SupportedLocale } from '../_shared/localization.ts';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const OPENAI_TRANSCRIBE_URL = 'https://api.openai.com/v1/audio/transcriptions';
const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';
const TRANSCRIBE_MODEL = 'whisper-1';
const PARSE_MODEL = 'gpt-4o-mini';

/** Base64-Limit ≈ 4 MB Audio — deckt die 60s-Client-Aufnahme großzügig ab. */
const MAX_AUDIO_BASE64_LENGTH = 6_000_000;
const MAX_ENTRIES = 10;

// Rate-Limit pro Nutzer (Kostenschutz: jeder Aufruf kostet Whisper + GPT).
// Gezählt werden Versuche (voice_log_requests), nicht nur Erfolge — sonst
// ließe sich das Limit durch absichtlich fehlschlagende Requests umgehen.
const RATE_LIMITS = [
  {
    windowMinutes: 10,
    max: 6,
    messageKey: 'short',
  },
  {
    windowMinutes: 24 * 60,
    max: 40,
    messageKey: 'daily',
  },
] as const;

const rateLimitMessage = (locale: SupportedLocale, key: 'short' | 'daily') => {
  if (key === 'short') return localize(locale, {
    de: 'Kurze Pause 🙂 Du hast gerade viele Aufnahmen gemacht. Bitte versuche es in ein paar Minuten noch einmal.',
    en: 'Quick break 🙂 You have made several recordings. Please try again in a few minutes.',
    es: 'Una breve pausa 🙂 Has hecho varias grabaciones. Vuelve a intentarlo en unos minutos.',
  });
  return localize(locale, {
    de: 'Das Tageslimit für Sprach-Einträge ist erreicht. Morgen geht es weiter — Einträge kannst du weiterhin manuell anlegen.',
    en: 'You have reached today’s voice-entry limit. You can continue tomorrow or add entries manually.',
    es: 'Has alcanzado el límite diario de registros por voz. Puedes continuar mañana o añadir registros manualmente.',
  });
};

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

interface ParseRequest {
  /** Aufnahme als Base64 (ohne data:-Prefix). */
  audioBase64: string;
  /** z. B. 'audio/mp4' (expo-audio HIGH_QUALITY). */
  mimeType: string;
  /** Lokale Gerätezeit 'YYYY-MM-DDTHH:mm' — Referenz für relative Zeitangaben. */
  deviceNow: string;
  babyName?: string | null;
  locale?: string;
  /** Aus den letzten fünf Einträgen des aktiven Babys abgeleiteter Vorschlag. */
  recentMilkPreference?: 'BREAST' | 'BOTTLE' | null;
}

type EntryType = 'sleep' | 'feeding' | 'diaper';

interface ParsedEntry {
  type: EntryType;
  start_local: string;
  end_local: string | null;
  feeding_type: 'BREAST' | 'BOTTLE' | 'SOLIDS' | 'PUMP' | 'WATER' | null;
  feeding_type_needs_confirmation: boolean;
  timer_requested: boolean;
  feeding_volume_ml: number | null;
  feeding_side: 'LEFT' | 'RIGHT' | 'BOTH' | null;
  diaper_type: 'WET' | 'DIRTY' | 'BOTH' | null;
  note: string | null;
}

const LOCAL_TIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const FEEDING_TYPES = new Set(['BREAST', 'BOTTLE', 'SOLIDS', 'PUMP', 'WATER']);
const FEEDING_SIDES = new Set(['LEFT', 'RIGHT', 'BOTH']);
const DIAPER_TYPES = new Set(['WET', 'DIRTY', 'BOTH']);

const buildSystemPrompt = (
  deviceNow: string,
  babyName?: string | null,
  recentMilkPreference?: 'BREAST' | 'BOTTLE' | null,
  locale: SupportedLocale = 'de',
) =>
  `Extract baby-tracking entries from a parent's transcribed voice note in ${locale === 'en' ? 'English' : locale === 'es' ? 'Spanish' : 'German'}.
Current local device time: ${deviceNow}${babyName ? `\nThe baby's name is ${babyName}.` : ''}
Preferred milk-feeding method from recent entries: ${recentMilkPreference ?? 'unknown'}.

Respond only as JSON: {"entries": [ ... ]}

Every entry has exactly these fields:
- "type": "sleep", "feeding", or "diaper".
- "start_local": start as "YYYY-MM-DDTHH:mm". Resolve relative times from the current device time. If no time is given, use the current time. Waking after a stated duration means end = now and start = now minus that duration.
- "end_local": end as "YYYY-MM-DDTHH:mm" or null. Diaper entries never have an end; an explicitly ongoing activity has no end yet.
- "feeding_type": for feeding only: "BREAST", "BOTTLE", "SOLIDS", "PUMP", or "WATER"; otherwise null.
- "feeding_type_needs_confirmation": true only when milk feeding is clear but breast versus bottle is ambiguous. Then use the preferred method above, or null if unknown. False for explicit wording.
- "timer_requested": true ONLY when the parent explicitly asks for a running timer or says an activity is happening now. Then "end_local" must be null. Past or unspecific entries always use false. A missing end time alone never implies a timer.
- "feeding_volume_ml": amount in ml as a number or null.
- "feeding_side": for breastfeeding only: "LEFT", "RIGHT", or "BOTH"; otherwise null.
- "diaper_type": for diapers only: "WET", "DIRTY", or "BOTH"; if details are missing, use "WET".
- "note": brief extra information that fits no other field, written in the same language as the voice note; otherwise null.

Rules:
- Do not invent anything. Extract only entries clearly stated in the note.
- "timer_requested" defaults to false. Explicit words for breast or bottle override the recent preference. A concrete ml amount implies a bottle. Generic milk or feeding wording is ambiguous and needs confirmation.
- One note may contain multiple entries.
- If the note contains no baby-tracking information, return {"entries": []}.`;

const sanitizeEntries = (
  raw: unknown,
  recentMilkPreference: 'BREAST' | 'BOTTLE' | null,
): ParsedEntry[] => {
  if (!Array.isArray(raw)) return [];
  const entries: ParsedEntry[] = [];
  for (const item of raw.slice(0, MAX_ENTRIES)) {
    if (!item || typeof item !== 'object') continue;
    const e = item as Record<string, unknown>;
    const type = e.type;
    if (type !== 'sleep' && type !== 'feeding' && type !== 'diaper') continue;
    if (typeof e.start_local !== 'string' || !LOCAL_TIME_RE.test(e.start_local)) continue;

    const endLocal =
      typeof e.end_local === 'string' && LOCAL_TIME_RE.test(e.end_local)
        ? e.end_local
        : null;
    const volume =
      typeof e.feeding_volume_ml === 'number' &&
      isFinite(e.feeding_volume_ml) &&
      e.feeding_volume_ml > 0
        ? Math.min(Math.round(e.feeding_volume_ml), 2000)
        : null;

    const parsedFeedingType =
      type === 'feeding' && typeof e.feeding_type === 'string' && FEEDING_TYPES.has(e.feeding_type)
        ? (e.feeding_type as ParsedEntry['feeding_type'])
        : null;
    const feedingTypeNeedsConfirmation =
      type === 'feeding' &&
      e.feeding_type_needs_confirmation === true &&
      (parsedFeedingType === null ||
        parsedFeedingType === 'BREAST' ||
        parsedFeedingType === 'BOTTLE');
    const timerRequested =
      type !== 'diaper' && e.timer_requested === true && endLocal === null;

    entries.push({
      type,
      start_local: e.start_local,
      end_local: endLocal,
      feeding_type: feedingTypeNeedsConfirmation
        ? recentMilkPreference
        : parsedFeedingType,
      feeding_type_needs_confirmation: feedingTypeNeedsConfirmation,
      timer_requested: timerRequested,
      feeding_volume_ml: type === 'feeding' ? volume : null,
      feeding_side:
        type === 'feeding' && typeof e.feeding_side === 'string' && FEEDING_SIDES.has(e.feeding_side)
          ? (e.feeding_side as ParsedEntry['feeding_side'])
          : null,
      diaper_type:
        type === 'diaper'
          ? typeof e.diaper_type === 'string' && DIAPER_TYPES.has(e.diaper_type)
            ? (e.diaper_type as ParsedEntry['diaper_type'])
            : 'WET'
          : null,
      note:
        typeof e.note === 'string' && e.note.trim().length > 0
          ? e.note.trim().slice(0, 300)
          : null,
    });
  }
  return entries;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAiKey) return json({ error: 'Voice logging is not configured' }, 503);

    // Nutzer aus dem JWT auflösen (kein Vertrauen in den Body).
    const authHeader = req.headers.get('Authorization') ?? '';
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await authClient.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = (await req.json()) as ParseRequest;
    const locale = normalizeLocale(body.locale);
    if (!body?.audioBase64 || !body?.mimeType || !body?.deviceNow) {
      return json({ error: 'audioBase64, mimeType and deviceNow are required' }, 400);
    }
    if (!LOCAL_TIME_RE.test(body.deviceNow)) {
      return json({ error: 'invalid deviceNow' }, 400);
    }
    if (body.audioBase64.length > MAX_AUDIO_BASE64_LENGTH) {
      return json({ error: 'audio too large' }, 413);
    }
    const recentMilkPreference =
      body.recentMilkPreference === 'BREAST' || body.recentMilkPreference === 'BOTTLE'
        ? body.recentMilkPreference
        : null;

    // Zugriff: Premium-Feature — aktuell Premiumtester/Admins.
    // TODO(Premium-Abo): später zusätzlich Premium-Entitlement zulassen.
    const admin = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await admin
      .from('profiles')
      .select('is_admin, paywall_access_role')
      .eq('id', user.id)
      .maybeSingle();
    const hasAccess =
      profile?.is_admin === true ||
      profile?.paywall_access_role === 'premium_tester';
    if (!hasAccess) return json({ error: 'Feature not unlocked' }, 403);

    // Rate-Limit: Versuche im größten Fenster laden und beide Fenster in
    // Code auszählen (eine Query statt zwei).
    const maxWindowMinutes = Math.max(...RATE_LIMITS.map((l) => l.windowMinutes));
    const since = new Date(Date.now() - maxWindowMinutes * 60_000).toISOString();
    const { data: recentRequests, error: usageError } = await admin
      .from('voice_log_requests')
      .select('created_at')
      .eq('user_id', user.id)
      .gte('created_at', since);
    if (usageError) {
      // Bewusst fail-closed: ohne funktionierendes Limit keine OpenAI-Kosten riskieren.
      console.error('Rate limit check failed:', usageError);
      return json({ error: 'Service temporarily unavailable' }, 503);
    }
    for (const limit of RATE_LIMITS) {
      const windowStart = Date.now() - limit.windowMinutes * 60_000;
      const used = (recentRequests ?? []).filter(
        (r) => new Date(r.created_at).getTime() >= windowStart,
      ).length;
      if (used >= limit.max) {
        return json({ error: 'rate_limited', message: rateLimitMessage(locale, limit.messageKey) }, 429);
      }
    }
    const { error: logError } = await admin
      .from('voice_log_requests')
      .insert({ user_id: user.id });
    if (logError) {
      console.error('Rate limit logging failed:', logError);
      return json({ error: 'Service temporarily unavailable' }, 503);
    }

    // 1) Transkription (Whisper).
    const binary = atob(body.audioBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

    const extension = body.mimeType.includes('webm') ? 'webm' : 'm4a';
    const form = new FormData();
    form.append('file', new Blob([bytes], { type: body.mimeType }), `voice-log.${extension}`);
    form.append('model', TRANSCRIBE_MODEL);
    form.append('language', locale);

    const transcribeController = new AbortController();
    const transcribeTimeout = setTimeout(() => transcribeController.abort(), 30_000);
    const transcribeRes = await fetch(OPENAI_TRANSCRIBE_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: form,
      signal: transcribeController.signal,
    }).finally(() => clearTimeout(transcribeTimeout));

    if (!transcribeRes.ok) {
      console.error('Transcription failed:', transcribeRes.status, await transcribeRes.text());
      return json({ error: 'transcription failed' }, 502);
    }
    const transcript = ((await transcribeRes.json())?.text ?? '').trim();
    if (!transcript) {
      return json({ transcript: '', entries: [] });
    }

    // 2) Strukturierte Einträge extrahieren.
    const chatController = new AbortController();
    const chatTimeout = setTimeout(() => chatController.abort(), 20_000);
    const chatRes = await fetch(OPENAI_CHAT_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: PARSE_MODEL,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: buildSystemPrompt(
              body.deviceNow,
              body.babyName,
              recentMilkPreference,
              locale,
            ),
          },
          { role: 'user', content: transcript },
        ],
      }),
      signal: chatController.signal,
    }).finally(() => clearTimeout(chatTimeout));

    if (!chatRes.ok) {
      console.error('Parsing failed:', chatRes.status, await chatRes.text());
      return json({ error: 'parsing failed' }, 502);
    }

    let parsed: unknown = null;
    try {
      const content = (await chatRes.json())?.choices?.[0]?.message?.content ?? '';
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error('Invalid parser output:', parseError);
      return json({ error: 'parsing failed' }, 502);
    }

    const entries = sanitizeEntries(
      (parsed as { entries?: unknown })?.entries,
      recentMilkPreference,
    );
    return json({ transcript, entries });
  } catch (error) {
    console.error('voice-log-parse error:', error);
    return json({ error: 'Internal error' }, 500);
  }
});
