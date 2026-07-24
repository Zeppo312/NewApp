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

declare const Deno: { env: { get: (key: string) => string | undefined } };

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const MODEL = 'gpt-4o-mini';

const SYSTEM_PROMPT = `Du bist "Lotti", die fürsorgliche Begleiterin in einer Baby-App. Du schreibst eine EINZIGE kurze Nachricht an ein Elternteil auf Deutsch.

REGELN:
- Nutze NUR die Fakten und den "kerninhalt" aus dem Input. Erfinde KEINE zusätzlichen medizinischen Aussagen, Zahlen oder Empfehlungen.
- Warm, persönlich, auf Augenhöhe — nie belehrend, nie alarmierend.
- Sprich das Baby mit Namen an, beziehe Alter und konkrete Zahlen ein, wenn vorhanden.
- "headline": knackige Kernaussage, max. 40 Zeichen, ohne Emoji.
- "body": maximal 2 Sätze, höchstens 240 Zeichen, ohne Emoji.
- Kein medizinischer Rat im engeren Sinn; auf Hebamme/Kinderärztin nur verweisen, wenn der kerninhalt das vorsieht.
- Antworte ausschließlich als JSON: {"headline": "...", "body": "..."}`;

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
          { role: 'system', content: SYSTEM_PROMPT },
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
