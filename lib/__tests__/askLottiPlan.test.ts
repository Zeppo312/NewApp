import { fallbackPlanFromQuestion } from "../../supabase/functions/ask-lotti/intent";
import {
  ASK_LOTTI_PLAN_SCHEMA,
  normalizePlannerHistory,
  resolveSingleTopicClarify,
  validateAskLottiPlan,
} from "../../supabase/functions/ask-lotti/planner";
import { ASK_LOTTI_ANSWER_SCHEMA } from "../../supabase/functions/ask-lotti/schemas";

describe("Frag Lotti request planning", () => {
  it.each([
    [
      "Wie lange schläft Levi durchschnittlich?",
      {
        mode: "data",
        domains: ["sleep"],
        metric: "average_per_day",
        answer_language: "de",
      },
    ],
    [
      "Hi, wie sieht es bei Levi aus?",
      { mode: "clarify", domains: [], metric: "total", answer_language: "de" },
    ],
    [
      "Wie alt wird Levi als Nächstes?",
      {
        mode: "data",
        domains: ["profile"],
        metric: "latest",
        answer_language: "de",
      },
    ],
  ])(
    "builds a useful deterministic fallback plan: %s",
    (question, expected) => {
      expect(fallbackPlanFromQuestion(question)).toMatchObject(expected);
    },
  );

  it("uses bounded history to resolve a timeframe follow-up during an outage", () => {
    const plan = fallbackPlanFromQuestion("Und letzte Woche?", [
      { role: "user", text: "Wie lange schläft mein Baby durchschnittlich?" },
      { role: "assistant", text: "Die Ergebnisse stehen in den Karten." },
    ]);
    expect(plan.domains).toEqual(["sleep"]);
    expect(plan.timeframe_days).toBe(7);
  });

  it("normalizes at most four short history entries", () => {
    const history = normalizePlannerHistory([
      { role: "user", text: "a".repeat(300) },
      { role: "tool", text: "ignored" },
      { role: "assistant", text: " Antwort  " },
      { role: "user", text: "Frage zwei" },
      { role: "assistant", text: "Antwort zwei" },
      { role: "user", text: "Frage drei" },
    ]);
    expect(history).toHaveLength(4);
    expect(history[0].text).toBe("Antwort");
    expect(history.every((item) => item.text.length <= 200)).toBe(true);
  });

  it("rejects planner output outside the strict enums", () => {
    expect(
      validateAskLottiPlan({
        mode: "data",
        domains: ["database"],
        metric: "average_per_day",
        timeframe_days: 14,
        compare_previous: false,
        clarify_topics: [],
        answer_language: "de",
      }),
    ).toBeNull();
  });

  it("uses only OpenAI-supported array constraints in strict schemas", () => {
    expect(
      JSON.stringify([ASK_LOTTI_PLAN_SCHEMA, ASK_LOTTI_ANSWER_SCHEMA]),
    ).not.toContain('"uniqueItems"');
  });

  it("deduplicates planner arrays after structured output validation", () => {
    expect(
      validateAskLottiPlan({
        mode: "data",
        domains: ["sleep", "sleep"],
        metric: "average_per_day",
        timeframe_days: 14,
        compare_previous: false,
        clarify_topics: ["sleep", "sleep"],
        answer_language: "de",
      }),
    ).toMatchObject({ domains: ["sleep"], clarify_topics: ["sleep"] });
  });

  it("answers a single-option clarify instead of asking the parent to pick", () => {
    const clarify = {
      mode: "clarify",
      domains: [],
      metric: "total",
      timeframe_days: 14,
      compare_previous: false,
      clarify_topics: ["growth"],
      answer_language: "de",
    } as const;
    expect(resolveSingleTopicClarify({ ...clarify })).toMatchObject({
      mode: "mixed",
      domains: ["growth"],
      metric: "latest",
      clarify_topics: [],
      answer_language: "de",
    });
  });

  it("keeps a clarify with a real choice between topics", () => {
    const clarify = {
      mode: "clarify",
      domains: [],
      metric: "total",
      timeframe_days: 14,
      compare_previous: false,
      clarify_topics: ["sleep", "feeding"],
      answer_language: "de",
    } as const;
    expect(resolveSingleTopicClarify({ ...clarify })).toMatchObject({
      mode: "clarify",
      clarify_topics: ["sleep", "feeding"],
    });
  });
});
