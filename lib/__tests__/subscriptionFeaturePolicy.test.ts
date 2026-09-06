import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "../supabase";
import {
  APP_FEATURES,
  DEFAULT_FEATURE_MATRIX,
  FEATURE_ADMIN_COPY,
  featureAllowedByPolicy,
  getCurrentSubscriptionFeaturePolicy,
  hydrateSubscriptionFeaturePolicy,
  refreshSubscriptionFeaturePolicy,
  resetSubscriptionFeaturePolicyForTests,
  sanitizeSubscriptionFeaturePolicy,
} from "../subscriptionFeaturePolicy";

const storedPolicy = {
  schemaVersion: 1,
  policyVersion: 7,
  updatedAt: "2026-08-22T12:00:00.000Z",
  features: {
    ...DEFAULT_FEATURE_MATRIX,
    voiceLog: ["standard", "premium"],
  },
};

describe("dynamic subscription feature policy", () => {
  beforeEach(async () => {
    jest.restoreAllMocks();
    resetSubscriptionFeaturePolicyForTests();
    await AsyncStorage.clear();
  });

  it("ships the current access matrix as the safe offline fallback", () => {
    expect(APP_FEATURES).toHaveLength(14);
    const policy = getCurrentSubscriptionFeaturePolicy();
    expect(policy.features).toEqual(DEFAULT_FEATURE_MATRIX);
    expect(featureAllowedByPolicy(policy, "basisTracker", "lite")).toBe(true);
    expect(featureAllowedByPolicy(policy, "partnerLink", "lite")).toBe(true);
    expect(featureAllowedByPolicy(policy, "partnerLink", "standard")).toBe(true);
    expect(featureAllowedByPolicy(policy, "partnerLink", "premium")).toBe(true);
    expect(featureAllowedByPolicy(policy, "shoppingList", "lite")).toBe(true);
    expect(featureAllowedByPolicy(policy, "shoppingList", "standard")).toBe(true);
    expect(featureAllowedByPolicy(policy, "shoppingList", "premium")).toBe(true);
    expect(featureAllowedByPolicy(policy, "recipes", "lite")).toBe(true);
    expect(featureAllowedByPolicy(policy, "voiceLog", "standard")).toBe(false);
    expect(featureAllowedByPolicy(policy, "sleepMonthView", "lite")).toBe(
      false,
    );
    expect(featureAllowedByPolicy(policy, "sleepMonthView", "standard")).toBe(
      true,
    );
    expect(featureAllowedByPolicy(policy, "dailyMonthView", "lite")).toBe(
      false,
    );
    expect(featureAllowedByPolicy(policy, "dailyMonthView", "standard")).toBe(
      true,
    );
  });

  it("documents every configurable group and keeps the base tracker immutable", () => {
    expect(Object.keys(FEATURE_ADMIN_COPY).sort()).toEqual(
      [...APP_FEATURES].sort(),
    );
    APP_FEATURES.forEach((feature) => {
      expect(FEATURE_ADMIN_COPY[feature].areas.length).toBeGreaterThan(0);
      expect(["baby", "ai", "pregnancy"]).toContain(
        FEATURE_ADMIN_COPY[feature].section,
      );
    });
    expect(FEATURE_ADMIN_COPY.basisTracker.editable).toBe(false);
  });

  it("rejects incomplete, unknown and malformed server payloads", () => {
    expect(sanitizeSubscriptionFeaturePolicy(storedPolicy)).toEqual(
      storedPolicy,
    );
    expect(
      sanitizeSubscriptionFeaturePolicy({
        ...storedPolicy,
        features: { ...storedPolicy.features, voiceLog: undefined },
      }),
    ).toBeNull();
    expect(
      sanitizeSubscriptionFeaturePolicy({
        ...storedPolicy,
        features: { ...storedPolicy.features, invented: ["premium"] },
      }),
    ).toBeNull();
    expect(
      sanitizeSubscriptionFeaturePolicy({
        ...storedPolicy,
        features: {
          ...storedPolicy.features,
          voiceLog: ["premium", "premium"],
        },
      }),
    ).toBeNull();
  });

  it("keeps the last-known-good cache when a refresh fails", async () => {
    await AsyncStorage.setItem(
      "subscription_feature_policy_v1",
      JSON.stringify({ policy: storedPolicy, fetchedAt: 1 }),
    );
    await hydrateSubscriptionFeaturePolicy();
    expect(getCurrentSubscriptionFeaturePolicy().policyVersion).toBe(7);

    jest.spyOn(supabase, "rpc").mockResolvedValue({
      data: null,
      error: new Error("offline"),
    } as never);

    await expect(
      refreshSubscriptionFeaturePolicy({ force: true }),
    ).rejects.toThrow("offline");
    expect(getCurrentSubscriptionFeaturePolicy()).toEqual(storedPolicy);
  });

  it("keeps recipes available when the old restriction is cached or returned by the server", async () => {
    const oldPolicy = {
      ...storedPolicy,
      features: { ...DEFAULT_FEATURE_MATRIX, recipes: ["standard", "premium"] as const },
    };
    await AsyncStorage.setItem(
      "subscription_feature_policy_v1",
      JSON.stringify({ policy: oldPolicy, fetchedAt: Date.now() }),
    );
    const cached = await hydrateSubscriptionFeaturePolicy();
    expect(featureAllowedByPolicy(cached, "recipes", "lite")).toBe(true);
    expect(cached.features.recipes).toEqual(["lite", "standard", "premium"]);

    jest.spyOn(supabase, "rpc").mockResolvedValue({ data: oldPolicy, error: null } as never);
    const refreshed = await refreshSubscriptionFeaturePolicy({ force: true });
    expect(featureAllowedByPolicy(refreshed, "recipes", "lite")).toBe(true);
    expect(refreshed.features.recipes).toEqual(["lite", "standard", "premium"]);
    expect(featureAllowedByPolicy(refreshed, "voiceLog", "lite")).toBe(false);
  });
});
