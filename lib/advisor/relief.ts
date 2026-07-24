import type { MamaEnergy } from './advisorStorage';

export type ReliefActionKind = 'accept' | 'delegate';

export interface ReliefSuggestion {
  id: string;
  energy: MamaEnergy;
  emoji: string;
  eyebrow: string;
  title: string;
  body: string;
  actionLabel: string;
  actionKind: ReliefActionKind;
  completionText: string;
  delegateMessage?: string;
}

export interface ReliefLearningEvent {
  reliefId: string;
  eventType: 'accepted' | 'delegated' | 'dismissed' | 'helped' | 'not_helpful';
}

interface ReliefContext {
  babyName?: string | null;
  now?: Date;
}

const nextReliefTime = (now: Date): Date => {
  const target = new Date(now.getTime() + 30 * 60_000);
  target.setMinutes(Math.ceil(target.getMinutes() / 5) * 5, 0, 0);
  return target;
};

const timeText = (date: Date): string =>
  date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

/**
 * Kleine, bewusst nicht-medizinische Entlastungsoptionen. Die Reihenfolge ist
 * die Empfehlung; „Passt nicht“ schaltet zur nächsten Option weiter.
 */
export const buildReliefSuggestions = (
  energy: MamaEnergy,
  context: ReliefContext = {},
): ReliefSuggestion[] => {
  const babyName = context.babyName?.trim() || 'dein Baby';
  const now = context.now ?? new Date();
  const handoverAt = timeText(nextReliefTime(now));

  if (energy === 'low') {
    return [
      {
        id: 'low-delegate-20',
        energy,
        emoji: '🫶',
        eyebrow: 'Jetzt zählt Entlastung',
        title: '20 Minuten abgeben',
        body: `Bitte eine vertraute Person, ${babyName} ab ${handoverAt} Uhr für 20 Minuten und die nächste Wickelrunde zu übernehmen.`,
        actionLabel: 'Konkrete Bitte senden',
        actionKind: 'delegate',
        completionText: 'Die Bitte ist raus. Du musst das gerade nicht mehr allein im Kopf behalten.',
        delegateMessage: `Ich habe heute kaum Kraft. Kannst du bitte ab ${handoverAt} Uhr ${babyName} für 20 Minuten übernehmen und die nächste Wickelrunde machen? Ich brauche kurz echte Pause.`,
      },
      {
        id: 'low-minimum-day',
        energy,
        emoji: '🌙',
        eyebrow: 'Energiesparmodus',
        title: 'Heute zählt nur das Nötigste',
        body: `Versorgung für ${babyName}, etwas zu essen und zu trinken für dich – Haushalt und Dokumentation dürfen heute warten.`,
        actionLabel: 'Energiesparmodus an',
        actionKind: 'accept',
        completionText: 'Energiesparmodus ist an. Lotti zeigt dir heute keine weiteren Aufgaben.',
      },
      {
        id: 'low-drop-household',
        energy,
        emoji: '🧺',
        eyebrow: 'Eine Sache weniger',
        title: 'Der Haushalt wartet',
        body: 'Wähle für heute bewusst: kein Aufräumen, keine Wäsche oder kein Baden. Eine Sache darf komplett ausfallen.',
        actionLabel: 'Das lasse ich heute',
        actionKind: 'accept',
        completionText: 'Gut. Diese Aufgabe ist für heute aus deinem Kopf.',
      },
    ];
  }

  if (energy === 'okay') {
    return [
      {
        id: 'okay-minimum-day',
        energy,
        emoji: '🌤️',
        eyebrow: 'Gut genug reicht',
        title: 'Heute nur drei Prioritäten',
        body: `Versorgung für ${babyName}, etwas für dich essen und einen ruhigen Moment nutzen. Alles andere ist optional.`,
        actionLabel: 'So mache ich es heute',
        actionKind: 'accept',
        completionText: 'Der Tag ist vereinfacht. Mehr musst du gerade nicht planen.',
      },
      {
        id: 'okay-drop-one',
        energy,
        emoji: '🍃',
        eyebrow: 'Mental Load senken',
        title: 'Eine Aufgabe darf weg',
        body: 'Streiche heute bewusst genau eine nicht dringende Sache – ohne sie sofort auf morgen umzuplanen.',
        actionLabel: 'Eine Sache streichen',
        actionKind: 'accept',
        completionText: 'Eine Sache weniger. Das ist heute genug Entlastung.',
      },
      {
        id: 'okay-delegate-one',
        energy,
        emoji: '↗️',
        eyebrow: 'Kleine Übergabe',
        title: 'Die nächste Wickelrunde abgeben',
        body: `Eine klar begrenzte Bitte ist leichter anzunehmen: die nächste Wickelrunde für ${babyName}.`,
        actionLabel: 'Bitte senden',
        actionKind: 'delegate',
        completionText: 'Die Aufgabe ist angefragt und muss nicht mehr nur in deinem Kopf bleiben.',
        delegateMessage: `Kannst du bitte die nächste Wickelrunde für ${babyName} übernehmen? Das würde mich heute spürbar entlasten.`,
      },
    ];
  }

  return [
    {
      id: 'good-protect-energy',
      energy,
      emoji: '🌿',
      eyebrow: 'Kraft bewahren',
      title: 'Heute ist nichts zu optimieren',
      body: 'Lotti hält sich zurück. Nutze einen ruhigen Moment lieber für dich als für die nächste Aufgabe.',
      actionLabel: 'Für heute reicht’s',
      actionKind: 'accept',
      completionText: 'Für heute ist genug. Lotti macht keine weitere Aufgabe daraus.',
    },
    {
      id: 'good-keep-window',
      energy,
      emoji: '☕️',
      eyebrow: 'Ein Moment für dich',
      title: 'Das nächste ruhige Fenster gehört dir',
      body: 'Wenn kurz Ruhe entsteht, fang nicht automatisch mit Haushalt an. Lass den Moment zuerst dir gehören.',
      actionLabel: 'Den Moment nehme ich mir',
      actionKind: 'accept',
      completionText: 'Schön. Deine Kraft darf heute auch bei dir bleiben.',
    },
  ];
};

/**
 * Stabile, leicht verständliche Personalisierung: positives Feedback zählt
 * stärker als bloßes Annehmen; verworfene Vorschläge rücken nach hinten.
 */
export const rankReliefSuggestions = (
  suggestions: ReliefSuggestion[],
  events: ReliefLearningEvent[],
): ReliefSuggestion[] => {
  const score = new Map<string, number>();
  for (const event of events) {
    const delta =
      event.eventType === 'helped'
        ? 3
        : event.eventType === 'not_helpful'
          ? -3
          : event.eventType === 'dismissed'
            ? -1
            : 0.25;
    score.set(event.reliefId, (score.get(event.reliefId) ?? 0) + delta);
  }
  return suggestions
    .map((suggestion, index) => ({ suggestion, index }))
    .sort((a, b) => {
      const scoreDifference =
        (score.get(b.suggestion.id) ?? 0) - (score.get(a.suggestion.id) ?? 0);
      return scoreDifference || a.index - b.index;
    })
    .map(({ suggestion }) => suggestion);
};
