import React from 'react';
import { AppState } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { TrackingSyncProvider, useTrackingSync } from '@/contexts/TrackingSyncContext';
import { queueTrackingCreate, readTrackingOutbox, runTrackingSync, trackingScope } from '../trackingOutbox';
import { clearLocalHealthData } from '../localHealthStorage';
let mockGeneration=0;let mockUUID=0;const mockRpc=jest.fn();
jest.mock('../supabase',()=>({supabaseUrl:'https://fixture.supabase.co',supabase:{rpc:(...args:any[])=>({abortSignal:()=>mockRpc(...args)})}}));
jest.mock('../dataConsentRuntime',()=>({getRuntimeDataConsents:()=>({userId:'a',generation:mockGeneration}),runtimeConsentAllowed:()=>true,subscribeDataConsents:()=>()=>{}}));
jest.mock('@/contexts/AuthContext',()=>({useAuth:()=>({user:{id:'a'}})}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`provider-${++mockUUID}`}));
let value!:ReturnType<typeof useTrackingSync>;let tree:ReactTestRenderer|undefined;
function Probe(){const current=useTrackingSync();React.useLayoutEffect(()=>{value=current;});return null;}
beforeEach(async()=>{jest.useFakeTimers();mockGeneration++;await AsyncStorage.clear();mockRpc.mockReset();mockRpc.mockRejectedValue(new Error('offline'));AppState.currentState='active';});
afterEach(async()=>{await act(async()=>{tree?.unmount();});tree=undefined;await runTrackingSync('a').catch(()=>{});jest.useRealTimers();});
it('hydrates a queued timer while offline and automatically syncs when connectivity returns without navigation',async()=>{
  const start=new Date().toISOString();await queueTrackingCreate('sleep',trackingScope('a','baby'),{start_time:start,end_time:null});await runTrackingSync('a');
  await act(async()=>{tree=create(<TrackingSyncProvider><Probe/></TrackingSyncProvider>);await runTrackingSync('a');});
  expect(value.ready).toBe(true);expect(value.operations[0].row).toMatchObject({start_time:start,end_time:null});
  const before=mockRpc.mock.calls.length;
  mockRpc.mockImplementation((_name,payload)=>Promise.resolve({data:{status:'applied',operationId:payload.p_operation_id,row:{id:payload.p_entry_id,baby_id:'baby',...payload.p_fields,updated_at:start},appliedUpdatedAt:start},error:null}));
  await act(async()=>{jest.advanceTimersByTime(15000);await runTrackingSync('a');});
  expect(mockRpc.mock.calls.length).toBeGreaterThan(before);expect(value.operations[0].state).toBe('confirmed');
});
it('removes the affected child from a mounted provider and keeps another child pending',async()=>{
  await queueTrackingCreate('care',trackingScope('a','baby'),{entry_type:'feeding',start_time:new Date().toISOString(),end_time:null});await runTrackingSync('a');
  await queueTrackingCreate('care',trackingScope('a','other'),{entry_type:'diaper',start_time:new Date().toISOString(),end_time:null});await runTrackingSync('a');
  await act(async()=>{tree=create(<TrackingSyncProvider><Probe/></TrackingSyncProvider>);await runTrackingSync('a');});
  await act(async()=>{await clearLocalHealthData('a','baby');});
  expect((await readTrackingOutbox('a')).map(op=>op.scope.babyId)).toEqual(['other']);
  expect(value.operations.some(op=>op.scope.babyId==='baby')).toBe(false);
});
