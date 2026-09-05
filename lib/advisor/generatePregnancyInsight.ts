/**
 * Lottis Fürsorge – Schwangerschaftsmodus: Anbindung an `advisor-generate`.
 *
 * Schickt die Schwangerschaftssignale mit `mode: 'pregnancy'` an den Server,
 * der per Regel-Engine + OpenAI den Haupt-Hinweis formuliert und ihn ohne
 * Baby-Bezug (baby_id = NULL) in `advisor_messages` persistiert. Antwortet der
 * Server nicht, liefert die Funktion null und die Seite bleibt bei der
 * lokalen Analyse (buildPregnancyAnalysis).
 */

import { supabase } from '@/lib/supabase';
import type { AppLocale } from '@/lib/localization';

import { localDateString } from './advisorStorage';
import type { RemoteInsight } from './generateInsight';
import { toPregnancyRuleSignals } from './pregnancyInsights';
import type { PregnancySignals } from './pregnancySignals';

export const generatePregnancyInsight = async (
  signals: PregnancySignals,
  locale: AppLocale = 'de',
): Promise<RemoteInsight | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('advisor-generate', {
      body: {
        mode: 'pregnancy',
        locale,
        localDate: localDateString(),
        signals: toPregnancyRuleSignals(signals),
      },
    });
    if (error || !data?.main?.id || !data?.main?.body) return null;
    return {
      main: {
        id: data.main.id,
        tone: data.main.tone ?? 'neutral',
        emoji: data.main.emoji ?? '🌸',
        title: data.main.title ?? '',
        headline: data.main.headline ?? undefined,
        body: data.main.body,
      },
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
      source: data.source === 'ai' ? 'ai' : 'rules',
      persisted: data.persisted === true,
      messageId: typeof data.messageId === 'string' ? data.messageId : null,
    };
  } catch {
    return null;
  }
};
