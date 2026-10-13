/**
 * Lottis Fürsorge – KI-Textschicht (OpenAI).
 *
 * Formuliert den geprüften Kerninhalt einer Regel warm und persönlich um.
 * Strenger Prompt + Output-Validierung; schlägt irgendetwas fehl, liefert
 * die Funktion null und der Aufrufer nutzt das Regel-Template als Fallback.
 *
 * Benötigt das Secret OPENAI_API_KEY (sonst sofort null → Template).
 */

import type { RuleCandidate, RuleSignals } from './advisorRules.ts';
import type { SupportedLocale } from '../_shared/localization.ts';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const systemPrompt = (locale: SupportedLocale) => {
  const language = locale === 'en' ? 'English' : locale === 'es' ? 'Spanish' : 'German';
  return `You are "Lotti", a caring companion in a baby app. Write ONE short message to a parent in ${language}.

RULES:
- Use ONLY the facts and core content from the input. Do not invent medical claims, numbers, or recommendations.
- Warm, personal, respectful, never alarming.
- Address the baby by name and include age or concrete values when available.
- "headline": concise, at most 40 characters, no emoji.
- "body": at most 2 sentences and 240 characters, no emoji.
- Do not give medical advice; mention a healthcare professional only when the core content requires it.
- Respond only as JSON: {"headline": "...", "body": "..."}`;
};

export interface AiText {
  headline: string;
  body: string;
}

const looksSafe = (text: string): boolean =>
  text.length > 0 &&
  !/https?:\/\//i.test(text) &&
  !/\d+\s?(mg|ml\/kg|tropfen)/i.test(text);

/** null = KI nicht verfügbar / Output ungültig → Template-Fallback nutzen. */
export const generateAiText = async (
  candidate: RuleCandidate,
  signals: RuleSignals,
  locale: SupportedLocale = 'de',
): Promise<AiText | null> => {
  const apiKey = Deno.env.get('OPENAI_API_KEY');
  if (!apiKey) return null;

  const payload = {
    babyname: signals.babyName,
    alter: signals.ageText || null,
    ageMonths: signals.ageMonths,
    situation: candidate.ruleId,
    fakten: candidate.facts,
    kerninhalt: candidate.coreContent,
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(locale) },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    });
    clearTimeout(timeout);
    if (!res.ok) {
      console.error('OpenAI API error:', res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const text: string = data?.choices?.[0]?.message?.content ?? '';
    if (!text) return null;
    const parsed = JSON.parse(text);

    const headline = String(parsed.headline ?? '').trim();
    const body = String(parsed.body ?? '').trim();
    if (!looksSafe(headline) || !looksSafe(body)) return null;
    if (headline.length > 60 || body.length > 300) return null;

    return { headline, body };
  } catch (err) {
    console.error('OpenAI call failed:', err);
    return null;
  }
};
