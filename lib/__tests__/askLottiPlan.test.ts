import { fallbackPlanFromQuestion } from "../../supabase/functions/ask-lotti/intent";
import {
  ASK_LOTTI_PLAN_SCHEMA,
  normalizePlannerHistory,
  resolveClarifyPlan,
  validateAskLottiPlan,
  type AskLottiPlan,
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

  const clarifyPlan = (
    topics: AskLottiPlan["clarify_topics"],
  ): AskLottiPlan => ({
    mode: "clarify",
    domains: [],
    metric: "total",
    timeframe_days: 14,
    compare_previous: false,
    clarify_topics: topics,
    answer_language: "de",
  });

  it("answers a single-option clarify instead of asking the parent to pick", () => {
    const resolved = resolveClarifyPlan(clarifyPlan(["growth"]));
    expect(resolved.plan).toMatchObject({
      mode: "mixed",
      domains: ["growth"],
      metric: "latest",
      clarify_topics: [],
      answer_language: "de",
    });
    expect(resolved.followUpTopics).toEqual([]);
  });

  it("leads with the first topic and keeps the rest as follow-ups", () => {
    const resolved = resolveClarifyPlan(clarifyPlan(["sleep", "today"]));
    // "Is my child sleeping normally?" must be answered on sleep, not turned
    // back into a menu; "today" stays available underneath the answer.
    expect(resolved.plan).toMatchObject({
      mode: "mixed",
      metric: "average_per_day",
      timeframe_days: 14,
      clarify_topics: [],
    });
    expect(resolved.plan.domains).toEqual(
      expect.arrayContaining(["sleep", "feeding", "diaper"]),
    );
    expect(resolved.followUpTopics).toEqual(["today"]);
  });

  it("still asks when the request stayed genuinely wide open", () => {
    const resolved = resolveClarifyPlan(
      clarifyPlan(["sleep", "feeding", "today"]),
    );
    expect(resolved.plan.mode).toBe("clarify");
    expect(resolved.plan.clarify_topics).toEqual(["sleep", "feeding", "today"]);
    expect(resolved.followUpTopics).toEqual([]);
  });

  it("leaves a non-clarify plan untouched", () => {
    const plan: AskLottiPlan = {
      mode: "data",
      domains: ["sleep"],
      metric: "total",
      timeframe_days: 7,
      compare_previous: false,
      clarify_topics: [],
      answer_language: "en",
    };
    expect(resolveClarifyPlan(plan)).toEqual({ plan, followUpTopics: [] });
  });
});
