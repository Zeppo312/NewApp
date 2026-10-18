import { AppState, type AppStateStatus } from 'react-native';
import { supabase } from '@/lib/supabase';
import { invokeForegroundAdvisor } from '../advisor/foregroundRequest';
import { handleDisabledAdvisorDaily } from '../../supabase/functions/advisor-daily/handler';

jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

describe('Care runs only while the app is active', () => {
  let change: (state: AppStateStatus) => void;
  const remove = jest.fn();
  const invoke = supabase.functions.invoke as jest.Mock;
  const setState = (state: AppStateStatus) => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
  };
  beforeEach(() => {
    jest.clearAllMocks();
    setState('active');
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, listener) => {
      change = listener;
      return { remove };
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it.each(['background', 'inactive', null] as const)('does not transmit from %s', async (state) => {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
    expect(await invokeForegroundAdvisor({ mode: 'pregnancy' })).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it('returns an active request and removes its listener', async () => {
    const result = { main: { id: 'care', body: 'Test' } };
    invoke.mockResolvedValue({ data: result, error: null });
    expect(await invokeForegroundAdvisor({ babyId: 'test' })).toEqual(result);
    expect(invoke).toHaveBeenCalledWith('advisor-generate', expect.objectContaining({ body: { babyId: 'test' } }));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('aborts on backgrounding and discards a late result even after returning', async () => {
    let finish!: (result: unknown) => void;
    invoke.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const pending = invokeForegroundAdvisor({ babyId: 'test' });
    await Promise.resolve();
    const signal = invoke.mock.calls[0][1].signal as AbortSignal;
    setState('background'); change('background');
    expect(signal.aborted).toBe(true);
    setState('active'); change('active');
    finish({ data: { main: { id: 'late' } }, error: null });
    expect(await pending).toBeNull();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('removes the listener after network failure', async () => {
    invoke.mockRejectedValue(new Error('offline'));
    expect(await invokeForegroundAdvisor({})).toBeNull();
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it('ignores even forced invocations of the retired scheduled endpoint', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');
    const response = handleDisabledAdvisorDaily(new Request('https://example.test/advisor-daily', {
      method: 'POST', body: JSON.stringify({ force: true, userId: 'test' }),
    }));
    expect(await response.json()).toEqual({ disabled: true, processed: 0, reason: 'foreground_only' });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
  });
});
