// Temporary operator endpoint. A dedicated random operator secret authorizes
// repair; user/anon/service JWTs alone never suffice. Remove after reconciliation.
import { syncRevenueCatTier, verifySubscriptionFeatureAccess } from '../_shared/premiumAccess.ts';
import { fetchRevenueCatTier } from '../_shared/revenuecatState.ts';
type Dependencies = { env: (name: string) => string | undefined; createAdmin: (url: string, key: string) => any };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
});
export const createRepairHandler = ({env, createAdmin}: Dependencies) => async (req: Request) => {
  if (req.method !== 'POST') return json({error:'method_not_allowed'},405);
  const key=env('SUPABASE_SERVICE_ROLE_KEY'), url=env('SUPABASE_URL'), operatorSecret=env('SUBSCRIPTION_TIER_REPAIR_SECRET');
  if (!key || !url || !operatorSecret) return json({error:'not_configured'},503);
  // Compare fixed-size hashes, including length, without exposing credentials.
  const hash = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
  const [a,b] = await Promise.all([hash(req.headers.get('authorization') ?? ''),hash(`Bearer ${operatorSecret}`)]);
  if (a.reduce((diff,value,i) => diff | (value ^ b[i]),0) !== 0) return json({error:'unauthorized'},401);
  try {
    const raw = await req.text();
    if (raw.length > 1024) return json({error:'request_too_large'},413);
    const {userId,mode} = JSON.parse(raw);
    if (typeof userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) || !['sync','verify','inspect'].includes(mode)) return json({error:'invalid_request'},400);
    const secret=env('REVENUECAT_SECRET_API_KEY'), project=env('REVENUECAT_PROJECT_ID');
    if (!secret || !project) return json({error:'not_configured'},503);
    const admin=createAdmin(url,key);
    const {data,error}=await admin.auth.admin.getUserById(userId);
    if (error || !data?.user) return json({error:'user_lookup_failed'},503);
    const config={premium:env('REVENUECAT_PREMIUM_ENTITLEMENT_ID'),standard:env('REVENUECAT_STANDARD_ENTITLEMENT_ID'),lite:env('REVENUECAT_LITE_ENTITLEMENT_ID')};
    const state=mode === 'sync' ? await syncRevenueCatTier(admin,userId,secret,project,config,'revenuecat_api') : mode === 'inspect' ? await fetchRevenueCatTier(userId,secret,project,config) : undefined;
    const features: Record<string,unknown>={};
    if (mode === 'verify') for (const feature of ['fragLotti','fuersorge','voiceLog']) {
      features[feature]=await verifySubscriptionFeatureAccess(admin,userId,feature,secret,project,config);
    }
    return json({ok:true,...(state ? {tier:state.tier,productId:state.productId,expiresAt:state.expiresAt} : {features})});
  } catch(error) {
    const code=error instanceof Error && /^(revenuecat_[a-z0-9_]+|subscription_cache_[a-z_]+)$/.test(error.message) ? error.message : 'verification_failed';
    return json({error:code},503);
  }
};
