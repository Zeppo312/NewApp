import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearLocalHealthData } from '../localHealthStorage';
import { queueTrackingCreate, queueTrackingUpdate, queueVitaminCheck, readTrackingOutbox, runTrackingSync,
  overlayTrackingRows, overlayVitaminChecks, discardTrackingOperation, acceptOwnTrackingChange, trackingScope, findLocalTrackingRow } from '../trackingOutbox';
import { writeSnapshot } from '../localReadSnapshots';
import { supabase } from '../supabase';

let mockUser = 'a'; let mockHealth = true; let mockGeneration = 0; let mockUUID = 0;
const mockRpc = jest.fn();
jest.mock('../dataConsentRuntime', () => ({ getRuntimeDataConsents: () => ({ userId: mockUser, generation: mockGeneration }), runtimeConsentAllowed: () => mockHealth }));
jest.mock('../supabase', () => ({ supabaseUrl: 'https://fixture.supabase.co', supabase: { rpc: (...args: any[]) => ({ abortSignal: () => mockRpc(...args) }) } }));
jest.mock('expo-crypto', () => ({ randomUUID: () => `op-${++mockUUID}` }));
const scope = () => trackingScope('a','baby');
const now = new Date().toISOString();
const start = { entry_type: 'feeding', feeding_type: 'BREAST', start_time: now, end_time: null, notes: 'offline note' };
const drain = () => runTrackingSync('a');
beforeEach(async () => { await drain().catch(() => {}); mockUser='a'; mockHealth=true; mockGeneration++; mockRpc.mockReset();
  mockRpc.mockRejectedValue(new Error('Network request failed')); await AsyncStorage.clear(); });
afterEach(async () => { await drain().catch(() => {}); });
function applied(_name: string, payload: any) { return Promise.resolve({ data: { status:'applied',operationId:payload.p_operation_id,
  row:payload.p_kind==='vitamin' ? null : { id:payload.p_entry_id,baby_id:payload.p_baby_id,user_id:'a',...payload.p_fields,updated_at:'2026-10-08T20:00:00.000Z' },
  appliedUpdatedAt:'2026-10-08T20:00:00.000Z' },error:null }); }

it('saves each care type and a sleep immediately while the transport fails; hydration preserves IDs and values',async()=>{
  for (const fields of [start,{...start,feeding_type:'BOTTLE',feeding_volume_ml:120},{...start,feeding_type:'SOLIDS'},
    {...start,feeding_type:'PUMP'}, {...start,feeding_type:'WATER'}, {...start,entry_type:'diaper',diaper_type:'BOTH'},
    {...start,entry_type:'custom',custom_name:'Spaziergang',custom_tracking_mode:'duration'}]) await queueTrackingCreate('care',scope(),fields);
  const sleep=await queueTrackingCreate('sleep',scope(),{start_time:now,end_time:null}); await drain();
  const rows=await readTrackingOutbox('a'); expect(rows).toHaveLength(8);
  expect(new Set(rows.map(v=>v.entryId)).size).toBe(8);
  expect(rows[0].fields.notes).toBe('offline note');
  expect(overlayTrackingRows('sleep',[],rows,'baby')[0]).toMatchObject({id:sleep.id,start_time:now,end_time:null,local_pending:true});
  expect(overlayTrackingRows('care',[],rows,'other')).toEqual([]);
});
it('does not claim success or dispatch a network request when local storage is full',async()=>{
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  await expect(queueTrackingCreate('care',scope(),start)).rejects.toThrow('disk full');
  expect(mockRpc).not.toHaveBeenCalled(); expect(await readTrackingOutbox('a')).toEqual([]);
});
it('reuses the exact operation ID and payload after a server write with a lost reply',async()=>{
  await queueTrackingCreate('care',scope(),{...start,feeding_type:'BOTTLE',feeding_volume_ml:120},'stock'); await drain();
  const first=mockRpc.mock.calls[0][1]; mockRpc.mockImplementation(applied);
  await drain(); const second=mockRpc.mock.calls[1][1]; expect(second).toEqual(first);
  expect((await readTrackingOutbox('a'))[0].state).toBe('confirmed');
});
it('an offline timer can stop before create confirmation and sends create before stop using the original receipt version',async()=>{
  const row=await queueTrackingCreate('sleep',scope(),{start_time:now,end_time:null}); await drain();
  const end=new Date(Date.parse(now)+600000).toISOString();
  await queueTrackingUpdate('sleep',scope(),row.id,{end_time:end,quality:'good'},row); await drain();
  expect(overlayTrackingRows('sleep',[],await readTrackingOutbox('a'),'baby')[0]).toMatchObject({id:row.id,end_time:end});
  mockRpc.mockImplementation((name,payload)=> payload.p_action==='create'
    ? Promise.resolve({data:{status:'already_applied',operationId:payload.p_operation_id,row:{...row,updated_at:'2026-10-08T20:30:00Z',notes:'Partner edit'},appliedUpdatedAt:'2026-10-08T20:00:00Z'},error:null}) : applied(name,payload));
  await drain();
  const sent=mockRpc.mock.calls.map(v=>v[1]); expect(sent.at(-1)).toMatchObject({p_action:'update',p_expected_updated_at:'2026-10-08T20:00:00Z',p_fields:{end_time:end,quality:'good'}});
});
it('does not send a child stop or automatically retry after a conflicting partner start',async()=>{
  const row=await queueTrackingCreate('sleep',scope(),{start_time:now,end_time:null}); await drain();
  await queueTrackingUpdate('sleep',scope(),row.id,{end_time:now},row); await drain();
  mockRpc.mockImplementation((_name,payload)=>Promise.resolve({data:{status:'conflict',operationId:payload.p_operation_id,reason:'active_sleep'},error:null}));
  await drain(); const count=mockRpc.mock.calls.length; await drain(); expect(mockRpc.mock.calls).toHaveLength(count);
  const rows=await readTrackingOutbox('a'); expect(rows[0].state).toBe('blocked'); expect(rows[1].state).toBe('pending');
  await discardTrackingOperation('a',rows[0].operationId); expect(await readTrackingOutbox('a')).toEqual([]);
});
it('does not replace a fresh partner version with an old confirmation; removes discarded optimistic rows',async()=>{
  const row=await queueTrackingCreate('care',scope(),start); await drain(); mockRpc.mockImplementation(applied); await drain();
  const operations=await readTrackingOutbox('a');
  expect(overlayTrackingRows('care',[{...row,local_pending:false,notes:'Partner latest'}],operations,'baby')[0].notes).toBe('Partner latest');
  expect(overlayTrackingRows('care',[row],[],'baby')).toEqual([]);
});
it('queues vitamin toggles in order and overlays an uncheck over a shared check',async()=>{
  await queueVitaminCheck(scope(),'2026-10-08',true); await drain();
  await queueVitaminCheck(scope(),'2026-10-08',false); await drain();
  const operations=await readTrackingOutbox('a'); expect(operations[1].dependsOn).toBe(operations[0].operationId);
  expect(overlayVitaminChecks({'2026-10-08':true},operations,'baby')).toEqual({});
  mockRpc.mockImplementation(applied); await drain(); expect((await readTrackingOutbox('a')).every(v=>v.state==='confirmed')).toBe(true);
});
it('cleans only the affected child and never dispatches under another account or revoked consent',async()=>{
  await queueTrackingCreate('care',scope(),start); await drain();
  await queueTrackingCreate('care',trackingScope('a','other'),start); await drain();
  await clearLocalHealthData('a','baby'); expect((await readTrackingOutbox('a')).map(v=>v.scope.babyId)).toEqual(['other']);
  const sent=mockRpc.mock.calls.length; mockUser='b'; await drain(); expect(mockRpc.mock.calls).toHaveLength(sent);
  mockUser='a';mockHealth=false;await expect(queueTrackingCreate('care',scope(),start)).rejects.toThrow('scope changed');
});
it('keeps a damaged journal visible as an error and does not overwrite its contents',async()=>{
  const key='local_tracking_outbox_v1:fixture.supabase.co:a:-:-'; await AsyncStorage.setItem(key,'broken');
  await expect(queueTrackingCreate('care',scope(),start)).rejects.toThrow(); expect(await AsyncStorage.getItem(key)).toBe('broken');
});
it('only an explicit competing-version choice rebases a stop, preserving a partner note',async()=>{
  const base={id:'shared',baby_id:'baby',start_time:now,end_time:null,notes:'original',quality:null,updated_at:'2026-10-08T20:00:00Z'};
  await queueTrackingUpdate('sleep',scope(),base.id,{end_time:now,notes:'original',quality:'good'},base);await drain();
  mockRpc.mockImplementation((_name,payload)=>Promise.resolve({data:{status:'conflict',operationId:payload.p_operation_id,reason:'conflict',row:{...base,notes:'Partner note',updated_at:'2026-10-08T20:05:00Z'}},error:null}));
  await drain();const blocked=(await readTrackingOutbox('a'))[0];
  await expect(acceptOwnTrackingChange('a',blocked.operationId,'old version')).rejects.toThrow('unavailable');
  mockRpc.mockImplementation(applied);await acceptOwnTrackingChange('a',blocked.operationId,'2026-10-08T20:05:00Z');
  const request=mockRpc.mock.calls.at(-1)![1];expect(request.p_operation_id).not.toBe(blocked.operationId);expect(request.p_expected_updated_at).toBe('2026-10-08T20:05:00Z');
  expect(request.p_fields).toEqual({end_time:now,quality:'good'});
});
it('an explicitly kept, completed offline sleep becomes one history entry without replacing the partner timer',async()=>{
  const row=await queueTrackingCreate('sleep',scope(),{start_time:now,end_time:null});await drain();
  const end=new Date(Date.parse(now)+600000).toISOString();await queueTrackingUpdate('sleep',scope(),row.id,{end_time:end,quality:'good'},row);await drain();
  mockRpc.mockImplementation((_name,payload)=>Promise.resolve({data:{status:'conflict',operationId:payload.p_operation_id,reason:'active_sleep'},error:null}));
  await drain();const blocked=(await readTrackingOutbox('a'))[0];mockRpc.mockImplementation(applied);
  await acceptOwnTrackingChange('a',blocked.operationId);const request=mockRpc.mock.calls.at(-1)![1];
  expect(request).toMatchObject({p_action:'create',p_entry_id:row.id,p_fields:{end_time:end,quality:'good'}});expect(await readTrackingOutbox('a')).toHaveLength(1);
});
it('hydrates a confirmation newer than a cache, while a newer authoritative empty snapshot stays empty',async()=>{
  await queueTrackingCreate('care',scope(),start);await drain();mockRpc.mockImplementation(applied);await drain();const rows=await readTrackingOutbox('a');
  expect(overlayTrackingRows('care',[],rows,'baby','')).toHaveLength(1);
  expect(overlayTrackingRows('care',[],rows,'baby',new Date(Date.now()+60000).toISOString())).toEqual([]);
});
it('uses a refreshed partner version for a later edit after the original local entry was confirmed',async()=>{
  mockRpc.mockImplementation(applied);
  const created=await queueTrackingCreate('sleep',scope(),{start_time:now,end_time:null});await drain();
  const fresh={...created,local_pending:false,updated_at:'2026-10-08T20:05:00Z',notes:'Partner note'};
  await writeSnapshot(scope(),'tracking-sleep',[fresh]);
  const base=await findLocalTrackingRow('sleep','a',created.id,'baby');expect(base?.notes).toBe('Partner note');
  await queueTrackingUpdate('sleep',scope(),created.id,{end_time:now},base);await drain();
  const request=mockRpc.mock.calls.at(-1)![1];expect(request.p_expected_updated_at).toBe(fresh.updated_at);
  expect((await readTrackingOutbox('a')).at(-1)?.dependsOn).toBeUndefined();
});
