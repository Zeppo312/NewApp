import {
  computeMetrics,
  type FamilyRows,
} from "../../supabase/functions/ask-lotti/facts";
import type { AskLottiPlan } from "../../supabase/functions/ask-lotti/planner";

const baseRows = (): FamilyRows => ({
  profile: { birth_date: null },
  sleep: [],
  care: [],
  planner: [],
  weights: [],
  sizes: [],
  milestones: [],
});

const plan = (overrides: Partial<AskLottiPlan>): AskLottiPlan => ({
  mode: "data",
  domains: ["sleep"],
  metric: "total",
  timeframe_days: 14,
  compare_previous: false,
  clarify_topics: [],
  answer_language: "de",
  ...overrides,
});

describe("Frag Lotti metric computation", () => {
  const now = "2026-08-06T12:00:00.000Z";

  it("computes sleep averages per documented day and exposes coverage", () => {
    const rows = baseRows();
    rows.sleep = [
      {
        start_time: "2026-08-05T18:00:00.000Z",
        end_time: "2026-08-05T20:00:00.000Z",
        duration_minutes: 120,
      },
      {
        start_time: "2026-08-05T21:00:00.000Z",
        end_time: "2026-08-05T23:00:00.000Z",
        duration_minutes: 120,
      },
      {
        start_time: "2026-08-03T20:00:00.000Z",
        end_time: "2026-08-04T00:00:00.000Z",
        duration_minutes: 240,
      },
    ];

    const evidence = computeMetrics(
      plan({ metric: "average_per_day" }),
      rows,
      now,
      0,
    );
    expect(
      evidence.find((item) => item.id === "sleep_average_day")?.detail,
    ).toContain("4,0 Std.");
    expect(
      evidence.find((item) => item.id === "sleep_average_session")?.detail,
    ).toContain("2,7 Std.");
    expect(
      evidence.find((item) => item.id === "sleep_coverage")?.detail,
    ).toContain("2 von 14 Tagen");
  });

  it("groups documented days using the device timezone boundary", () => {
    const rows = baseRows();
    rows.sleep = [
      {
        start_time: "2026-08-04T22:30:00.000Z",
        end_time: "2026-08-04T23:30:00.000Z",
        duration_minutes: 60,
      },
      {
        start_time: "2026-08-03T22:30:00.000Z",
        end_time: "2026-08-03T23:30:00.000Z",
        duration_minutes: 60,
      },
    ];
    const evidence = computeMetrics(
      plan({ metric: "average_per_day" }),
      rows,
      now,
      -120,
    );
    expect(
      evidence.find((item) => item.id === "sleep_coverage")?.detail,
    ).toContain("2 von 14 Tagen");
  });

  it("computes feeding and diaper averages only over documented days", () => {
    const rows = baseRows();
    rows.care = [
      {
        entry_type: "feeding",
        start_time: "2026-08-05T08:00:00.000Z",
        end_time: null,
        feeding_type: "BOTTLE",
        feeding_volume_ml: 120,
        diaper_type: null,
      },
      {
        entry_type: "feeding",
        start_time: "2026-08-05T12:00:00.000Z",
        end_time: null,
        feeding_type: "BOTTLE",
        feeding_volume_ml: 180,
        diaper_type: null,
      },
      {
        entry_type: "diaper",
        start_time: "2026-08-04T12:00:00.000Z",
        end_time: null,
        feeding_type: null,
        feeding_volume_ml: null,
        diaper_type: "WET",
      },
      {
        entry_type: "diaper",
        start_time: "2026-08-04T14:00:00.000Z",
        end_time: null,
        feeding_type: null,
        feeding_volume_ml: null,
        diaper_type: "DIRTY",
      },
    ];
    const evidence = computeMetrics(
      plan({
        domains: ["feeding", "diaper"],
        metric: "average_per_day",
        timeframe_days: 7,
      }),
      rows,
      now,
      0,
    );
    expect(
      evidence.find((item) => item.id === "feeding_average_day")?.detail,
    ).toContain("2,0");
    expect(
      evidence.find((item) => item.id === "feeding_average_volume_day")?.detail,
    ).toContain("300 ml");
    expect(
      evidence.find((item) => item.id === "diaper_average_day")?.detail,
    ).toContain("2,0");
  });

  it("computes profile age and next monthly birthday server-side", () => {
    const rows = baseRows();
    rows.profile.birth_date = "2025-06-20T00:00:00.000Z";
    const evidence = computeMetrics(
      plan({ domains: ["profile"], metric: "latest" }),
      rows,
      now,
      0,
    );
    expect(
      evidence.find((item) => item.id === "profile_age")?.detail,
    ).toContain("13 Monate");
    expect(
      evidence.find((item) => item.id === "profile_next_month")?.detail,
    ).toContain("14 Monate");
  });

  it("reports latest growth values and deltas without loading notes", () => {
    const rows = baseRows();
    rows.weights = [
      { date: "2026-08-01", value: 10.2 },
      { date: "2026-07-01", value: 9.8 },
    ];
    rows.sizes = [
      { date: "2026-08-01", value: 78 },
      { date: "2026-07-01", value: 76.5 },
    ];
    const evidence = computeMetrics(
      plan({ domains: ["growth"], metric: "latest" }),
      rows,
      now,
      0,
    );
    expect(
      evidence.find((item) => item.id === "growth_weight")?.detail,
    ).toContain("+0,4 kg");
    expect(
      evidence.find((item) => item.id === "growth_size")?.detail,
    ).toContain("+1,5 cm");
  });

  it("shows the latest completed and first open milestone", () => {
    const rows = baseRows();
    rows.milestones = [
      {
        is_completed: true,
        completion_date: "2026-08-01T10:00:00.000Z",
        title: "Läuft alleine",
        position: 1,
      },
      {
        is_completed: false,
        completion_date: null,
        title: "Klettert auf Möbel",
        position: 2,
      },
    ];
    const evidence = computeMetrics(
      plan({ domains: ["milestones"], metric: "latest" }),
      rows,
      now,
      0,
    );
    expect(
      evidence.find((item) => item.id === "milestone_latest")?.detail,
    ).toContain("Läuft alleine");
    expect(evidence.find((item) => item.id === "milestone_next")?.detail).toBe(
      "Klettert auf Möbel",
    );
  });
});
