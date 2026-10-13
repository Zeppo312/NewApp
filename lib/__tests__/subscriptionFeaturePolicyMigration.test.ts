import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const policyMigration = readFileSync(
  join(
    root,
    "supabase/migrations/20260822183715_subscription_feature_policy.sql",
  ),
  "utf8",
);
const tierMigration = readFileSync(
  join(root, "supabase/migrations/20270822000000_subscription_tier_cache.sql"),
  "utf8",
);
const sleepMonthViewMigration = readFileSync(
  join(
    root,
    "supabase/migrations/20260823185941_add_sleep_month_view_feature.sql",
  ),
  "utf8",
);
const dailyMonthViewMigration = readFileSync(
  join(root, 'supabase/migrations/20260823191543_add_daily_month_view_feature.sql'),
  'utf8',
);
const serverGate = readFileSync(
  join(root, "supabase/functions/_shared/premiumAccess.ts"),
  "utf8",
);
const entitlementFacade = readFileSync(
  join(root, "lib/entitlements.ts"),
  "utf8",
);
const recipeScreen = readFileSync(
  join(root, "app/recipe-generator.tsx"),
  "utf8",
);
const myRecipesScreen = readFileSync(join(root, "app/my-recipes.tsx"), "utf8");
const loyaltyCardsScreen = readFileSync(
  join(root, "app/loyalty-cards.tsx"),
  "utf8",
);
const activityInputModal = readFileSync(
  join(root, "components/ActivityInputModal.tsx"),
  "utf8",
);
const adminScreen = readFileSync(
  join(root, "app/subscription-features-admin.tsx"),
  "utf8",
);
const sleepTrackerScreen = readFileSync(
  join(root, "app/(tabs)/sleep-tracker.tsx"),
  "utf8",
);
const dailyScreen = readFileSync(
  join(root, 'app/(tabs)/daily_old.tsx'),
  'utf8',
);

describe("subscription feature policy database contracts", () => {
  it("publishes a complete seeded matrix with public read-only access", () => {
    expect(policyMigration).toContain(
      "CREATE TABLE public.subscription_plan_features",
    );
    expect(policyMigration).toContain("ENABLE ROW LEVEL SECURITY");
    expect(policyMigration).toContain(
      "REVOKE ALL ON TABLE public.subscription_plan_features FROM PUBLIC, anon, authenticated",
    );
    expect(policyMigration).toContain(
      "GRANT SELECT ON TABLE public.subscription_plan_features TO anon, authenticated",
    );
    expect(policyMigration).toContain("get_subscription_feature_policy");
  });

  it("keeps publishing admin-only, atomic, versioned and audited", () => {
    expect(policyMigration).toContain("SECURITY DEFINER");
    expect(policyMigration).toContain("profile.is_admin = TRUE");
    expect(policyMigration).toContain("FOR UPDATE");
    expect(policyMigration).toContain("subscription policy version conflict");
    expect(policyMigration).toContain("subscription_policy_audit");
    expect(policyMigration).toContain(
      "REVOKE ALL ON FUNCTION public.admin_publish_subscription_feature_policy(BIGINT, JSONB)",
    );
  });

  it("uses a private tier cache and checks server features independently of the app cache", () => {
    expect(tierMigration).toContain("tier IN ('lite', 'standard', 'premium')");
    expect(serverGate).toContain(".from('subscription_plan_features')");
    expect(serverGate).toContain(".from('lotti_subscription_entitlements')");
    expect(serverGate).not.toContain("clientTier");
  });

  it("covers direct recipe and customer-card routes with the shared policy", () => {
    expect(recipeScreen).toContain('useFeatureAccess("recipes")');
    expect(myRecipesScreen).toContain("useFeatureAccess('recipes')");
    expect(loyaltyCardsScreen).toContain("useFeatureAccess('shoppingList')");
    expect(activityInputModal).toContain("useFeatureAccess('recipes')");
    expect(activityInputModal).toContain("recipesAccess === true");
  });

  it("derives the history limit from the dynamic full-history feature", () => {
    expect(entitlementFacade).toMatch(/useFeatureAccess\(["']fullHistory["']\)/);
    expect(entitlementFacade).toContain(
      "if (access.hasAccess !== false) return null",
    );
  });

  it("gates only the sleep tracker month tab with its own dynamic feature", () => {
    expect(sleepMonthViewMigration).toContain("'sleepMonthView'");
    expect(sleepMonthViewMigration).toContain(
      "('sleepMonthView', 'lite', FALSE)",
    );
    expect(sleepMonthViewMigration).toContain(
      "('sleepMonthView', 'standard', TRUE)",
    );
    expect(sleepMonthViewMigration).toContain("SET version = version + 1");
    expect(sleepTrackerScreen).toMatch(
      /useFeatureAccess\(["']sleepMonthView["']\)/,
    );
    expect(sleepTrackerScreen).toContain("lock_sleepMonthView");
    expect(sleepTrackerScreen).toMatch(
      /tab === ["']month["'] && isMonthViewLocked/,
    );
  });

  it("gates only the Unser Tag month tab with its own dynamic feature", () => {
    expect(dailyMonthViewMigration).toContain("'dailyMonthView'");
    expect(dailyMonthViewMigration).toContain(
      "('dailyMonthView', 'lite', FALSE)",
    );
    expect(dailyMonthViewMigration).toContain(
      "('dailyMonthView', 'standard', TRUE)",
    );
    expect(dailyMonthViewMigration).toContain("SET version = version + 1");
    expect(dailyScreen).toMatch(/useFeatureAccess\(["']dailyMonthView["']\)/);
    expect(dailyScreen).toContain("lock_dailyMonthView");
    expect(dailyScreen).toMatch(
      /tab === ["']month["'] && isMonthViewLocked/,
    );
  });

  it("shows feature groups and their controlled app areas in the admin UI", () => {
    expect(adminScreen).toContain("FEATURE_ADMIN_COPY[feature].section");
    expect(adminScreen).toContain("copy.areas.map");
    expect(adminScreen).toContain("copy.serverEnforced");
    expect(adminScreen).toContain("isPaywallComparisonIncluded");
    expect(adminScreen).toContain("localizedPaywallRows.map");
  });
});
