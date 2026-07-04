/**
 * Lottis Fürsorge – Anbindung an die Edge Function `advisor-generate`.
 *
 * Schickt die lokal gesammelten Tagessignale an den Server, der per
 * Regel-Engine + OpenAI den Haupt-Hinweis formuliert und direkt in
 * `advisor_messages` persistiert. Antwortet der Server nicht (Function
 * noch nicht deployt, offline, kein Login), liefert die Funktion null
 * und die Seite nutzt wie bisher buildMockAnalysis als Fallback.
 */

import { supabase } from '@/lib/supabase';

import { localDateString } from './advisorStorage';
import type { AdvisorInsight, DailySignals } from './types';

export interface RemoteInsight {
  main: AdvisorInsight;
  reasons: string[];
  source: 'rules' | 'ai';
  /** true = Server hat den Hinweis bereits in advisor_messages gespeichert. */
  persisted: boolean;
}

export const generateAdvisorInsight = async (
  babyId: string,
  signals: DailySignals,
): Promise<RemoteInsight | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('advisor-generate', {
      body: {
        babyId,
        localDate: localDateString(),
        signals: {
          babyName: signals.babyName,
          ageMonths: signals.ageMonths,
          ageText: signals.ageText,
          // Volles Feeding-Profil, damit die Regel-Engine den Fütter-Modus
          // kennt (Stillen/Flasche/Beikost) und eigene Baselines nutzen kann.
          feeding: {
            totalCount: signals.feeding.totalCount,
            isReal: signals.feeding.isReal,
            bottleCount: signals.feeding.bottleCount,
            breastCount: signals.feeding.breastCount,
            solidsCount: signals.feeding.solidsCount,
            waterCount: signals.feeding.waterCount,
            totalBottleMl: signals.feeding.totalBottleMl,
            lastFeedingAt: signals.feeding.lastFeedingAt,
            hoursSinceLastFeeding: signals.feeding.hoursSinceLastFeeding,
            lastBreastAt: signals.feeding.lastBreastAt,
            daysSinceLastBreast: signals.feeding.daysSinceLastBreast,
            breastCountLast21Days: signals.feeding.breastCountLast21Days,
            bottleCountLast21Days: signals.feeding.bottleCountLast21Days,
            solidsCountLast21Days: signals.feeding.solidsCountLast21Days,
            likelyFeedingMode: signals.feeding.likelyFeedingMode,
            typicalPerDay: signals.feeding.typicalPerDay,
          },
          diaper: {
            count: signals.diaper.count,
            isReal: signals.diaper.isReal,
            wetCountToday: signals.diaper.wetCountToday,
            lastWetAt: signals.diaper.lastWetAt,
          },
          sleep: {
            minutes: signals.sleep.minutes,
            isReal: signals.sleep.isReal,
          },
          weather: signals.weather,
        },
      },
    });
    if (error || !data?.main?.id || !data?.main?.body) return null;
    return {
      main: {
        id: data.main.id,
        tone: data.main.tone ?? 'neutral',
        emoji: data.main.emoji ?? '💡',
        title: data.main.title ?? 'Heute wichtig',
        headline: data.main.headline ?? undefined,
        body: data.main.body,
      },
      reasons: Array.isArray(data.reasons) ? data.reasons : [],
      source: data.source === 'ai' ? 'ai' : 'rules',
      persisted: data.persisted === true,
    };
  } catch {
    return null;
  }
};
