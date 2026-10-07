import { resolveFamilySubscriptionAccess } from '../_shared/premiumAccess.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
type Dependencies = {
  env: (key: string) => string | undefined;
  createAdmin: (url: string, key: string) => any;
  resolve?: typeof resolveFamilySubscriptionAccess;
};
export const createFamilyAccessHandler = ({ env, createAdmin, resolve = resolveFamilySubscriptionAccess }: Dependencies) => async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const url = env('SUPABASE_URL'); const key = env('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ error: 'not_configured' }, 503);
  const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return json({ error: 'unauthorized' }, 401);
  const admin = createAdmin(url, key);
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data?.user) return json({ error: 'unauthorized' }, 401);
    // Identity comes only from the verified session, never from the body.
    const state = await resolve(admin, data.user.id, env('REVENUECAT_SECRET_API_KEY'), env('REVENUECAT_PROJECT_ID'), {
      premium: env('REVENUECAT_PREMIUM_ENTITLEMENT_ID'),
      standard: env('REVENUECAT_STANDARD_ENTITLEMENT_ID'), lite: env('REVENUECAT_LITE_ENTITLEMENT_ID'),
    });
    const { sponsorId: _private, ...result } = state;
    return json(result);
  } catch { return json({ error: 'family_verification_unavailable' }, 503); }
};
