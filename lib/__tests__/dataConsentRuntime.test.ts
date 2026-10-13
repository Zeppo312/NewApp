import type { DataConsentSnapshot } from '../dataConsentTypes';
let runtime: typeof import('../dataConsentRuntime');
const makeSnapshot = (ai: 'granted' | 'declined' = 'granted'): DataConsentSnapshot => ({
 enabled: true,userId:'a',revision:1,documentVersion:'2026-10-01.1',healthAllowed:true,aiAllowed:ai==='granted',
 health:{decision:'granted',documentVersion:'2026-10-01.1',decidedAt:'2026-10-01T00:00:00Z'},
 ai:{decision:ai,documentVersion:'2026-10-01.1',decidedAt:'2026-10-01T00:00:00Z'},
});
function load(enabled=true) {
 jest.resetModules(); process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED=String(enabled);
 runtime=require('../dataConsentRuntime'); runtime.setConsentIdentity('a');
}
afterEach(()=>{jest.restoreAllMocks();delete process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;});
it('disabled rollout preserves fetch and adds no consent checks or storage',async()=>{
 load(false);const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response('{}'));
 const init={method:'POST',body:'synthetic'};await runtime.consentAwareFetch('https://test.supabase.co/functions/v1/ask-lotti',init);
 expect(fetchMock).toHaveBeenCalledTimes(1);expect(fetchMock).toHaveBeenCalledWith('https://test.supabase.co/functions/v1/ask-lotti',init);
});
it('new app code enables effective consent without requiring a build flag',async()=>{
 jest.resetModules();delete process.env.EXPO_PUBLIC_DATA_CONSENTS_ENABLED;
 runtime=require('../dataConsentRuntime');runtime.setConsentIdentity('a');
 expect(runtime.DATA_CONSENTS_ENABLED).toBe(true);
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response('{}'));
 await expect(runtime.consentAwareFetch('https://test.supabase.co/rest/v1/baby_info')).rejects.toThrow('health_consent_required');
 expect(fetchMock).not.toHaveBeenCalled();
});
it('an inactive backend never turns a new app into the inert preview or permits processing',async()=>{
 load();runtime.setRuntimeDataConsents({...makeSnapshot(),enabled:false});
 expect(runtime.runtimeConsentAllowed('health')).toBe(false);expect(runtime.runtimeConsentAllowed('ai')).toBe(false);
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response('{}'));
 await expect(runtime.consentAwareFetch('https://test.supabase.co/functions/v1/ask-lotti')).rejects.toThrow('ai_consent_required');
 expect(fetchMock).not.toHaveBeenCalled();
});
it('fails closed on startup and keeps consent, terms and auth transport reachable',async()=>{
 load();const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response('{}'));
 await expect(runtime.consentAwareFetch('https://test.supabase.co/rest/v1/baby_info')).rejects.toThrow('health_consent_required');
 await expect(runtime.consentAwareFetch('https://test.supabase.co/storage/v1/object/private/file')).rejects.toThrow('health_consent_required');
 expect(fetchMock).not.toHaveBeenCalled();
 await runtime.consentAwareFetch('https://test.supabase.co/rest/v1/rpc/record_data_consent');
 await runtime.consentAwareFetch('https://test.supabase.co/auth/v1/user');expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('AI refusal allows manual health calls while blocking both AI endpoints',async()=>{
 load();runtime.setRuntimeDataConsents(makeSnapshot('declined'));
 const fetchMock=jest.spyOn(global,'fetch').mockResolvedValue(new Response('{}'));
 await runtime.consentAwareFetch('https://test.supabase.co/rest/v1/weight_entries');
 await runtime.consentAwareFetch('https://test.supabase.co/functions/v1/advisor-generate');
 for(const slug of ['ask-lotti','voice-log-parse']) await expect(runtime.consentAwareFetch(`https://test.supabase.co/functions/v1/${slug}`)).rejects.toThrow('ai_consent_required');
 expect(fetchMock).toHaveBeenCalledTimes(2);
});
it('aborts an in-flight AI request on withdrawal and discards its late response',async()=>{
 load();runtime.setRuntimeDataConsents(makeSnapshot());let finish!:(r:Response)=>void;
 const fetchMock=jest.spyOn(global,'fetch').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const pending=runtime.consentAwareFetch('https://test.supabase.co/functions/v1/ask-lotti');
 const signal=fetchMock.mock.calls[0][1]!.signal;
 runtime.setPendingConsentWithdrawal(['ai']);expect(signal?.aborted).toBe(true);
 finish(new Response('{}'));await expect(pending).rejects.toThrow('ai_consent_required');
 expect(runtime.runtimeConsentAllowed('health')).toBe(true);
});
it('withdrawal blocks immediately even if a late older status arrives',()=>{
 load();runtime.setRuntimeDataConsents(makeSnapshot());runtime.setPendingConsentWithdrawal(['health']);
 runtime.setRuntimeDataConsents(makeSnapshot());expect(runtime.runtimeConsentAllowed('ai')).toBe(false);expect(runtime.runtimeConsentAllowed('health')).toBe(false);
});
it('ignores snapshots from a previous account and never inherits its grants',()=>{
 load();runtime.setRuntimeDataConsents(makeSnapshot());runtime.setConsentIdentity('b');runtime.setRuntimeDataConsents(makeSnapshot());
 expect(runtime.getRuntimeDataConsents().snapshot).toBeNull();expect(runtime.runtimeConsentAllowed('health')).toBe(false);
});
it('an obsolete document is not usable consent',()=>{
 load();runtime.setRuntimeDataConsents({...makeSnapshot(),documentVersion:'old'});expect(runtime.runtimeConsentAllowed('ai')).toBe(false);
});
it('preserves the confirmed status on background while cancelling in-flight work',async()=>{
 load();runtime.setRuntimeDataConsents(makeSnapshot());
 let finish!:(r:Response)=>void;
 const fetchMock=jest.spyOn(global,'fetch').mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 const request=runtime.consentAwareFetch('https://test.supabase.co/functions/v1/ask-lotti');
 runtime.invalidateConsentChecks();
 expect(fetchMock.mock.calls[0][1]!.signal?.aborted).toBe(true);
 expect(runtime.getRuntimeDataConsents().snapshot).toEqual(makeSnapshot());expect(runtime.runtimeConsentAllowed('health')).toBe(true);
 finish(new Response('{}'));await expect(request).rejects.toThrow('ai_consent_required');
});
