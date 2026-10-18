import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import * as StoreReview from 'expo-store-review';
import { recordReviewMoment, requestReviewIfEligible } from '@/lib/storeReview';

jest.mock('expo-modules-core', () => ({
  ...jest.requireActual('expo-modules-core'), requireOptionalNativeModule: jest.fn(() => ({})),
}));
jest.mock('expo-store-review', () => ({
  isAvailableAsync: jest.fn(async () => true), requestReview: jest.fn(async () => {}),
}));

const KEY = 'lotti:store-review:v1';
const DAY = 86400000;
const START = Date.parse('2026-10-01T12:00:00Z');
const allowed = () => true;
const initialDev = __DEV__;
const initialPlatform = Platform.OS;

beforeEach(async () => {
  jest.clearAllMocks();
  await AsyncStorage.clear();
  (globalThis as any).__DEV__ = false;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  jest.mocked(requireOptionalNativeModule).mockReturnValue({});
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(true);
  jest.mocked(StoreReview.requestReview).mockResolvedValue(undefined);
});
afterEach(() => {
  (globalThis as any).__DEV__ = initialDev;
  Object.defineProperty(Platform, 'OS', { configurable: true, value: initialPlatform });
  jest.restoreAllMocks();
});

async function qualify() {
  await recordReviewMoment(START);
  await recordReviewMoment(START + DAY);
  await Promise.all(Array.from({ length: 3 }, () => recordReviewMoment(START + 2 * DAY)));
}

it('requires five saved moments, three distinct days and seven elapsed days', async () => {
  expect(await requestReviewIfEligible(allowed, START)).toBe(false);
  await Promise.all(Array.from({ length: 5 }, () => recordReviewMoment(START)));
  expect(await requestReviewIfEligible(allowed, START + 8 * DAY)).toBe(false);
  await recordReviewMoment(START + DAY);
  await recordReviewMoment(START + 2 * DAY);
  expect(await requestReviewIfEligible(allowed, START + 7 * DAY - 1)).toBe(false);
  expect(await requestReviewIfEligible(allowed, START + 7 * DAY)).toBe(true);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
});

it('serializes simultaneous requests and keeps a persistent 120-day cooldown and rolling annual cap', async () => {
  await qualify();
  const now = START + 7 * DAY;
  expect(await Promise.all([requestReviewIfEligible(allowed, now), requestReviewIfEligible(allowed, now)])).toEqual([true, false]);
  expect(await requestReviewIfEligible(allowed, now + 119 * DAY)).toBe(false);
  expect(await requestReviewIfEligible(allowed, now + 120 * DAY)).toBe(true);
  expect(await requestReviewIfEligible(allowed, now + 240 * DAY)).toBe(true);
  expect(await requestReviewIfEligible(allowed, now + 360 * DAY)).toBe(false);
  expect(await requestReviewIfEligible(allowed, now + 365 * DAY)).toBe(true);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(4);
});

it('safely skips older binaries, TestFlight/unavailable APIs, web and development without spending quota', async () => {
  await qualify();
  const now = START + 8 * DAY;
  jest.mocked(requireOptionalNativeModule).mockReturnValue(null);
  expect(await requestReviewIfEligible(allowed, now)).toBe(false);
  jest.mocked(requireOptionalNativeModule).mockReturnValue({});
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(false);
  expect(await requestReviewIfEligible(allowed, now)).toBe(false);
  jest.mocked(StoreReview.isAvailableAsync).mockResolvedValue(true);
  Object.defineProperty(Platform, 'OS', { value: 'web' });
  expect(await requestReviewIfEligible(allowed, now)).toBe(false);
  Object.defineProperty(Platform, 'OS', { value: 'android' });
  (globalThis as any).__DEV__ = true;
  expect(await requestReviewIfEligible(allowed, now)).toBe(false);
  (globalThis as any).__DEV__ = false;
  expect(await requestReviewIfEligible(allowed, now)).toBe(true);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
});

it('rechecks navigation/auth after asynchronous native availability', async () => {
  await qualify();
  let visible = true;
  jest.mocked(StoreReview.isAvailableAsync).mockImplementationOnce(async () => { visible = false; return true; });
  expect(await requestReviewIfEligible(() => visible, START + 8 * DAY)).toBe(false);
  expect(StoreReview.requestReview).not.toHaveBeenCalled();
});

it('fails quietly on corrupt storage and storage failures; does not repeatedly retry native errors', async () => {
  await AsyncStorage.setItem(KEY, '{broken');
  expect(await requestReviewIfEligible(allowed, START + 8 * DAY)).toBe(false);
  await AsyncStorage.clear();
  await qualify();
  jest.spyOn(AsyncStorage, 'setItem').mockRejectedValueOnce(new Error('disk full'));
  expect(await requestReviewIfEligible(allowed, START + 8 * DAY)).toBe(false);
  expect(StoreReview.requestReview).not.toHaveBeenCalled();
  jest.mocked(StoreReview.requestReview).mockRejectedValueOnce(new Error('native failure'));
  expect(await requestReviewIfEligible(allowed, START + 8 * DAY)).toBe(false);
  expect(await requestReviewIfEligible(allowed, START + 9 * DAY)).toBe(false);
  expect(StoreReview.requestReview).toHaveBeenCalledTimes(1);
});
