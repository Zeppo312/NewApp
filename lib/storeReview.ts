import AsyncStorage from '@react-native-async-storage/async-storage';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

const STORAGE_KEY = 'lotti:store-review:v1';
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_AGE_MS = 7 * DAY_MS;
const COOLDOWN_MS = 120 * DAY_MS;
const YEAR_MS = 365 * DAY_MS;

type ReviewState = {
  firstMomentAt: number;
  moments: number;
  days: string[];
  attempts: number[];
};

// Only aggregate local usage; no baby details, account IDs or rating results.
function decodeState(raw: string | null): ReviewState | null {
  if (!raw) return null;
  const value = JSON.parse(raw);
  if (!value || !Number.isFinite(value.firstMomentAt) || value.firstMomentAt < 0 ||
      !Number.isInteger(value.moments) || value.moments < 1 ||
      !Array.isArray(value.days) || value.days.some((day: unknown) => typeof day !== 'string') ||
      !Array.isArray(value.attempts) || value.attempts.some((at: unknown) => typeof at !== 'number' || !Number.isFinite(at) || at < 0)) {
    throw new Error('Invalid review state');
  }
  return value;
}

// Serialize read/modify/write operations, including simultaneous save events.
let pending: Promise<unknown> = Promise.resolve();
function serialize<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
  const result = pending.then(operation).catch(() => fallback);
  pending = result;
  return result;
}

export function recordReviewMoment(now = Date.now()): Promise<void> {
  return serialize(async () => {
    const state = decodeState(await AsyncStorage.getItem(STORAGE_KEY)) ?? {
      firstMomentAt: now, moments: 0, days: [], attempts: [],
    };
    const day = new Date(now).toLocaleDateString('en-CA');
    state.moments = Math.min(5, state.moments + 1);
    state.days = [...new Set([...state.days, day])].slice(-3);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, undefined);
}

export function requestReviewIfEligible(stillAllowed: () => boolean, now = Date.now()): Promise<boolean> {
  return serialize(async () => {
    if (__DEV__ || (Platform.OS !== 'ios' && Platform.OS !== 'android') || !stillAllowed()) return false;
    const state = decodeState(await AsyncStorage.getItem(STORAGE_KEY));
    if (!state || state.moments < 5 || state.days.length < 3 || now - state.firstMomentAt < MIN_AGE_MS) return false;
    const attempts = state.attempts.filter(at => now - at < YEAR_MS);
    if (attempts.length >= 3 || attempts.some(at => now - at < COOLDOWN_MS)) return false;

    // Older installed binaries may receive JS updates without this native module.
    // Check before importing expo-store-review, which otherwise throws on load.
    if (!requireOptionalNativeModule('ExpoStoreReview')) return false;
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- guarded lazy load for older native binaries
    const StoreReview: typeof import('expo-store-review') = require('expo-store-review');
    if (!await StoreReview.isAvailableAsync() || !stillAllowed()) return false;

    // Reserve before invoking: the OS does not disclose whether it showed a prompt
    // or whether a rating was submitted. Never retry immediately after an error.
    state.attempts = [...attempts, now];
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (!stillAllowed()) return false;
    await StoreReview.requestReview();
    return true;
  }, false);
}
