import { DeletionError, POLICY_VERSION, publicResponse, readSmallBody, workerRpc } from '../_shared/accountDeletion/contracts.ts';

type Dependencies = { env: (key: string) => string | undefined; createAdmin: (url: string, key: string) => any };
// Optional restriction for a temporary native test in the existing family QA.
// It narrows acceptance; all ordinary readiness and fresh-OTP gates still apply.
// An accidental production or malformed configuration fails closed.
const FAMILY_QA_URL = 'https://ggyonianphloycmqrwvj.supabase.co';
const uuid = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
// Call only AFTER getUser(token) has validated this exact token with Auth.
// last_sign_in_at alone is account-wide: another device's fresh login must
// never make an old stolen session eligible for a destructive request.
function hasRecentVerification(token: string, userId: string): boolean {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const claims = JSON.parse(atob(part.padEnd(Math.ceil(part.length / 4) * 4, '=')));
    const now = Date.now() / 1000;
    return claims.sub === userId && claims.role === 'authenticated' && Array.isArray(claims.amr) &&
      claims.amr.some((entry: any) => entry?.method === 'otp' && typeof entry.timestamp === 'number' &&
        Number.isFinite(entry.timestamp) && entry.timestamp > now - 600 && entry.timestamp <= now + 30);
  } catch { return false; }
}
export const createRequestHandler = ({ env, createAdmin }: Dependencies) => async (req: Request) => {
  const origin = req.headers.get('origin');
  const allowedOrigins = (env('DELETION_WEB_ORIGINS') ?? 'https://lottibaby.de,https://www.lottibaby.de').split(',').map((s) => s.trim());
  if (origin && !allowedOrigins.includes(origin)) return publicResponse({ error: 'origin_not_allowed' }, 403);
  const corsOrigin = origin ?? undefined;
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
    ...(corsOrigin ? { 'Access-Control-Allow-Origin': corsOrigin, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  } });
  if (req.method === 'GET') {
    // No job acceptance, mail or sign-out while checking availability.
    const url = env('SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key || env('ACCOUNT_DELETION_ENABLED') !== 'true') return publicResponse({ available: false }, 200, corsOrigin);
    const qaTestUserId = env('ACCOUNT_DELETION_QA_TEST_USER_ID');
    if (qaTestUserId !== undefined && (url !== FAMILY_QA_URL || !uuid.test(qaTestUserId))) return publicResponse({ available: false }, 200, corsOrigin);
    try {
      const admin = createAdmin(url, key);
      if (qaTestUserId !== undefined) {
        const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
        if (!token) return publicResponse({ available: false }, 200, corsOrigin);
        const verified = await admin.auth.getUser(token);
        if (verified.error || verified.data?.user?.id !== qaTestUserId) return publicResponse({ available: false }, 200, corsOrigin);
      }
      const { data, error } = await admin.rpc('account_deletion_readiness');
      if (error) return publicResponse({ error: 'temporary_failure' }, 503, corsOrigin);
      return publicResponse({ available: data === true }, 200, corsOrigin);
    } catch { return publicResponse({ error: 'temporary_failure' }, 503, corsOrigin); }
  }
  if (req.method !== 'POST') return publicResponse({ error: 'method_not_allowed' }, 405, corsOrigin);
  try {
    const url = env('SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key || env('ACCOUNT_DELETION_ENABLED') !== 'true') return publicResponse({ error: 'deletion_unavailable' }, 503, corsOrigin);
    const qaTestUserId = env('ACCOUNT_DELETION_QA_TEST_USER_ID');
    if (qaTestUserId !== undefined && (url !== FAMILY_QA_URL || !uuid.test(qaTestUserId))) return publicResponse({ error: 'deletion_unavailable' }, 503, corsOrigin);
    const token = req.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return publicResponse({ error: 'unauthorized' }, 401, corsOrigin);
    const admin = createAdmin(url, key);
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return publicResponse({ error: 'unauthorized' }, 401, corsOrigin);
    if (qaTestUserId !== undefined && data.user.id !== qaTestUserId) return publicResponse({ error: 'deletion_unavailable' }, 503, corsOrigin);
    const body = await readSmallBody(req);
    if (body.confirm !== true || body.policyVersion !== POLICY_VERSION || !['account','data'].includes(String(body.scope)) ||
      !['app','web'].includes(String(body.source)) || Object.keys(body).some((k) => !['confirm','policyVersion','scope','source'].includes(k))) {
      return publicResponse({ error: 'invalid_request' }, 400, corsOrigin);
    }
    if (!hasRecentVerification(token, data.user.id)) {
      return publicResponse({ error: 'recent_authentication_required' }, 403, corsOrigin);
    }
    const result = await workerRpc(admin, 'accept', { userId: data.user.id, scope: body.scope, source: body.source });
    if (!result?.requestId || !result?.status) throw new DeletionError('invalid_server_response');
    // Durable job survives a failed global sign-out; worker retries revocation.
    await admin.auth.admin.signOut(token, 'global').catch(() => undefined);
    return publicResponse(result, 202, corsOrigin);
  } catch (e) {
    const code = e instanceof DeletionError ? e.code : 'temporary_failure';
    const status = code === 'recent_authentication_required' ? 403 : code === 'request_too_large' ? 413 : code === 'invalid_request' ? 400 : 503;
    return publicResponse({ error: code }, status, corsOrigin);
  }
};
