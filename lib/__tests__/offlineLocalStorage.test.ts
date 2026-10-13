import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalHealthData, localHealthGeneration } from '../localHealthStorage';
import { backendHost, readSnapshot, writeSnapshot, localDateKey, invalidateReadSnapshots, readSnapshotRevision, validRows } from '../localReadSnapshots';
import { persistActivityDraft, readActivityDraft, removeActivityDraft, claimActivityDraft, type ActivityDraftValues } from '../activityDrafts';
import { createPendingSleepStop, listPendingSleepStops, rememberActiveSleep, readKnownActiveSleep } from '../sleepOfflineActions';
import type { VersionedSleepEntry, SleepScopeSnapshot } from '../sleepSyncContract';
let mockUser = 'a'; let mockHealth = true; let mockGeneration = 0; let mockUUID = 0;
jest.mock('../dataConsentRuntime', () => ({ getRuntimeDataConsents: () => ({ userId: mockUser, generation: mockGeneration }), runtimeConsentAllowed: () => mockHealth }));
jest.mock('../supabase', () => ({ supabaseUrl: 'https://fixture.supabase.co', supabase: {} }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `op-${++mockUUID}` }));
const scope = () => ({ backendHost: backendHost(), userId: mockUser, babyId: 'baby' });
const values: ActivityDraftValues = { startTime: '2026-10-08T07:00:00Z', endTime: null, isEndTimeVisible: false, notes: 'raw note', volumeMl: 135, diaperType: 'both', selectedDiaperItemId: 'stock-d', selectedFormulaItemId: 'stock-f', diaperFeverMeasured: true, diaperTemperatureC: '37,', diaperSuppositoryGiven: true, diaperSuppositoryDoseMg: '1.' };
const entry: VersionedSleepEntry = { id:'original', user_id:'a', baby_id:'baby', start_time: '2026-10-08T05:00:00Z', end_time:null, duration_minutes:null, notes:'base', quality:null, partner_id:'b', shared_with_user_id:null, updated_by:null, sync_revision:'9007199254740993' };
const snapshot: SleepScopeSnapshot = { status:'available',babyId:'baby',scopeRevision:'9007199254740994',entries:[entry],original:entry,canWrite:true,verifiedAt:new Date().toISOString() };
beforeEach(async () => { mockUser='a';mockHealth=true;mockGeneration++;await AsyncStorage.clear();jest.clearAllMocks(); });
it('isolates account, backend, child and local date; confirmed empty is a stored value', async () => {
  const day={...scope(),localDateKey:localDateKey()};await writeSnapshot(day,'care',[]);
  expect((await readSnapshot(day,'care',validRows))?.data).toEqual([]);
  expect(await readSnapshot({...day,babyId:'other'},'care',validRows)).toBeNull();
  expect(await readSnapshot({...day,backendHost:'other.supabase.co'},'care',validRows)).toBeNull();
  mockUser='b';expect(await readSnapshot(day,'care',validRows)).toBeNull();
});
it('invalidated in-flight read cannot repopulate a snapshot after an own mutation', async () => {
  const revision=readSnapshotRevision();const generation=localHealthGeneration();
  await writeSnapshot(scope(),'care',[{id:'old'}]);await invalidateReadSnapshots('a','baby',['care']);
  await writeSnapshot(scope(),'care',[{id:'late'}],new Date().toISOString(),generation,revision);
  expect(await readSnapshot(scope(),'care',validRows)).toBeNull();
});
it('retains only seven local days and rejects future verification or wrong schema', async () => {
  const old = new Date();old.setDate(old.getDate()-7);
  await writeSnapshot({...scope(),localDateKey:localDateKey(old)},'care',[{id:'old'}]);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
  await writeSnapshot(scope(),'care',[],new Date(Date.now()+60000).toISOString());
  expect(await readSnapshot(scope(),'care',validRows)).toBeNull();
  await AsyncStorage.setItem(`local_read_snapshot_v1:fixture.supabase.co:a:baby:-:care`,'{"schemaVersion":9}');
  expect(await readSnapshot(scope(),'care',validRows)).toBeNull();
});
it('cleanup drains a started write, denies writes during cleanup, and never resurrects old generation', async () => {
  const set=AsyncStorage.setItem;let release!:()=>void;let entered!:()=>void;
  const started=new Promise<void>(resolve=>{entered=resolve;});const held=new Promise<void>(resolve=>{release=resolve;});
  jest.mocked(AsyncStorage.setItem).mockImplementationOnce(async (key,value)=>{entered();await held;return set(key,value);});
  const generation=localHealthGeneration();const write=writeSnapshot(scope(),'care',[{id:'old'}]);await started;
  const clear=clearLocalHealthData('a','baby');const during=writeSnapshot(scope(),'care',[{id:'during'}]);release();await Promise.all([write,clear,during]);
  await writeSnapshot(scope(),'care',[{id:'late'}],new Date().toISOString(),generation);
  expect(await AsyncStorage.getAllKeys()).toEqual([]);
});
it('roundtrips raw incomplete inputs and sending becomes unknown after restart', async () => {
  const first=await persistActivityDraft(scope(),'diaper',values,null);
  expect((await readActivityDraft(scope(),'diaper')).draft?.values).toEqual(values);
  await persistActivityDraft(scope(),'diaper',values,first,'sending');
  expect((await readActivityDraft(scope(),'diaper')).draft?.state).toBe('confirmation_unknown');
});
it('old confirmation cannot delete a newer draft; two surfaces cannot own one form', async () => {
  const first=await persistActivityDraft(scope(),'bottle',values,null);
  const second=await persistActivityDraft(scope(),'bottle',{...values,notes:'new'},first);
  await removeActivityDraft(scope(),'bottle',first);expect((await readActivityDraft(scope(),'bottle')).draft?.revision).toBe(second.revision);
  const release=claimActivityDraft('same');expect(claimActivityDraft('same')).toBeNull();release!();expect(claimActivityDraft('same')).not.toBeNull();
});
it('corrupt drafts are not overwritten; health/account changes cancel new writes', async () => {
  await AsyncStorage.setItem('local_activity_draft_v1:fixture.supabase.co:a:baby:-:bottle','broken');
  expect((await readActivityDraft(scope(),'bottle')).corrupt).toBe(true);
  await expect(persistActivityDraft(scope(),'bottle',values,null)).rejects.toThrow();
  mockHealth=false;await expect(persistActivityDraft(scope(),'diaper',values,null)).rejects.toThrow();
});
it('durable stop keeps original time, ID and large revisions; duplicated stop returns the same operation', async () => {
  const base={canWrite:true,entry,scopeRevision:snapshot.scopeRevision,verifiedAt:snapshot.verifiedAt};
  const a=await createPendingSleepStop(scope(),base,'2026-10-08T06:01:02Z','good','note');
  const b=await createPendingSleepStop(scope(),base,'2026-10-08T07:30:00Z','bad','other');
  expect(b.operationId).toBe(a.operationId);expect((await listPendingSleepStops('a'))[0].originalStopAt).toBe('2026-10-08T06:01:02Z');
  expect((await listPendingSleepStops('a'))[0].baseEntry.entry.sync_revision).toBe('9007199254740993');
});
it('a full local disk cannot report a durable stop or create a journal entry',async()=>{
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(createPendingSleepStop(scope(),{canWrite:true,entry,scopeRevision:snapshot.scopeRevision,verifiedAt:snapshot.verifiedAt},'2026-10-08T06:01:02Z','good',null)).rejects.toThrow('disk full');
  expect(await listPendingSleepStops('a')).toEqual([]);
});
it('a confirmed empty/multiple-active scope clears the stored active sleep', async () => {
  await rememberActiveSleep(scope(),snapshot);expect(await readKnownActiveSleep(scope())).not.toBeNull();
  await rememberActiveSleep(scope(),{...snapshot,entries:[],original:null});expect(await readKnownActiveSleep(scope())).toBeNull();
});
it('uses the local day near the UTC boundary and retains the seventh permitted day',async()=>{
  const localMidnight=new Date(2026,9,8,0,30);expect(localDateKey(localMidnight)).toBe('2026-10-08');
  const seventh=new Date();seventh.setDate(seventh.getDate()-6);const day={...scope(),localDateKey:localDateKey(seventh)};
  await writeSnapshot(day,'care',[{id:'seventh'}]);expect((await readSnapshot(day,'care',validRows))?.data[0].id).toBe('seventh');
});
