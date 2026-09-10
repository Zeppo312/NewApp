import * as Linking from 'expo-linking';
import { normalizeCaretakerCode } from '@/lib/caretaker-access';
export const buildCaretakerInvitationLink = (code: string) => Linking.createURL('/caregiver-join', { queryParams: { code } });
export const formatCaretakerCode = (code: string) => code.toUpperCase().match(/.{1,4}/g)?.join(' ') ?? code;

/** Parse only our invitation links or raw codes; never navigate to scanned URLs. */
export function parseCaretakerQr(data: string, currentInvitationLink: string): string | null {
  const raw = normalizeCaretakerCode(data);
  if (raw) return raw;
  try {
    const scanned = new URL(data.trim());
    const current = new URL(currentInvitationLink);
    const native = scanned.protocol.toLowerCase() === 'com.lottibaby.app:' && (
      (['caregiver', 'caregiver-join'].includes(scanned.hostname) && ['', '/'].includes(scanned.pathname)) ||
      (scanned.hostname === '' && ['/caregiver', '/caregiver-join'].includes(scanned.pathname))
    );
    const sameRoute = scanned.protocol === current.protocol && scanned.host === current.host && scanned.pathname === current.pathname;
    if ((!native && !sameRoute) || scanned.username || scanned.password || scanned.hash) return null;
    const codes = scanned.searchParams.getAll('code');
    return codes.length === 1 ? normalizeCaretakerCode(codes[0]) : null;
  } catch { return null; }
}
