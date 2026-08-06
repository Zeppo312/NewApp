import type {
  AskLottiDomain,
  AskLottiHistoryItem,
  AskLottiMetric,
  AskLottiPlan,
} from "./planner.ts";
import type { AskLottiLocale } from "./guardrails.ts";

const SLEEP =
  /(?:schlaf|schläf|einschlaf|nacht|nickerchen|bett|sleep|bedtime|nap|sueñ|dorm)/i;
const FEEDING =
  /(?:trink|fütter|futter|still|flasch|milch|gegessen|isst|essen|mahlzeit|feed|feeding|milk|bottle|breast|eat|comer|come|toma|leche|biber[oó]n)/i;
const DIAPER = /(?:windel|pipi|stuhlgang|diaper|nappy|pañal|caca)/i;
const GROWTH =
  /(?:gewicht|größe|groesse|wachstum|weight|height|growth|peso|talla|crecimiento)/i;
const MILESTONES =
  /(?:meilenstein|entwicklung|gelernt|kann schon|milestone|development|learned|hito|desarrollo|aprendi[oó])/i;
const PROFILE_AGE =
  /(?:wie alt|alter|geburtstag|age|how old|birthday|edad|cumple)/i;

const detectLanguage = (
  question: string,
  fallback: AskLottiLocale = "en",
): AskLottiLocale => {
  if (/[¿¡]|\b(?:qué|cuánto|sueño|pañal|bebé|hoy|ayer|meses)\b/i.test(question))
    return "es";
  if (
    /[äöüß]|\b(?:wie|was|heute|gestern|schlaf|windel|fütter|mein|unser|alt)\b/i.test(
      question,
    )
  )
    return "de";
  if (
    /\b(?:what|how|today|yesterday|sleep|diaper|feed|my|our|age)\b/i.test(
      question,
    )
  )
    return "en";
  return fallback;
};

const timeframeDays = (question: string) => {
  if (
    /(?:letzte[mnrs]?|vergangene[mnrs]?|vorige[mnrs]?|last|past|previous|últim[oa]s?|pasad[oa]s?)\s+(?:monat|month|mes)/i.test(
      question,
    )
  )
    return 30;
  if (/(?:zwei|two|dos)\s+(?:wochen|weeks|semanas)/i.test(question)) return 14;
  if (
    /(?:heute|today|hoy|letzte\s+24\s+stunden|last\s+24\s+hours|últimas\s+24\s+horas)/i.test(
      question,
    )
  )
    return 1;
  if (/(?:drei|three|tres)\s+(?:tage|days|d[ií]as)/i.test(question)) return 3;
  const numeric = question.match(
    /\b(\d{1,2})\s*(tage|days|d[ií]as|wochen|weeks|semanas)\b/i,
  );
  if (numeric)
    return Math.max(
      1,
      Math.min(
        30,
        Number(numeric[1]) * (/wochen|weeks|semanas/i.test(numeric[2]) ? 7 : 1),
      ),
    );
  if (/(?:woche|week|semana)/i.test(question)) return 7;
  return 14;
};

const plan = (
  question: string,
  mode: AskLottiPlan["mode"],
  domains: AskLottiDomain[],
  metric: AskLottiMetric,
  options: Partial<
    Pick<AskLottiPlan, "timeframe_days" | "compare_previous" | "clarify_topics">
  > = {},
): AskLottiPlan => ({
  mode,
  domains,
  metric,
  timeframe_days: options.timeframe_days ?? timeframeDays(question),
  compare_previous:
    options.compare_previous ??
    /(?:vergleich|vorher|anders|entwicklung|trend|compare|previous|changed|trend|compara|anterior|cambi)/i.test(
      question,
    ),
  clarify_topics: options.clarify_topics ?? [],
  answer_language: detectLanguage(question),
});

const historyDomains = (history: AskLottiHistoryItem[]): AskLottiDomain[] => {
  const text = history.map((item) => item.text).join(" ");
  if (SLEEP.test(text)) return ["sleep"];
  if (FEEDING.test(text)) return ["feeding"];
  if (DIAPER.test(text)) return ["diaper"];
  if (GROWTH.test(text)) return ["growth"];
  if (MILESTONES.test(text)) return ["milestones"];
  return [];
};

// Regex routing is deliberately only a deterministic outage fallback. The
// planner model always gets the first chance to interpret a healthy request.
export const fallbackPlanFromQuestion = (
  question: string,
  history: AskLottiHistoryItem[] = [],
): AskLottiPlan => {
  const inheritedDomains =
    /(?:und|auch|davor|letzte|previous|before|also|y|también|anterior)/i.test(
      question,
    )
      ? historyDomains(history)
      : [];
  if (inheritedDomains.length > 0) {
    return plan(
      question,
      "data",
      inheritedDomains,
      /(?:durchschnitt|average|promedio)/i.test(question)
        ? "average_per_day"
        : "total",
    );
  }

  if (PROFILE_AGE.test(question))
    return plan(question, "data", ["profile"], "latest");
  if (
    /(?:kinderarzt|doctor|pediatr|m[eé]dic).*(?:zusammen|fass|summar|resum)|(?:zusammen|fass|summar|resum).*(?:kinderarzt|doctor|pediatr|m[eé]dic)/i.test(
      question,
    )
  ) {
    return plan(question, "data", ["sleep", "feeding", "diaper"], "total", {
      timeframe_days: 3,
    });
  }
  if (/(?:partner|caregiver|übergabe|handoff|pareja)/i.test(question)) {
    return plan(question, "data", ["sleep", "feeding", "diaper"], "total", {
      timeframe_days: 1,
    });
  }
  if (
    /(?:morgen|tomorrow|mañana).*(?:plan|termin|appointment|cita)|(?:plan|plane|planifica).*(?:morgen|tomorrow|mañana)/i.test(
      question,
    )
  ) {
    return plan(question, "mixed", ["planner"], "distribution", {
      timeframe_days: 1,
    });
  }
  if (SLEEP.test(question)) {
    if (
      /(?:durchschnitt|im schnitt|average|on average|promedio|media)/i.test(
        question,
      )
    )
      return plan(question, "data", ["sleep"], "average_per_day");
    if (/(?:längst|laengst|longest|m[aá]s tiempo)/i.test(question))
      return plan(question, "data", ["sleep"], "longest", {
        timeframe_days: 30,
      });
    if (
      /(?:besser|helfen|hilfe|routine|einschlaf|settle|help|improve|ayud|mejor|rutina)/i.test(
        question,
      )
    )
      return plan(question, "mixed", ["sleep"], "distribution");
    if (
      /(?:sollt|normal|empfohl|bedarf|should|typical|recommend|deber[ií]a|habitual)/i.test(
        question,
      )
    )
      return plan(question, "general", ["profile"], "total");
    return plan(question, "data", ["sleep"], "total");
  }
  if (FEEDING.test(question)) {
    const metric = /(?:durchschnitt|im schnitt|average|promedio)/i.test(
      question,
    )
      ? "average_per_day"
      : "total";
    return plan(
      question,
      /(?:sollt|normal|empfohl|should|typical|deber[ií]a|habitual)/i.test(
        question,
      )
        ? "mixed"
        : "data",
      ["feeding"],
      metric,
    );
  }
  if (DIAPER.test(question)) {
    if (
      /(?:größe|groesse|passt|passform|size|fit|talla|ajuste)/i.test(question)
    )
      return plan(question, "general", ["profile"], "latest");
    return plan(question, "data", ["diaper"], "count");
  }
  if (GROWTH.test(question))
    return plan(question, "data", ["growth"], "latest", {
      compare_previous: true,
    });
  if (MILESTONES.test(question))
    return plan(question, "data", ["milestones"], "latest");
  if (
    /(?:wie sieht|was ist los|überblick|ueberblick|how is|overview|qué tal|resumen)/i.test(
      question,
    )
  ) {
    return plan(question, "clarify", [], "total", {
      clarify_topics: ["sleep", "feeding", "today"],
    });
  }
  return plan(question, "refuse", [], "total");
};

export {
  detectLanguage as detectAskLottiLanguage,
  timeframeDays as inferTimeframeDays,
};
