import {
  computePregnancyEvidence,
  fallbackPregnancyPlan,
  pregnancyClarificationOptions,
  pregnancyContextFromDueDate,
  pregnancyReference,
  PREGNANCY_PLAN_SCHEMA,
  resolvePregnancyClarifyPlan,
  validatePregnancyPlan,
  type PregnancyPlan,
  type PregnancyRows,
} from "../../supabase/functions/ask-lotti/pregnancy";

const emptyRows = (): PregnancyRows => ({
  selfcare: [],
  weights: [],
  contractions: [],
  appointments: [],
  openQuestions: null,
  checklist: null,
  hasBirthPlan: null,
});

const plan = (overrides: Partial<PregnancyPlan> = {}): PregnancyPlan => ({
  mode: "data",
  domains: ["week"],
  metric: "latest",
  timeframe_days: 7,
  compare_previous: false,
  clarify_topics: [],
  answer_language: "de",
  ...overrides,
});

describe("Frag Lotti pregnancy planning", () => {
  it.each([
    ["In welcher SSW bin ich?", { mode: "mixed", domains: ["week"], answer_language: "de" }],
    ["Wie viel habe ich zugenommen?", { mode: "data", domains: ["weight"], answer_language: "de" }],
    ["Ist meine Gewichtszunahme normal?", { mode: "mixed", domains: ["weight"] }],
    ["Wie oft hatte ich heute Wehen?", { mode: "data", domains: ["contractions"], timeframe_days: 1 }],
    ["Wann ist mein nächster Termin beim Frauenarzt?", { mode: "data", domains: ["appointments"] }],
    ["What did my self-care check-ins look like?", { mode: "data", domains: ["selfcare"], answer_language: "en" }],
    ["¿Cómo voy con la bolsa del hospital?", { mode: "mixed", domains: ["preparation"], answer_language: "es" }],
    ["Wie geht es mir gerade so?", { mode: "clarify", domains: [] }],
    ["Was hilft gegen Übelkeit in der Schwangerschaft?", { mode: "general", domains: [] }],
    ["Wie wird das Wetter in Berlin?", { mode: "refuse", domains: [] }],
  ])("plans %s", (question, expected) => {
    expect(fallbackPregnancyPlan(question, [], "de")).toMatchObject(expected);
  });

  it("inherits the topic from history for follow-ups", () => {
    const result = fallbackPregnancyPlan("Und davor?", [
      { role: "user", text: "Wie hat sich mein Gewicht entwickelt?" },
      { role: "assistant", text: "Dein Gewicht ist stabil." },
    ]);
    expect(result).toMatchObject({ mode: "data", domains: ["weight"] });
  });

  it("validates plans against the pregnancy vocabulary only", () => {
    expect(validatePregnancyPlan(plan({ domains: ["selfcare", "week"] }))).toMatchObject({
      domains: ["selfcare", "week"],
    });
    expect(validatePregnancyPlan(plan({ domains: ["sleep" as never] }))).toBeNull();
    expect(validatePregnancyPlan(plan({ mode: "clarify", clarify_topics: ["feeding" as never] }))).toBeNull();
    expect((PREGNANCY_PLAN_SCHEMA as any).properties.domains.items.enum).toContain("contractions");
    expect((PREGNANCY_PLAN_SCHEMA as any).properties.domains.items.enum).not.toContain("diaper");
  });

  it("resolves a narrow clarify into a mixed plan with follow-up chips", () => {
    const resolved = resolvePregnancyClarifyPlan(
      plan({ mode: "clarify", domains: [], clarify_topics: ["selfcare", "weight"] }),
    );
    expect(resolved.plan).toMatchObject({ mode: "mixed", domains: ["selfcare", "weight"] });
    expect(resolved.followUpTopics).toEqual(["weight"]);
    expect(pregnancyClarificationOptions("en", ["weight"])[0]).toMatchObject({ id: "weight", label: "Weight" });
  });
});

describe("Frag Lotti pregnancy context", () => {
  const now = new Date("2026-09-03T10:00:00Z");

  it("derives week, day, trimester and countdown from the due date", () => {
    const context = pregnancyContextFromDueDate("2026-11-12T00:00:00Z", now);
    expect(context).toMatchObject({ week: 31, day: 0, trimester: 3, daysUntilDue: 70, dueDate: "2026-11-12" });
  });

  it("handles unknown or invalid due dates", () => {
    expect(pregnancyContextFromDueDate(null, now)).toBeNull();
    expect(pregnancyContextFromDueDate("nope", now)).toBeNull();
  });

  it("offers a week-based reference only when the context is known", () => {
    expect(pregnancyReference(null, "de")).toEqual([]);
    const [reference] = pregnancyReference(pregnancyContextFromDueDate("2026-11-12T00:00:00Z", now), "de");
    expect(reference.label).toContain("SSW 31");
    expect(reference.detail).toContain("3. Trimester");
  });
});

describe("Frag Lotti pregnancy evidence", () => {
  const nowIso = "2026-09-03T10:00:00Z";
  const context = pregnancyContextFromDueDate("2026-11-12T00:00:00Z", new Date(nowIso));

  it("reports the week and due date", () => {
    const evidence = computePregnancyEvidence(plan(), emptyRows(), context, nowIso);
    expect(evidence.map((item) => item.id)).toEqual(["pregnancy_week", "pregnancy_due"]);
    expect(evidence[0].detail).toBe("SSW 31 (30+0), 3. Trimester");
    expect(evidence[1].detail).toContain("noch 70 Tage");
  });

  it("aggregates self-care check-ins in the timeframe", () => {
    const rows = emptyRows();
    rows.selfcare = [
      { date: "2026-09-03T07:00:00Z", mood: "good", sleep_hours: 7, water_intake: 8, exercise_done: true },
      { date: "2026-09-01T07:00:00Z", mood: "bad", sleep_hours: 5, water_intake: 4, exercise_done: false },
      { date: "2026-08-01T07:00:00Z", mood: "great", sleep_hours: 9, water_intake: 9, exercise_done: true },
    ];
    const evidence = computePregnancyEvidence(plan({ domains: ["selfcare"] }), rows, context, nowIso);
    const byId = Object.fromEntries(evidence.map((item) => [item.id, item.detail]));
    expect(byId.selfcare_checkins).toBe("2 Check-ins in 7 Tagen");
    expect(byId.selfcare_sleep).toBe("6 Std. pro Nacht");
    expect(byId.selfcare_water).toBe("6 Gläser pro Tag");
    expect(byId.selfcare_exercise).toBe("an 1 von 2 Check-in-Tagen");
    expect(byId.selfcare_mood).toContain("gut");
  });

  it("computes the weight trend and contraction rhythm", () => {
    const rows = emptyRows();
    rows.weights = [
      { date: "2026-08-10", weight: 68.0 },
      { date: "2026-09-02", weight: 69.5 },
    ];
    rows.contractions = [
      { start_time: "2026-09-03T08:00:00Z", end_time: null, duration: 45, intensity: 2 },
      { start_time: "2026-09-03T08:08:00Z", end_time: null, duration: 55, intensity: 3 },
      { start_time: "2026-09-03T08:16:00Z", end_time: "2026-09-03T08:17:00Z", duration: null, intensity: 3 },
    ];
    const evidence = computePregnancyEvidence(
      plan({ domains: ["weight", "contractions"], timeframe_days: 30, answer_language: "en" }),
      rows,
      context,
      nowIso,
    );
    const byId = Object.fromEntries(evidence.map((item) => [item.id, item.detail]));
    expect(byId.weight_latest).toBe("69.5 kg (09/02/2026)");
    expect(byId.weight_change).toBe("+1.5 kg over 30 days");
    expect(byId.contractions_count).toBe("3 in 30 days");
    expect(byId.contractions_duration).toBe("53 seconds");
    expect(byId.contractions_interval).toBe("8 minutes");
  });

  it("summarizes preparation, questions and the next appointment", () => {
    const rows = emptyRows();
    rows.openQuestions = 3;
    rows.checklist = { checked: 4, total: 10 };
    rows.hasBirthPlan = false;
    rows.appointments = [
      { title: "Vorsorge", start_at: "2026-09-05T09:30:00Z", location: "Praxis" },
      { title: "Später", start_at: "2026-12-01T09:30:00Z", location: null },
    ];
    const evidence = computePregnancyEvidence(
      plan({ domains: ["appointments", "questions", "preparation"], timeframe_days: 30 }),
      rows,
      context,
      nowIso,
    );
    const byId = Object.fromEntries(evidence.map((item) => [item.id, item.detail]));
    expect(byId.appointment_next).toContain("Vorsorge");
    expect(byId.appointment_next).toContain("Praxis");
    expect(byId.appointment_count).toBe("1 in den nächsten 30 Tagen");
    expect(byId.questions_open).toBe("3 Fragen notiert");
    expect(byId.checklist_progress).toBe("4 von 10 Punkten erledigt");
    expect(byId.birth_plan).toBe("noch nicht angelegt");
  });

  it("returns nothing for empty data so the server can answer with noData", () => {
    expect(
      computePregnancyEvidence(plan({ domains: ["selfcare", "weight", "appointments"] }), emptyRows(), context, nowIso),
    ).toEqual([]);
  });
});
