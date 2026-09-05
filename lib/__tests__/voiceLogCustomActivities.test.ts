const mockAddBabyCareEntry = jest.fn();
const mockCreateCustomActivityType = jest.fn();
const mockGetCustomActivityTypes = jest.fn();

jest.mock("@/lib/supabase", () => ({
  addBabyCareEntry: (...args: unknown[]) => mockAddBabyCareEntry(...args),
  supabase: {
    from: jest.fn(),
    functions: { invoke: jest.fn() },
  },
}));

jest.mock("@/lib/customActivities", () => ({
  createCustomActivityType: (...args: unknown[]) =>
    mockCreateCustomActivityType(...args),
  getCustomActivityTypes: (...args: unknown[]) =>
    mockGetCustomActivityTypes(...args),
}));

jest.mock("@/lib/lottiMomentEvents", () => ({ emitLottiMoment: jest.fn() }));
jest.mock("@/lib/shopping", () => ({ upsertShoppingItem: jest.fn() }));
jest.mock("@/lib/shoppingWidget", () => ({ refreshShoppingWidget: jest.fn() }));

// Jest muss die Modul-Mocks vor diesen Imports registrieren.
// eslint-disable-next-line import/first
import { saveVoiceLogEntries } from "../voiceLog/api";
// eslint-disable-next-line import/first
import type { VoiceLogParsedEntry } from "../voiceLog/types";

const makeCustomEntry = (
  changes: Partial<VoiceLogParsedEntry> = {},
): VoiceLogParsedEntry => ({
  type: "custom",
  start_local: "2026-09-03T14:30",
  end_local: null,
  feeding_type: null,
  feeding_type_needs_confirmation: false,
  timer_requested: false,
  feeding_volume_ml: null,
  feeding_side: null,
  diaper_type: null,
  note: null,
  custom_activity_type_id: "activity-1",
  custom_name: "Medikament",
  custom_emoji: "💊",
  custom_color: "#E25555",
  custom_tracking_mode: "quantity",
  custom_quantity: 3,
  custom_unit: "Tropfen",
  custom_create_type: false,
  custom_log_entry: true,
  shopping_title: null,
  shopping_quantity_value: null,
  shopping_quantity_unit: null,
  shopping_category: null,
  planner_kind: null,
  planner_title: null,
  planner_location: null,
  planner_all_day: false,
  ...changes,
});

describe("saveVoiceLogEntries custom activities", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockGetCustomActivityTypes.mockResolvedValue({ data: [], error: null });
    mockAddBabyCareEntry.mockResolvedValue({
      data: { id: "entry-1" },
      error: null,
    });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("saves an existing custom definition as a snapshotted baby-care entry", async () => {
    mockGetCustomActivityTypes.mockResolvedValue({
      data: [
        {
          id: "activity-1",
          baby_id: "baby-1",
          created_by: "user-1",
          name: "Medikament",
          emoji: "💊",
          color: "#E25555",
          tracking_mode: "quantity",
          unit: "Tropfen",
          default_quantity: null,
          is_archived: false,
          created_at: "2026-09-03T12:00:00.000Z",
          updated_at: "2026-09-03T12:00:00.000Z",
        },
      ],
      error: null,
    });
    const result = await saveVoiceLogEntries(
      [makeCustomEntry()],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 1, failedCount: 0 });
    expect(mockCreateCustomActivityType).not.toHaveBeenCalled();
    expect(mockGetCustomActivityTypes).toHaveBeenCalledWith("baby-1");
    expect(mockAddBabyCareEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        entry_type: "custom",
        custom_activity_type_id: "activity-1",
        custom_name: "Medikament",
        custom_quantity: 3,
        custom_unit: "Tropfen",
      }),
      "baby-1",
    );
  });

  it("rejects an existing activity that is no longer active", async () => {
    const result = await saveVoiceLogEntries(
      [makeCustomEntry()],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 0, failedCount: 1 });
    expect(mockAddBabyCareEntry).not.toHaveBeenCalled();
  });

  it("uses the current database snapshot instead of parser-supplied values", async () => {
    mockGetCustomActivityTypes.mockResolvedValue({
      data: [
        {
          id: "activity-1",
          baby_id: "baby-1",
          created_by: "user-1",
          name: "Vitamin D",
          emoji: "☀️",
          color: "#F5A623",
          tracking_mode: "quantity",
          unit: "Tropfen",
          default_quantity: null,
          is_archived: false,
          created_at: "2026-09-03T12:00:00.000Z",
          updated_at: "2026-09-03T12:05:00.000Z",
        },
      ],
      error: null,
    });

    const result = await saveVoiceLogEntries(
      [makeCustomEntry({ custom_name: "Manipulierter Name", custom_emoji: "💣" })],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 1, failedCount: 0 });
    expect(mockAddBabyCareEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_name: "Vitamin D",
        custom_emoji: "☀️",
        custom_color: "#F5A623",
        custom_unit: "Tropfen",
      }),
      "baby-1",
    );
  });

  it("creates an explicitly requested definition without logging an occurrence", async () => {
    mockCreateCustomActivityType.mockResolvedValue({
      data: {
        id: "activity-new",
        baby_id: "baby-1",
        created_by: "user-1",
        name: "Bauchlage",
        emoji: "⭐️",
        color: "#5E3DB3",
        tracking_mode: "duration",
        unit: null,
        default_quantity: null,
        is_archived: false,
        created_at: "2026-09-03T12:00:00.000Z",
        updated_at: "2026-09-03T12:00:00.000Z",
      },
      error: null,
    });

    const result = await saveVoiceLogEntries(
      [
        makeCustomEntry({
          custom_activity_type_id: null,
          custom_name: "Bauchlage",
          custom_emoji: "👨🏿‍🍼",
          custom_color: "#5E3DB3",
          custom_tracking_mode: "duration",
          custom_quantity: null,
          custom_unit: null,
          custom_create_type: true,
          custom_log_entry: false,
        }),
      ],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 1, failedCount: 0 });
    expect(mockCreateCustomActivityType).toHaveBeenCalledWith(
      "baby-1",
      expect.objectContaining({
        name: "Bauchlage",
        emoji: "👨🏿‍🍼",
        tracking_mode: "duration",
        default_quantity: null,
      }),
    );
    expect(mockAddBabyCareEntry).not.toHaveBeenCalled();
  });

  it("normalizes spacing before creating a new definition", async () => {
    mockCreateCustomActivityType.mockResolvedValue({
      data: {
        id: "activity-new",
        baby_id: "baby-1",
        created_by: "user-1",
        name: "Vitamin D",
        emoji: "⭐️",
        color: "#5E3DB3",
        tracking_mode: "event",
        unit: null,
        default_quantity: null,
        is_archived: false,
        created_at: "2026-09-03T12:00:00.000Z",
        updated_at: "2026-09-03T12:00:00.000Z",
      },
      error: null,
    });

    const result = await saveVoiceLogEntries(
      [
        makeCustomEntry({
          custom_activity_type_id: null,
          custom_name: "  Vitamin   D  ",
          custom_emoji: null,
          custom_tracking_mode: "event",
          custom_quantity: null,
          custom_unit: null,
          custom_create_type: true,
          custom_log_entry: false,
        }),
      ],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 1, failedCount: 0 });
    expect(mockCreateCustomActivityType).toHaveBeenCalledWith(
      "baby-1",
      expect.objectContaining({ name: "Vitamin D", emoji: "💊" }),
    );
  });

  it("recovers a concurrent duplicate creation and reuses the active definition", async () => {
    mockGetCustomActivityTypes
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [
          {
            id: "activity-existing",
            baby_id: "baby-1",
            created_by: "user-1",
            name: "Vitamin D",
            emoji: "☀️",
            color: "#F5A623",
            tracking_mode: "event",
            unit: null,
            default_quantity: null,
            is_archived: false,
            created_at: "2026-09-03T12:00:00.000Z",
            updated_at: "2026-09-03T12:00:00.000Z",
          },
        ],
        error: null,
      });
    mockCreateCustomActivityType.mockResolvedValue({
      data: null,
      error: { code: "23505", message: "duplicate key" },
    });

    const result = await saveVoiceLogEntries(
      [
        makeCustomEntry({
          custom_activity_type_id: null,
          custom_name: "Vitamin D",
          custom_tracking_mode: "event",
          custom_quantity: null,
          custom_unit: null,
          custom_create_type: true,
          custom_log_entry: true,
        }),
      ],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 1, failedCount: 0 });
    expect(mockAddBabyCareEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_activity_type_id: "activity-existing",
        custom_name: "Vitamin D",
      }),
      "baby-1",
    );
  });

  it("reuses a normalized name match without creating a near-duplicate", async () => {
    mockGetCustomActivityTypes.mockResolvedValue({
      data: [
        {
          id: "activity-existing",
          baby_id: "baby-1",
          created_by: "user-1",
          name: "Vitamin D",
          emoji: "☀️",
          color: "#F5A623",
          tracking_mode: "event",
          unit: null,
          default_quantity: null,
          is_archived: false,
          created_at: "2026-09-03T12:00:00.000Z",
          updated_at: "2026-09-03T12:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await saveVoiceLogEntries(
      [
        makeCustomEntry({
          custom_activity_type_id: null,
          custom_name: "  vitamin   D  ",
          custom_tracking_mode: "event",
          custom_quantity: null,
          custom_unit: null,
          custom_create_type: true,
          custom_log_entry: true,
        }),
      ],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 1, failedCount: 0 });
    expect(mockCreateCustomActivityType).not.toHaveBeenCalled();
    expect(mockAddBabyCareEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        custom_activity_type_id: "activity-existing",
        custom_name: "Vitamin D",
      }),
      "baby-1",
    );
  });

  it("rejects non-finite custom quantities before reaching the database", async () => {
    mockGetCustomActivityTypes.mockResolvedValue({
      data: [
        {
          id: "activity-1",
          baby_id: "baby-1",
          created_by: "user-1",
          name: "Medikament",
          emoji: "💊",
          color: "#E25555",
          tracking_mode: "quantity",
          unit: "Tropfen",
          default_quantity: null,
          is_archived: false,
          created_at: "2026-09-03T12:00:00.000Z",
          updated_at: "2026-09-03T12:00:00.000Z",
        },
      ],
      error: null,
    });

    const result = await saveVoiceLogEntries(
      [makeCustomEntry({ custom_quantity: Number.POSITIVE_INFINITY })],
      "user-1",
      "baby-1",
    );

    expect(result).toEqual({ savedCount: 0, failedCount: 1 });
    expect(mockAddBabyCareEntry).not.toHaveBeenCalled();
  });
});
