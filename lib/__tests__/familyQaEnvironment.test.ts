/** @jest-environment node */
import { resolveBackendEnvironment } from '../backendEnvironment';
import { familySharingEnvironment } from '../../supabase/functions/_shared/familySandboxEnvironment';
import { fetchRevenueCatTier } from '../../supabase/functions/_shared/revenuecatState';
import { config, future, list, paid, SHARED, USER } from './fixtures/revenuecatBackend';

const ref = 'abcdefghijklmnopqrst';
const url = `https://${ref}.supabase.co`;
const key = 'sb_publishable_fixture';
const qaEnv = { FAMILY_QA_MODE: 'sandbox', FAMILY_QA_PROJECT_REF: ref, SUPABASE_URL: url, FAMILY_QA_USER_IDS: USER };
const read = (values: Record<string,string>) => (name: string) => values[name];
afterEach(() => jest.restoreAllMocks());

describe('isolated family QA configuration', () => {
  it('preserves the production default', () => {
    expect(resolveBackendEnvironment()).toBeNull();
    expect(familySharingEnvironment(USER, read({}))).toBe('production');
  });
  it('requires an explicit matching isolated project in the app', () => {
    expect(resolveBackendEnvironment('family-qa',url,key,ref)).toEqual({url,key,projectRef:ref});
    expect(() => resolveBackendEnvironment('family-qa')).toThrow();
    expect(() => resolveBackendEnvironment(undefined,url,key,ref)).toThrow();
    expect(() => resolveBackendEnvironment('family-qa',url,key,'kwniiyayhzgjfqjsjcfu')).toThrow();
    expect(() => resolveBackendEnvironment('family-qa','https://kwniiyayhzgjfqjsjcfu.supabase.co',key,ref)).toThrow();
    expect(() => resolveBackendEnvironment('family-qa',url,'sb_secret_hidden',ref)).toThrow();
  });
  it('rejects privileged and foreign legacy keys', () => {
    const jwt = (role: string, project = ref) => `x.${Buffer.from(JSON.stringify({role,ref:project})).toString('base64url')}.x`;
    expect(resolveBackendEnvironment('family-qa',url,jwt('anon'),ref)?.url).toBe(url);
    expect(() => resolveBackendEnvironment('family-qa',url,jwt('service_role'),ref)).toThrow();
    expect(() => resolveBackendEnvironment('family-qa',url,jwt('anon','kwniiyayhzgjfqjsjcfu'),ref)).toThrow();
  });
  it('allows sandbox sponsorship only for listed users in the matching test backend', () => {
    expect(familySharingEnvironment(USER,read(qaEnv))).toBe('sandbox');
    for (const change of [
      { SUPABASE_URL: 'https://kwniiyayhzgjfqjsjcfu.supabase.co' },
      { FAMILY_QA_PROJECT_REF: 'kwniiyayhzgjfqjsjcfu', SUPABASE_URL:'https://kwniiyayhzgjfqjsjcfu.supabase.co' },
      { FAMILY_QA_MODE: 'anything' }, { FAMILY_QA_USER_IDS: '' }, { FAMILY_QA_USER_IDS: 'untrusted' },
    ]) expect(() => familySharingEnvironment(USER,read({...qaEnv,...change}))).toThrow();
    expect(() => familySharingEnvironment('22222222-2222-4222-8222-222222222222',read(qaEnv))).toThrow();
  });
  it('accepts zero-charge sandbox purchases only under the isolated test policy', async () => {
    jest.spyOn(globalThis,'fetch').mockImplementation(async input => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/active_entitlements')) return Response.json(list([{entitlement_id:SHARED,expires_at:future()}]));
      if (path.endsWith('/subscriptions')) return Response.json(list([paid({customer_id:USER,ownership:'purchased',environment:'sandbox',status:'active',total_revenue_in_usd:{gross:0}})]));
      return Response.json({id:'prod-paid',store_identifier:'lottibaby_premium:monthly'});
    });
    expect((await fetchRevenueCatTier(USER,'key','project',config)).paid).toBeNull();
    expect((await fetchRevenueCatTier(USER,'key','project',config,familySharingEnvironment(USER,read(qaEnv)))).paid)
      .toMatchObject({tier:'premium',subscriptionId:'sub-paid'});
  });
  it.each([{ownership:'family_shared'},{status:'trialing'},{environment:'production'},{customer_id:'another-user'}])
    ('does not bypass payer verification in QA: %j', async overrides => {
      jest.spyOn(globalThis,'fetch').mockImplementation(async input => {
        const path = new URL(String(input)).pathname;
        if (path.endsWith('/active_entitlements')) return Response.json(list([{entitlement_id:SHARED,expires_at:future()}]));
        if (path.endsWith('/subscriptions')) return Response.json(list([paid({customer_id:USER,ownership:'purchased',environment:'sandbox',status:'active',total_revenue_in_usd:{gross:0},...overrides})]));
        return Response.json({id:'prod-paid',store_identifier:'lottibaby_premium:monthly'});
      });
      expect((await fetchRevenueCatTier(USER,'key','project',config,'sandbox')).paid).toBeNull();
    });
});
