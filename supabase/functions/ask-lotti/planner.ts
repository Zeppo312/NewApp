import type { AskLottiLocale } from "./guardrails.ts";

export const PLAN_MODES = [
  "data",
  "general",
  "mixed",
  "clarify",
  "medical",
  "refuse",
] as const;
export const PLAN_DOMAINS = [
  "sleep",
  "feeding",
  "diaper",
  "growth",
  "milestones",
  "planner",
  "profile",
] as const;
export const PLAN_METRICS = [
  "average_per_day",
  "total",
  "count",
  "longest",
  "latest",
  "distribution",
] as const;
export const CLARIFY_TOPICS = ["sleep", "feeding", "today", "growth"] as const;

export type AskLottiPlanMode = (typeof PLAN_MODES)[number];
export type AskLottiDomain = (typeof PLAN_DOMAINS)[number];
export type AskLottiMetric = (typeof PLAN_METRICS)[number];
export type AskLottiClarifyTopic = (typeof CLARIFY_TOPICS)[number];
export type AskLottiPlannerRoute = "regex_direct" | "model" | "fallback";

export type AskLottiPlan = {
  mode: AskLottiPlanMode;
  domains: AskLottiDomain[];
  metric: AskLottiMetric;
  timeframe_days: number;
  compare_previous: boolean;
  clarify_topics: AskLottiClarifyTopic[];
  answer_language: AskLottiLocale;
};

export type AskLottiHistoryItem = {
  role: "user" | "assistant";
  text: string;
};

export const ASK_LOTTI_PLAN_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: [
    "mode",
    "domains",
    "metric",
    "timeframe_days",
    "compare_previous",
    "clarify_topics",
    "answer_language",
  ],
  properties: {
    mode: { type: "string", enum: PLAN_MODES },
    domains: {
      type: "array",
      maxItems: PLAN_DOMAINS.length,
      items: { type: "string", enum: PLAN_DOMAINS },
    },
    metric: { type: "string", enum: PLAN_METRICS },
    timeframe_days: { type: "integer", minimum: 1, maximum: 30 },
    compare_previous: { type: "boolean" },
    clarify_topics: {
      type: "array",
      maxItems: CLARIFY_TOPICS.length,
      items: { type: "string", enum: CLARIFY_TOPICS },
    },
    answer_language: { type: "string", enum: ["de", "en", "es"] },
  },
};

const isOneOf = <T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] =>
  typeof value === "string" && values.includes(value as T[number]);

export const validateAskLottiPlan = (value: unknown): AskLottiPlan | null => {
  if (!value || typeof value !== "object") return null;
  const plan = value as Partial<AskLottiPlan>;
  if (!isOneOf(PLAN_MODES, plan.mode)) return null;
  if (!isOneOf(PLAN_METRICS, plan.metric)) return null;
  if (!isOneOf(["de", "en", "es"] as const, plan.answer_language)) return null;
  if (
    !Number.isInteger(plan.timeframe_days) ||
    Number(plan.timeframe_days) < 1 ||
    Number(plan.timeframe_days) > 30
  )
    return null;
  if (typeof plan.compare_previous !== "boolean") return null;
  if (
    !Array.isArray(plan.domains) ||
    !plan.domains.every((domain) => isOneOf(PLAN_DOMAINS, domain))
  )
    return null;
  if (
    !Array.isArray(plan.clarify_topics) ||
    !plan.clarify_topics.every((topic) => isOneOf(CLARIFY_TOPICS, topic))
  )
    return null;

  const domains = Array.from(new Set(plan.domains));
  const clarifyTopics = Array.from(new Set(plan.clarify_topics));
  if ((plan.mode === "data" || plan.mode === "mixed") && domains.length === 0)
    return null;
  if (plan.mode === "clarify" && clarifyTopics.length === 0) return null;

  return {
    mode: plan.mode,
    domains,
    metric: plan.metric,
    timeframe_days: Number(plan.timeframe_days),
    compare_previous: plan.compare_previous,
    clarify_topics: clarifyTopics,
    answer_language: plan.answer_language,
  };
};

// Asking the parent to pick between a single option only burns a turn and one
// question from their daily quota. With exactly one topic left, that topic is
// the answer, so resolve it into a real plan instead of asking.
const SINGLE_CLARIFY_PLANS: Record<
  AskLottiClarifyTopic,
  Pick<AskLottiPlan, "domains" | "metric" | "timeframe_days">
> = {
  sleep: { domains: ["sleep"], metric: "average_per_day", timeframe_days: 14 },
  feeding: { domains: ["feeding"], metric: "total", timeframe_days: 7 },
  today: {
    domains: ["sleep", "feeding", "diaper"],
    metric: "total",
    timeframe_days: 1,
  },
  growth: { domains: ["growth"], metric: "latest", timeframe_days: 30 },
};

export const resolveSingleTopicClarify = (plan: AskLottiPlan): AskLottiPlan => {
  if (plan.mode !== "clarify" || plan.clarify_topics.length !== 1) return plan;
  return {
    ...plan,
    ...SINGLE_CLARIFY_PLANS[plan.clarify_topics[0]],
    mode: "mixed",
    clarify_topics: [],
  };
};

const normalizeHistoryText = (value: unknown) => {
  if (typeof value !== "string") return null;
  const normalized = value
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return normalized.length >= 2 ? normalized : null;
};

export const normalizePlannerHistory = (
  value: unknown,
): AskLottiHistoryItem[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(-4).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as { role?: unknown; text?: unknown };
    if (candidate.role !== "user" && candidate.role !== "assistant") return [];
    const text = normalizeHistoryText(candidate.text);
    return text ? [{ role: candidate.role, text }] : [];
  });
};
