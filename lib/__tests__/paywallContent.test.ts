import {
  DEFAULT_PAYWALL_CONTENT,
  isPaywallComparisonIncluded,
  PAYWALL_VISIBLE_TIER_IDS,
  sanitizePaywallContent,
} from "../paywallContent";
import { localizePaywallPlansContent } from "../paywallTranslations";
import {
  APP_FEATURES,
  DEFAULT_SUBSCRIPTION_FEATURE_POLICY,
  SUBSCRIPTION_TIERS,
} from "../subscriptionFeaturePolicy";

const allTiers = { lite: true, standard: true, premium: true };
const standardAndPremium = { lite: false, standard: true, premium: true };
const premiumOnly = { lite: false, standard: false, premium: true };

describe("paywall feature comparison", () => {
  const germanRows = DEFAULT_PAYWALL_CONTENT.plans.comparisonRows;

  it("includes shopping and inventory in every subscription tier", () => {
    const shoppingRow = germanRows.find((row) => row.featureKey === "shoppingList");
    expect(shoppingRow).toMatchObject(allTiers);
    SUBSCRIPTION_TIERS.forEach((tier) => {
      expect(
        isPaywallComparisonIncluded(shoppingRow!, tier, DEFAULT_SUBSCRIPTION_FEATURE_POLICY),
      ).toBe(true);
    });
  });

  it("lists every current feature group exactly once", () => {
    expect(germanRows).toHaveLength(28);
    expect(new Set(germanRows.map(({ label }) => label)).size).toBe(
      germanRows.length,
    );

    expect(germanRows.map(({ label }) => label)).toEqual(
      expect.arrayContaining([
        "Schlaftracker, Schlafphasen & Schlafprognosen",
        "Stillen, Flasche, Pumpen, Beikost & Wasser",
        "Kliniktaschen-Checkliste, Geburtsplan & Arztfragen",
        "Meilensteine & Zahn-Tracker",
        "Babywetter & Kleidungsempfehlungen",
        "Community, Gruppen & private Chats",
        "Einkaufslisten & Kundenkarten",
        "Rezepte, Generator, eigene Rezepte & Beikost-Videos",
        "Schlaftracker: Monatsansicht & Schlafkalender",
        "Unser Tag: Monatsansicht & Aktivitätskalender",
        "✨ Persönliches Schwangerschafts-Briefing",
        "✨ KI: Sprach-Logging – Einträge einsprechen",
        "✨ KI: Lottis Fürsorge – tägliche Hinweise",
        "✨ KI: Frag Lotti – belegte Antworten aus euren Daten",
      ]),
    );
  });

  it("uses one canonical mapping for the admin matrix and live paywall", () => {
    const dynamicKeys = germanRows
      .flatMap((row) => (row.featureKey ? [row.featureKey] : []))
      .sort();
    expect(dynamicKeys).toEqual(
      [...APP_FEATURES.filter((feature) => feature !== "basisTracker"), "caregiverMode"].sort(),
    );

    germanRows.forEach((row) => {
      SUBSCRIPTION_TIERS.forEach((tier) => {
        expect(
          isPaywallComparisonIncluded(
            row,
            tier,
            DEFAULT_SUBSCRIPTION_FEATURE_POLICY,
          ),
        ).toBe(row[tier]);
      });
    });
  });

  it("keeps the tier differences accurate", () => {
    expect(germanRows.slice(0, 14)).toEqual(
      germanRows.slice(0, 14).map((row) => ({ ...row, ...allTiers })),
    );
    expect(germanRows.slice(14, 23)).toEqual(
      germanRows
        .slice(14, 23)
        .map((row) => ({
          ...row,
          ...(["recipes", "shoppingList", "partnerLink", "planner"].includes(row.featureKey ?? "")
            ? allTiers
            : standardAndPremium),
        })),
    );
    expect(germanRows.slice(23)).toEqual(
      germanRows.slice(23).map((row) => ({ ...row, ...premiumOnly })),
    );
  });

  it("provides the complete comparison in every supported language", () => {
    const english = localizePaywallPlansContent(
      "en",
      DEFAULT_PAYWALL_CONTENT.plans,
    );
    const spanish = localizePaywallPlansContent(
      "es",
      DEFAULT_PAYWALL_CONTENT.plans,
    );

    expect(english.comparisonRows).toHaveLength(germanRows.length);
    expect(spanish.comparisonRows).toHaveLength(germanRows.length);
    expect(english.comparisonRows.at(-1)?.label).toBe(
      "Caregiver mode: time-limited access for grandparents & trusted people",
    );
    expect(spanish.comparisonRows.at(-1)?.label).toBe(
      "Modo cuidador: acceso temporal para abuelos y personas de confianza",
    );
    expect(
      english.comparisonRows.map(({ lite, standard, premium }) => ({
        lite,
        standard,
        premium,
      })),
    ).toEqual(
      germanRows.map(({ lite, standard, premium }) => ({
        lite,
        standard,
        premium,
      })),
    );
    expect(
      spanish.comparisonRows.map(({ lite, standard, premium }) => ({
        lite,
        standard,
        premium,
      })),
    ).toEqual(
      germanRows.map(({ lite, standard, premium }) => ({
        lite,
        standard,
        premium,
      })),
    );
  });

  it("uses the complete defaults for older saved content without plan rows", () => {
    expect(sanitizePaywallContent({}).plans.comparisonRows).toEqual(germanRows);
  });

  it("adds caregiver mode to saved content once and localizes it beside custom premium copy", () => {
    const saved = {
      plans: {
        comparisonRows: germanRows.filter((row) => row.featureKey !== "caregiverMode"),
        tiers: { premium: { bullets: ["Unser eigener Premium-Text"] } },
      },
    };
    const sanitized = sanitizePaywallContent(saved);
    expect(sanitizePaywallContent(sanitized)).toEqual(sanitized);
    expect(sanitized.plans.comparisonRows.at(-1)).toMatchObject({
      featureKey: "caregiverMode", ...premiumOnly,
    });
    expect(sanitized.plans.tiers.premium.bullets[0]).toBe("Unser eigener Premium-Text");
    expect(sanitized.plans.tiers.premium.bullets).toHaveLength(2);
    expect(localizePaywallPlansContent("en", sanitized.plans).tiers.premium.bullets.at(-1)).toBe(
      "Caregiver mode: invite grandparents & trusted people – no subscription of their own needed",
    );
    expect(localizePaywallPlansContent("es", sanitized.plans).tiers.premium.bullets.at(-1)).toBe(
      "Modo cuidador: invita a abuelos y personas de confianza sin que necesiten su propia suscripción",
    );
  });

  it("backfills feature keys for already saved comparison rows", () => {
    const legacyRows = germanRows.map(
      ({ featureKey: _featureKey, ...row }) => row,
    );
    const sanitized = sanitizePaywallContent({
      plans: { comparisonRows: legacyRows },
    }).plans.comparisonRows;

    expect(sanitized[14].featureKey).toBe("fullHistory");
    expect(sanitized[15].featureKey).toBe("sleepMonthView");
    expect(sanitized[16].featureKey).toBe("dailyMonthView");
    expect(sanitized[23].featureKey).toBe("pregnancyBriefing");
    expect(sanitized[26].featureKey).toBe("fragLotti");
  });

  it("adds both monthly views to comparison rows saved before granular views", () => {
    const legacyRows = germanRows
      .filter(
        (row) =>
          row.featureKey !== "sleepMonthView" &&
          row.featureKey !== "dailyMonthView",
      )
      .map(({ featureKey: _featureKey, ...row }) => row);
    const sanitized = sanitizePaywallContent({
      plans: { comparisonRows: legacyRows },
    }).plans.comparisonRows;

    expect(sanitized).toHaveLength(germanRows.length);
    expect(sanitized[15].featureKey).toBe("sleepMonthView");
    expect(sanitized[16].featureKey).toBe("dailyMonthView");
    expect(sanitized[17].featureKey).toBe("partnerLink");
    expect(sanitized[26].featureKey).toBe("fragLotti");
  });

  it("adds the Unser Tag monthly view to rows saved after the sleep rollout", () => {
    const legacyRows = germanRows
      .filter((row) => row.featureKey !== "dailyMonthView")
      .map(({ featureKey: _featureKey, ...row }) => row);
    const sanitized = sanitizePaywallContent({
      plans: { comparisonRows: legacyRows },
    }).plans.comparisonRows;

    expect(sanitized).toHaveLength(germanRows.length);
    expect(sanitized[15].featureKey).toBe("sleepMonthView");
    expect(sanitized[16].featureKey).toBe("dailyMonthView");
    expect(sanitized[17].featureKey).toBe("partnerLink");
  });
});

describe("paywall tier visibility", () => {
  it("advertises only Lite and Premium while keeping Standard in the data model", () => {
    expect(PAYWALL_VISIBLE_TIER_IDS).toEqual(["lite", "premium"]);
    expect(DEFAULT_PAYWALL_CONTENT.plans.tiers.lite.visible).toBe(true);
    expect(DEFAULT_PAYWALL_CONTENT.plans.tiers.standard.visible).toBe(false);
    expect(DEFAULT_PAYWALL_CONTENT.plans.tiers.premium.visible).toBe(true);
  });

  it("does not let saved legacy content re-enable Standard or hide Lite", () => {
    const sanitized = sanitizePaywallContent({
      plans: {
        tiers: {
          lite: { visible: false },
          standard: { visible: true },
          premium: { visible: true },
        },
      },
    });

    expect(sanitized.plans.tiers.lite.visible).toBe(true);
    expect(sanitized.plans.tiers.standard.visible).toBe(false);
    expect(sanitized.plans.tiers.premium.visible).toBe(true);
  });
});
