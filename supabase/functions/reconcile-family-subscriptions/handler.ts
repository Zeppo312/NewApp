import { syncRevenueCatTier } from '../_shared/premiumAccess.ts';
import { secureEqual } from '../_shared/accountDeletion/contracts.ts';
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
export const createReconcileHandler = ({ env, createAdmin, sync = syncRevenueCatTier }: {
  env: (key: string) => string | undefined; createAdmin: (url: string, key: string) => any; sync?: typeof syncRevenueCatTier;
}) => async (request: Request) => {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const secret = env('SUBSCRIPTION_RECONCILE_SECRET');
  if (!secret) return json({ error: 'not_configured' }, 503);
  if (!secureEqual(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401);
  const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
  const rcKey = env('REVENUECAT_SECRET_API_KEY'), project = env('REVENUECAT_PROJECT_ID');
  if (!url || !key || !rcKey || !project) return json({ error: 'not_configured' }, 503);
  try {
    const admin = createAdmin(url, key);
    const { data, error } = await admin.rpc('claim_family_subscription_rechecks');
    if (error || !Array.isArray(data)) return json({ error: 'queue_unavailable' }, 503);
    let failed = 0;
    // Four at a time, at most 20 accounts per invocation (five 12-second batches).
    for (let i = 0; i < data.length; i += 4) {
      const results = await Promise.allSettled(data.slice(i, i+4).map(userId => sync(admin, userId, rcKey, project, {
        premium: env('REVENUECAT_PREMIUM_ENTITLEMENT_ID'), standard: env('REVENUECAT_STANDARD_ENTITLEMENT_ID'), lite: env('REVENUECAT_LITE_ENTITLEMENT_ID'),
      }, 'revenuecat_api')));
      failed += results.filter(result => result.status === 'rejected').length;
    }
    return json({ checked: data.length, failed }, failed ? 503 : 200);
  } catch { return json({ error: 'reconciliation_unavailable' }, 503); }
};
