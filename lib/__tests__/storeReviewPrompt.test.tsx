import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { StoreReviewPrompt } from '@/components/StoreReviewPrompt';
import { emitLottiMoment } from '@/lib/lottiMomentEvents';
import { recordReviewMoment, requestReviewIfEligible } from '@/lib/storeReview';

jest.mock('@/lib/storeReview', () => ({ recordReviewMoment: jest.fn(async () => {}), requestReviewIfEligible: jest.fn(async () => false) }));

let tree: ReactTestRenderer;
beforeEach(() => {
  jest.useFakeTimers(); jest.clearAllMocks();
  Object.defineProperty(AppState, 'currentState', { configurable: true, writable: true, value: 'active' });
});
afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });

it('waits for a saved moment and a quiet return home, then cancels when leaving', () => {
  act(() => { tree = create(<StoreReviewPrompt userId="parent" canPrompt={false} />); });
  act(() => { emitLottiMoment('feeding'); jest.advanceTimersByTime(10000); });
  expect(recordReviewMoment).toHaveBeenCalledTimes(1);
  expect(requestReviewIfEligible).not.toHaveBeenCalled();
  act(() => tree.update(<StoreReviewPrompt userId="parent" canPrompt />));
  act(() => jest.advanceTimersByTime(7000));
  act(() => tree.update(<StoreReviewPrompt userId="parent" canPrompt={false} />));
  act(() => jest.advanceTimersByTime(10000));
  expect(requestReviewIfEligible).not.toHaveBeenCalled();
  act(() => tree.update(<StoreReviewPrompt userId="parent" canPrompt />));
  act(() => jest.advanceTimersByTime(8000));
  expect(requestReviewIfEligible).toHaveBeenCalledTimes(1);
  const guard = jest.mocked(requestReviewIfEligible).mock.calls[0][0];
  expect(guard()).toBe(true);
  act(() => tree.update(<StoreReviewPrompt userId={null} canPrompt={false} />));
  expect(guard()).toBe(false);
  act(() => tree.update(<StoreReviewPrompt userId="other" canPrompt />));
  act(() => jest.advanceTimersByTime(10000));
  expect(requestReviewIfEligible).toHaveBeenCalledTimes(1);
});

it('requires a new save after consuming an opportunity and skips background calls', () => {
  act(() => { tree = create(<StoreReviewPrompt userId="parent" canPrompt />); });
  act(() => jest.advanceTimersByTime(10000));
  expect(requestReviewIfEligible).not.toHaveBeenCalled();
  act(() => emitLottiMoment('care'));
  act(() => jest.advanceTimersByTime(8000));
  expect(requestReviewIfEligible).toHaveBeenCalledTimes(1);
  act(() => tree.update(<StoreReviewPrompt userId="parent" canPrompt={false} />));
  act(() => tree.update(<StoreReviewPrompt userId="parent" canPrompt />));
  act(() => jest.advanceTimersByTime(10000));
  expect(requestReviewIfEligible).toHaveBeenCalledTimes(1);
  act(() => emitLottiMoment('sleep'));
  AppState.currentState = 'background';
  act(() => jest.advanceTimersByTime(8000));
  const guard = jest.mocked(requestReviewIfEligible).mock.calls[1][0];
  expect(guard()).toBe(false);
});
