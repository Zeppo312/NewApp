const CODE_PATTERN = /^[A-Z0-9]{8}$/i;

/** Read invitation data without opening arbitrary scanned URLs. */
export function parseAccountLinkingQr(data: string, currentInvitationLink: string): string | null {
  const value = data.trim();
  if (CODE_PATTERN.test(value)) return value.toUpperCase();

  try {
    const scanned = new URL(value);
    const current = new URL(currentInvitationLink);
    const isNativeInvitation = scanned.protocol === 'com.lottibaby.app:' && (
      (scanned.hostname === 'invite' && ['', '/'].includes(scanned.pathname)) ||
      (scanned.hostname === '' && scanned.pathname === '/invite')
    );
    const isCurrentInvitation = scanned.protocol === current.protocol &&
      scanned.host === current.host && scanned.pathname === current.pathname;

    if ((!isNativeInvitation && !isCurrentInvitation) || scanned.username || scanned.password) {
      return null;
    }
    const codes = scanned.searchParams.getAll('code');
    return codes.length === 1 && CODE_PATTERN.test(codes[0]) ? codes[0].toUpperCase() : null;
  } catch {
    return null;
  }
}
