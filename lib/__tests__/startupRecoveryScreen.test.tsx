import React from 'react';
import { act, create, ReactTestRenderer } from 'react-test-renderer';
import { AppState } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { StartupRecovery, STARTUP_RECOVERY_DELAY_MS } from '../../components/StartupRecovery';
jest.mock('expo-splash-screen', () => ({ hideAsync: jest.fn().mockResolvedValue(undefined) }));
describe('bounded startup recovery screen', () => {
  let tree: ReactTestRenderer;
  beforeEach(() => { jest.useFakeTimers(); jest.clearAllMocks(); Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' }); });
  afterEach(() => { act(() => tree?.unmount()); jest.useRealTimers(); });
  it('reveals recovery after 15 seconds, deduplicates requests, and retries after network errors', async () => {
    let resolve!: () => void;
    const retry = jest.fn().mockImplementationOnce(() => new Promise<void>(r => { resolve=r; })).mockRejectedValue(new Error('offline'));
    await act(async () => { tree=create(<StartupRecovery locale="de" onRetry={retry}/>); });
    expect(tree.root.findAllByProps({testID:'startup-retry'})).toHaveLength(0);
    await act(async () => { jest.advanceTimersByTime(STARTUP_RECOVERY_DELAY_MS); });
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
    const button=()=>tree.root.findByProps({testID:'startup-retry'});
    act(() => { button().props.onPress(); button().props.onPress(); });
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(retry).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
    expect(button().props.disabled).toBe(false);
    await act(async () => { jest.advanceTimersByTime(15_000); });
    expect(retry).toHaveBeenCalledTimes(2); expect(button().props.disabled).toBe(false);
  });
  it('does not hide the splash later after successful startup unmounts the waiting screen', async () => {
    await act(async () => { tree=create(<StartupRecovery locale="en" onRetry={async()=>{}}/>); });
    act(() => tree.unmount());
    await act(async () => { jest.advanceTimersByTime(30_000); });
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
  });
});
