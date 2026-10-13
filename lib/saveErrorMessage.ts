import { offlineText } from './offlineTranslations';

/** Keep native/network diagnostics in logs, never in a user-facing save alert. */
export function saveErrorMessage(error: unknown, locale: string, fallback: string): string {
  const detail = error && typeof error === 'object'
    ? error as { message?: unknown; code?: unknown; status?: unknown; name?: unknown }
    : null;
  // An authorization or validation rejection is not an offline failure.
  if ([401, 403].includes(Number(detail?.status)) || detail?.code === '42501'
    || typeof detail?.code === 'string' && /^(22|23)/.test(detail.code)
    || detail?.name === 'DataConsentRequiredError') return fallback;
  const message = typeof detail?.message === 'string' ? detail.message : typeof error === 'string' ? error : '';
  if (detail?.name === 'AbortError' || /network|fetch failed|failed to fetch|network request failed|timeout|timed out|connection|internet|offline/i.test(message)) {
    // A lost response may follow a committed write: do not promise that nothing was saved.
    return offlineText(locale, 'saveConnectionLost');
  }
  return fallback;
}
