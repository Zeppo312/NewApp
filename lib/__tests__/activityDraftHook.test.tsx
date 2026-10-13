import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useActivityDraft } from '../../hooks/useActivityDraft';
import { readActivityDraft, type ActivityDraftValues, type ActivitySaveOutcome } from '../activityDrafts';
let mockUser='a';let mockHealth=true;let mockGeneration=0;let mockUUID=0;
jest.mock('../dataConsentRuntime',()=>({getRuntimeDataConsents:()=>({userId:mockUser,generation:mockGeneration}),runtimeConsentAllowed:()=>mockHealth}));
jest.mock('../supabase',()=>({supabaseUrl:'https://fixture.supabase.co'}));
jest.mock('expo-crypto',()=>({randomUUID:()=>`draft-${++mockUUID}`}));
const values:ActivityDraftValues={startTime:'2026-10-08T08:00:00Z',endTime:null,isEndTimeVisible:false,notes:'',volumeMl:120,diaperType:'wet',selectedDiaperItemId:null,selectedFormulaItemId:null,diaperFeverMeasured:false,diaperTemperatureC:'',diaperSuppositoryGiven:false,diaperSuppositoryDoseMg:''};
const scope={backendHost:'fixture.supabase.co',userId:'a',babyId:'one'};
let api!:ReturnType<typeof useActivityDraft>;
const restore=jest.fn();
function Probe({v=values,baby='one'}:{v?:ActivityDraftValues;baby?:string}){const value=useActivityDraft({enabled:true,scope:{...scope,babyId:baby},kind:'bottle',values:v,restore});React.useLayoutEffect(()=>{api=value;});return null;}
let tree:ReactTestRenderer;
beforeEach(async()=>{mockUser='a';mockHealth=true;mockGeneration++;jest.useFakeTimers();await AsyncStorage.clear();jest.clearAllMocks();await act(async()=>{tree=create(<Probe/>);});});
afterEach(async()=>{await act(async()=>{tree.unmount();});jest.useRealTimers();});
it('persists raw input and explicit save twice dispatches only once even before storage awaits finish',async()=>{
  await act(async()=>{tree.update(<Probe v={{...values,notes:'still typing'}}/>);});
  const send=jest.fn(async():Promise<ActivitySaveOutcome>=>({status:'confirmed',entryId:'entry'}));
  await act(async()=>{await Promise.all([api.save(send),api.save(send)]);});
  expect(send).toHaveBeenCalledTimes(1);expect((await readActivityDraft(scope,'bottle')).draft).toBeNull();
});
it('unknown insert stays locked until explicit timeline review; restored date and inputs do not change',async()=>{
  await act(async()=>{tree.update(<Probe v={{...values,notes:'original'}}/>);await api.flush();});
  const send=jest.fn(async():Promise<ActivitySaveOutcome>=>({status:'confirmation_unknown'}));
  await act(async()=>{await api.save(send);await api.save(send);});expect(send).toHaveBeenCalledTimes(1);expect(api.unknown).toBe(true);
  await act(async()=>{tree.unmount();tree=create(<Probe/>);});expect(api.choice?.values.notes).toBe('original');
  await act(async()=>{api.resume();});expect(restore).toHaveBeenCalledWith(expect.objectContaining({notes:'original',startTime:values.startTime}));
  await act(async()=>{await api.allowRetryAfterReview();});expect(api.unknown).toBe(false);
});
it('scope switch flushes old child input without copying the new form into it',async()=>{
  await act(async()=>{tree.update(<Probe v={{...values,notes:'child one'}}/>);});
  await act(async()=>{tree.update(<Probe baby="two" v={{...values,notes:'child two'}}/>);});
  expect((await readActivityDraft(scope,'bottle')).draft?.values.notes).toBe('child one');
  expect((await readActivityDraft({...scope,babyId:'two'},'bottle')).draft).toBeNull();
});
it('storage failure never claims a durable draft or dispatches without explicit unsafe choice',async()=>{
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk full'));
  const send=jest.fn(async():Promise<ActivitySaveOutcome>=>({status:'rejected'}));
  await act(async()=>{await api.save(send);});expect(send).not.toHaveBeenCalled();expect(api.error).toBe(true);
});
it('health withdrawal between local preparation and network dispatch cancels sending',async()=>{
  mockHealth=false;const send=jest.fn(async():Promise<ActivitySaveOutcome>=>({status:'confirmed',entryId:'x'}));
  await act(async()=>{await api.save(send);});expect(send).not.toHaveBeenCalled();
});
