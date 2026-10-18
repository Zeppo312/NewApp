import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadPregnancyHomeDataWithCache, invalidateDueDateCache } from '../pregnancyCache';
import { writeSnapshot, readSnapshot } from '../localReadSnapshots';
import { getDueDateWithLinkedUsers } from '../supabase';
import { getPregnancyAge, parsePregnancyDate } from '../pregnancy-age';
let mockUser='parent';let mockGeneration=0;
const mockProfile=jest.fn();
jest.mock('../supabase',()=>({supabaseUrl:'https://fixture.supabase.co',getDueDateWithLinkedUsers:jest.fn(),supabase:{from:()=>({select(){return this;},eq(){return this;},abortSignal(){return this;},single:()=>mockProfile()})}}));
jest.mock('../dataConsentRuntime',()=>({getRuntimeDataConsents:()=>({userId:mockUser,generation:mockGeneration}),runtimeConsentAllowed:()=>true}));
jest.mock('../supabase/recommendations',()=>({getRecommendations:jest.fn()}));
jest.mock('../screenCache',()=>({invalidateCacheAfterAction:jest.fn()}));
const scope={backendHost:'fixture.supabase.co',userId:'parent'};
const due=jest.mocked(getDueDateWithLinkedUsers);
const validDate=(v:unknown):v is string=>typeof v==='string';
beforeEach(async()=>{mockUser='parent';mockGeneration++;await AsyncStorage.clear();jest.clearAllMocks();mockProfile.mockResolvedValue({data:{first_name:'New',avatar_url:null},error:null});});
it('cold-start date is parsed locally; failed due refresh keeps it and never claims a successful refresh',async()=>{
  await writeSnapshot(scope,'pregnancy-due','2027-03-04');await writeSnapshot(scope,'pregnancy-profile',{firstName:'Saved',avatarUrl:null});
  const changed=jest.fn();const data=await loadPregnancyHomeDataWithCache('parent',{onConfirmed:changed});
  expect(data.dueDate.date).toBeInstanceOf(Date);expect(data.dueDate.date?.getDate()).toBe(4);expect(data.dueDate.currentWeek).toBe(getPregnancyAge(parsePregnancyDate('2027-03-04'))?.runningWeek);
  due.mockResolvedValue({success:false,error:{code:'42501'}} as any);await expect(data.refresh()).rejects.toThrow('pregnancy_refresh_failed');
  expect(changed).toHaveBeenCalledWith({profile:{firstName:'New',avatarUrl:null}},expect.any(String));expect(changed.mock.calls.some(c=>c[0].dueDate)).toBe(false);
  expect((await readSnapshot(scope,'pregnancy-due',validDate))?.data).toBe('2027-03-04');
});
it('confirmed background date reaches the screen; confirmed absent due removes the cached date',async()=>{
  const changed=jest.fn();due.mockResolvedValue({success:true,dueDate:'2027-03-05'} as any);
  const data=await loadPregnancyHomeDataWithCache('parent',{onConfirmed:changed});await expect(data.refresh()).resolves.toBe(true);
  expect(changed.mock.calls.find(c=>c[0].dueDate)?.[0].dueDate.date.getDate()).toBe(5);
  due.mockResolvedValue({success:true,dueDate:null} as any);await data.refresh();
  const next=await loadPregnancyHomeDataWithCache('parent');expect(next.hasDueDate).toBe(true);expect(next.dueDate.date).toBeNull();
});
it('an old response after a due-date mutation or account change cannot restore the old snapshot',async()=>{
  let resolve!:(v:any)=>void;due.mockImplementation(()=>new Promise(r=>{resolve=r;}));const changed=jest.fn();
  const data=await loadPregnancyHomeDataWithCache('parent',{onConfirmed:changed});const refresh=data.refresh();await Promise.resolve();await invalidateDueDateCache('parent');mockUser='other';mockGeneration++;resolve({success:true,dueDate:'2027-03-04'});
  await expect(refresh).rejects.toThrow('pregnancy_refresh_failed');mockUser='parent';
  expect((await readSnapshot(scope,'pregnancy-due',validDate))).toBeNull();expect(changed.mock.calls.some(c=>c[0].dueDate)).toBe(false);
});
it('deduplicated refresh delivers the confirmed date to every current screen subscriber',async()=>{
  let resolve!:(v:any)=>void;due.mockImplementation(()=>new Promise(r=>{resolve=r;}));
  const first=jest.fn(),second=jest.fn();
  const a=await loadPregnancyHomeDataWithCache('parent',{onConfirmed:first});
  const b=await loadPregnancyHomeDataWithCache('parent',{onConfirmed:second});
  const refreshA=a.refresh(),refreshB=b.refresh();await Promise.resolve();
  resolve({success:true,dueDate:'2027-03-05'});await Promise.all([refreshA,refreshB]);
  expect(due).toHaveBeenCalledTimes(1);
  for(const subscriber of [first,second]) expect(subscriber.mock.calls.find(c=>c[0].dueDate)?.[0].dueDate.date.getDate()).toBe(5);
});
