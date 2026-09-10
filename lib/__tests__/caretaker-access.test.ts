import { caretakerGrantState, caretakerRequest, caretakerSnapshotLease, normalizeCaretakerCode, validateCaretakerPeriod } from '../caretaker-access';
import { supabase } from '../supabase';
jest.mock('@/lib/supabase', () => ({ supabase: { rpc: jest.fn() } }));

const grant = { caregiver_id: 'grandma', revoked_at: null, starts_at: '2026-09-09T10:00:00Z', ends_at: '2026-09-09T14:00:00Z' };
describe('caretaker access boundaries', () => {
  it('opens at the exact start and closes at the exact end', () => {
    expect(caretakerGrantState(grant, Date.parse(grant.starts_at) - 1)).toBe('scheduled');
    expect(caretakerGrantState(grant, Date.parse(grant.starts_at))).toBe('active');
    expect(caretakerGrantState(grant, Date.parse(grant.ends_at))).toBe('ended');
  });
  it('revocation overrides the scheduled window', () => {
    expect(caretakerGrantState({ ...grant, revoked_at: grant.starts_at }, Date.parse(grant.starts_at))).toBe('revoked');
  });
  it('rejects unbounded/invalid dates and history beyond two days', () => {
    expect(validateCaretakerPeriod(new Date(grant.starts_at), new Date(grant.ends_at), 2, 0)).toBe(true);
    expect(validateCaretakerPeriod(new Date(grant.starts_at), new Date(grant.starts_at), 0, 0)).toBe(false);
    expect(validateCaretakerPeriod(new Date('invalid'), new Date(grant.ends_at), 0, 0)).toBe(false);
    expect(validateCaretakerPeriod(new Date(grant.starts_at), new Date(grant.ends_at), 3, 0)).toBe(false);
    expect(validateCaretakerPeriod(new Date(grant.starts_at), new Date(grant.ends_at), 1.5, 0)).toBe(false);
  });
  it('accepts formatted caretaker tokens, but never permanent partner codes or arbitrary URLs', () => {
    expect(normalizeCaretakerCode('01234567-89AB-CDEF-0123-456789abcdef')).toBe('0123456789abcdef0123456789abcdef');
    expect(normalizeCaretakerCode('ABCD2345')).toBeNull();
    expect(normalizeCaretakerCode('https://example.com')).toBeNull();
  });
  it('limits display to the remaining server time and accounts for request latency', () => {
    expect(caretakerSnapshotLease({ ends_at: grant.ends_at, server_now: '2026-09-09T13:59:59Z' }, 100)).toBe(1100);
    expect(caretakerSnapshotLease({ ends_at: grant.ends_at, server_now: grant.starts_at }, 100)).toBe(30100);
    expect(caretakerSnapshotLease({ ends_at: grant.ends_at, server_now: grant.ends_at }, 100)).toBe(100);
  });
});

it('aborts an unresponsive parent request and reports the failure', async () => {
  jest.useFakeTimers();
  try {
    const abortSignal = jest.fn((signal: AbortSignal) => new Promise(resolve => {
      signal.addEventListener('abort', () => resolve({ data: null, error: { message: 'request_aborted' } }));
    }));
    jest.mocked(supabase.rpc).mockReturnValue({ abortSignal } as any);
    const pending = caretakerRequest('create');
    const expectation = expect(pending).rejects.toMatchObject({ message: 'request_aborted' });
    jest.advanceTimersByTime(25_000);
    await expectation;
    expect(abortSignal.mock.calls[0][0].aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  } finally { jest.useRealTimers(); }
});
