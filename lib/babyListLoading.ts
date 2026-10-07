import type { BabyInfo } from './baby';

export type BabyListLoadResult = {
  data: BabyInfo[] | null;
  error: unknown;
  fromCache?: boolean;
  retryable?: boolean;
};

const RETRY_DELAYS_MS = [500, 1500];
const REQUEST_TIMEOUT_MS = 10_000;

export function isTransientBabyListError(error: unknown, status?: number): boolean {
  if (!error) return false;
  const value = error as { message?: string; name?: string; code?: string; status?: number };
  const message = typeof error === 'string' ? error : String(value.message ?? '');
  // Consent withdrawal and explicit cancellation must never become retries.
  if (/consent_required|AbortError|ABORT_ERR/i.test(`${value.name ?? ''} ${value.code ?? ''} ${message}`)) return false;
  if (value.code === '42501' || /^[24]2/.test(value.code ?? '')) return false;
  const httpStatus = status ?? value.status;
  if (httpStatus != null && httpStatus >= 400 && httpStatus < 500 && httpStatus !== 408 && httpStatus !== 429) return false;
  return value.code === '57014' || /^PGRST00[0-3]$/.test(value.code ?? '') ||
    httpStatus === 408 || httpStatus === 429 || (httpStatus != null && httpStatus >= 500) ||
    /network request failed|failed to fetch|fetch failed|networkerror|load failed|timed?\s*out|timeout|ECONNRESET|ECONNREFUSED|ENETUNREACH|EAI_AGAIN/i.test(message);
}

const cancelled = (): BabyListLoadResult => ({
  data: null,
  error: new Error('Baby list request cancelled'),
  retryable: false,
});

function attemptLoad(
  load: (signal: AbortSignal) => Promise<BabyListLoadResult>,
  signal: AbortSignal,
): Promise<BabyListLoadResult> {
  if (signal.aborted) return Promise.resolve(cancelled());
  return new Promise((resolve) => {
    const controller = new AbortController();
    let settled = false;
    const finish = (result: BabyListLoadResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      resolve(result);
    };
    const abort = () => { controller.abort(); finish(cancelled()); };
    const timer = setTimeout(() => {
      controller.abort();
      finish({ data: null, error: new Error('Baby list request timed out'), retryable: true });
    }, REQUEST_TIMEOUT_MS);
    signal.addEventListener('abort', abort);
    Promise.resolve().then(() => controller.signal.aborted ? cancelled() : load(controller.signal)).then(finish, (error: unknown) => {
      finish({ data: null, error, retryable: isTransientBabyListError(error) });
    });
  });
}

function waitForRetry(delay: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', finish);
      resolve();
    };
    const timer = setTimeout(finish, delay);
    signal.addEventListener('abort', finish);
  });
}

/** Only explicit refreshes use retries; startup still follows the existing cache path. */
export async function refreshBabyListWithRetry(
  load: (signal: AbortSignal) => Promise<BabyListLoadResult>,
  signal: AbortSignal,
): Promise<BabyListLoadResult> {
  for (let attempt = 0; ; attempt += 1) {
    const result = await attemptLoad(load, signal);
    if (!result.error || !result.retryable || attempt === RETRY_DELAYS_MS.length || signal.aborted) return result;
    await waitForRetry(RETRY_DELAYS_MS[attempt], signal);
    if (signal.aborted) return cancelled();
  }
}
