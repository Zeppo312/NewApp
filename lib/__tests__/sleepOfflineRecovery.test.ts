import AsyncStorage from '@react-native-async-storage/async-storage';
import { createPendingSleepStop, listPendingSleepStops, persistSleepStop, rememberActiveSleep } from '../sleepOfflineActions';
import { runSleepRecovery, decideSleepStop, editPendingSleepStop } from '../sleepOfflineRecovery';
import { classifySleepStop } from '../sleepConflictResolution';
import { pendingSleepOverlay } from '../sleepPendingOverlay';
import { readSleepSyncSnapshot, commitSleepStop, type VersionedSleepEntry, type SleepScopeSnapshot } from '../sleepSyncContract';
let mockUser='a';let mockHealth=true;let mockGeneration=0;let mockUUID=0;
const mockKeep=jest.fn();
jest.mock('../supabase',()=>({supabaseUrl:'https://fixture.supabase.co',supabase:{rpc:(...args:any[])=>mockKeep(...args)}}));
jest.mock('../dataConsentRuntime',()=>({getRuntimeDataConsents:()=>({userId:mockUser,generation:mockGeneration}),runtimeConsentAllowed:()=>mockHealth}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`op-${++mockUUID}`}));
jest.mock('../sleepSyncContract',()=>({...jest.requireActual('../sleepSyncContract'),readSleepCapability:jest.fn(async()=>true),readSleepSyncSnapshot:jest.fn(),commitSleepStop:jest.fn()}));
const scope={backendHost:'fixture.supabase.co',userId:'a',babyId:'baby'};
const entry: VersionedSleepEntry={id:'old',user_id:'a',baby_id:'baby',start_time:new Date(Date.now()-7200000).toISOString(),end_time:null,duration_minutes:null,notes:'base',quality:null,partner_id:'b',shared_with_user_id:null,updated_by:null,sync_revision:'1'};
const stopAt=new Date(Date.parse(entry.start_time)+3600000).toISOString();
const snapshot=(patch:Partial<VersionedSleepEntry>={},rev='1'): SleepScopeSnapshot=>{const e={...entry,...patch};return {status:'available',babyId:'baby',scopeRevision:rev,entries:[e],original:e,canWrite:true,verifiedAt:new Date().toISOString()};};
const read=jest.mocked(readSleepSyncSnapshot);const commit=jest.mocked(commitSleepStop);
const seed=()=>createPendingSleepStop(scope,{canWrite:true,entry,scopeRevision:'1',verifiedAt:new Date().toISOString()},stopAt,'good','base');
beforeEach(async()=>{mockUser='a';mockHealth=true;mockGeneration++;await AsyncStorage.clear();jest.clearAllMocks();read.mockResolvedValue(snapshot());commit.mockImplementation(async payload=>({status:'applied',operationId:payload.p_operation_id,outcome:'stopped'}));});
it('unchanged original automatically reconciles the original end time; parallel triggers share one runner',async()=>{
  await seed();const a=runSleepRecovery('a'),b=runSleepRecovery('a');expect(a).toBe(b);await a;
  expect(commit).toHaveBeenCalledTimes(1);expect(commit.mock.calls[0][0].p_stop_at).toBe(stopAt);
  expect((await listPendingSleepStops('a'))[0].state).toBe('confirmed');
});
it('lost reply persists frozen payload and same ID; cold-start/manual retry obtains receipt then fresh state',async()=>{
  const action=await seed();commit.mockRejectedValueOnce(new Error('reply lost'));
  await runSleepRecovery('a');const unknown=(await listPendingSleepStops('a'))[0];expect(unknown.state).toBe('confirmation_unknown');expect(unknown.frozen?.p_operation_id).toBe(action.operationId);
  const corrected=snapshot({end_time:stopAt,sync_revision:'4',notes:'later correction'},'4');
  read.mockResolvedValue(corrected);commit.mockResolvedValueOnce({status:'already_applied',operationId:action.operationId,outcome:'stopped'});
  await runSleepRecovery('a');expect(commit.mock.calls[1][0]).toEqual(commit.mock.calls[0][0]);expect((await listPendingSleepStops('a'))[0].current?.original?.notes).toBe('later correction');
});
it.each(['start_time','notes','quality','end_time'] as const)('partner change to %s asks and later is durable',async field=>{
  await seed();const patch=field==='start_time'?{start_time:new Date(Date.parse(entry.start_time)-60000).toISOString()}:field==='notes'?{notes:'partner'}:field==='quality'?{quality:'bad' as const}:{end_time:new Date(Date.parse(stopAt)-60000).toISOString()};
  read.mockResolvedValue(snapshot({...patch,sync_revision:'2'},'2'));await runSleepRecovery('a');const action=(await listPendingSleepStops('a'))[0];expect(action.state).toBe('needs_decision');expect(commit).not.toHaveBeenCalled();
  await decideSleepStop(action,'later');await runSleepRecovery('a');expect((await listPendingSleepStops('a'))[0].state).toBe('needs_decision');
});
it('new active successor/pause/split remains active under old overlay and own decision targets original ID only',async()=>{
  await seed();const successor={...entry,id:'new',sync_revision:'1',start_time:stopAt};const current=snapshot({end_time:stopAt,sync_revision:'2'},'3');current.entries.push(successor);
  read.mockResolvedValue(current);await runSleepRecovery('a');const action=(await listPendingSleepStops('a'))[0];expect(action.outcome).toBe('structure');
  expect(pendingSleepOverlay(current.entries,[action]).find(e=>e.id==='new')?.end_time).toBeNull();
  await decideSleepStop(action,'own');expect(commit.mock.calls[0][0].p_entry_id).toBe('old');expect(commit.mock.calls[0][0].p_expected_scope_revision).toBe('3');
});
it('deleted original is never recreated, shared choice checks displayed version',async()=>{
  await seed();const current={...snapshot({},'2'),original:null,entries:[]};read.mockResolvedValue(current);await runSleepRecovery('a');const action=(await listPendingSleepStops('a'))[0];
  await decideSleepStop(action,'own');expect(commit).not.toHaveBeenCalled();
  mockKeep.mockResolvedValue({data:{status:'accepted',currentSnapshot:current},error:null});await decideSleepStop(action,'shared');expect(mockKeep).toHaveBeenCalledWith('sleep_sync_keep',expect.objectContaining({p_expected_scope_revision:'2'}));expect((await listPendingSleepStops('a'))[0].state).toBe('discarded');
});
it('stale dialog decision receives newer snapshot and never performs another automatic overwrite',async()=>{
  await seed();read.mockResolvedValue(snapshot({notes:'p',sync_revision:'2'},'2'));await runSleepRecovery('a');const action=(await listPendingSleepStops('a'))[0];
  const latest=snapshot({notes:'changed while deciding',sync_revision:'3'},'3');commit.mockResolvedValue({status:'conflict',currentSnapshot:latest});expect(await decideSleepStop(action,'own')).toBe(false);
  expect((await listPendingSleepStops('a'))[0].current?.scopeRevision).toBe('3');await runSleepRecovery('a');expect(commit).toHaveBeenCalledTimes(1);
});
it('malformed shared confirmation preserves the local decision instead of clearing it',async()=>{
  await seed();read.mockResolvedValue(snapshot({notes:'partner',sync_revision:'2'},'2'));await runSleepRecovery('a');const action=(await listPendingSleepStops('a'))[0];
  mockKeep.mockResolvedValue({data:{status:'accepted',currentSnapshot:{...snapshot({},'2'),babyId:'wrong-child'}},error:null});
  await expect(decideSleepStop(action,'shared')).rejects.toThrow('Invalid shared confirmation');expect((await listPendingSleepStops('a'))[0].state).toBe('needs_decision');
});
it('identical stopped time is agreed only with unchanged start, note, quality and one scope revision',()=>{
  expect(classifySleepStop(entry,'1',stopAt,'good','base',snapshot({end_time:stopAt,quality:'good',sync_revision:'2'},'2'))).toBe('agreed');
  expect(classifySleepStop(entry,'1',stopAt,'good','base',snapshot({end_time:stopAt,quality:'good',sync_revision:'2'},'5'))).toBe('changed');
});
it('permission loss clears affected local payload; other account never sends; read-only and bad clocks are blocked',async()=>{
  await seed();read.mockResolvedValue({status:'forbidden'});await runSleepRecovery('a');expect(await listPendingSleepStops('a')).toEqual([]);expect(commit).not.toHaveBeenCalled();
  await seed();mockUser='b';await runSleepRecovery('a');expect(commit).not.toHaveBeenCalled();mockUser='a';
  expect(classifySleepStop(entry,'1',new Date(Date.parse(entry.start_time)-1).toISOString(),'good','base',snapshot())).toBe('invalid');
  expect(classifySleepStop(entry,'1',stopAt,'good','base',{...snapshot(),canWrite:false})).toBe('forbidden');
});
it('ask-always and corrected time survive restart; uncertain sent payload cannot be edited or canceled',async()=>{
  const action=await seed();await editPendingSleepStop(action,{reconcilePolicy:'ask_always'});await runSleepRecovery('a');expect((await listPendingSleepStops('a'))[0].state).toBe('needs_decision');expect(commit).not.toHaveBeenCalled();
  const next=(await listPendingSleepStops('a'))[0];const frozen={p_expected_actor:'a',p_operation_id:next.operationId,p_baby_id:'baby',p_entry_id:'old',p_expected_entry_revision:'1',p_expected_scope_revision:'1',p_stop_at:stopAt,p_quality:'good' as const,p_notes:'base',p_change_quality:true,p_change_notes:false};
  await persistSleepStop({...next,state:'confirmation_unknown',frozen,localRevision:next.localRevision+1},next.localRevision);
  const unknown=(await listPendingSleepStops('a'))[0];await editPendingSleepStop(unknown,{discard:true});expect((await listPendingSleepStops('a'))[0].frozen).toEqual(frozen);
});
it('own time alone preserves changed partner notes and quality; taking those fields requires an explicit choice',async()=>{
  await seed();read.mockResolvedValue(snapshot({notes:'partner note',quality:'bad',sync_revision:'2'},'2'));await runSleepRecovery('a');const action=(await listPendingSleepStops('a'))[0];
  await decideSleepStop(action,'own');expect(commit.mock.calls[0][0].p_change_notes).toBe(false);expect(commit.mock.calls[0][0].p_change_quality).toBe(false);
});
it('a receipt with a failed fresh read invalidates the old active cache without inventing a confirmed empty snapshot',async()=>{
  await seed();await rememberActiveSleep(scope,snapshot());
  read.mockResolvedValueOnce(snapshot()).mockRejectedValueOnce(new Error('offline after receipt'));
  await runSleepRecovery('a');
  expect((await listPendingSleepStops('a'))[0].state).toBe('confirmed');
  expect((await AsyncStorage.getAllKeys()).some(key=>key.endsWith(':sleep-active'))).toBe(false);
});
