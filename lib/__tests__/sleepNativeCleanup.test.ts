import { NativeModules, Platform } from 'react-native';
const mockNative={isSupported:jest.fn(async()=>true),startSleepActivity:jest.fn(),updateSleepActivity:jest.fn(async()=>true),endSleepActivity:jest.fn(async()=>true),endAllSleepActivities:jest.fn(async()=>true)};
const mockWidget={syncSnapshot:jest.fn(),clearSnapshot:jest.fn(async()=>true)};
Object.defineProperty(Platform,'OS',{value:'ios',configurable:true});
NativeModules.LiveActivityModule=mockNative;NativeModules.SleepWidgetModule=mockWidget;
// The bridges capture NativeModules at import time, after these explicit fixtures.
const { sleepActivityService } = require('../sleepActivityService') as typeof import('../sleepActivityService');
const { syncSleepWidget, clearSleepWidget } = require('../sleepWidget') as typeof import('../sleepWidget');
beforeEach(()=>jest.clearAllMocks());
it('a native start reply after cleanup ends only that late activity and does not restore its ID',async()=>{
  let resolve!:(id:string)=>void;let enter!:()=>void;const started=new Promise<void>(r=>{enter=r;});mockNative.startSleepActivity.mockImplementation(()=>new Promise(r=>{resolve=r;enter();}));
  const pending=sleepActivityService.startSleepActivity(new Date());await started;await sleepActivityService.endAllSleepActivities();resolve('old-native-id');expect(await pending).toBeNull();expect(mockNative.endSleepActivity).toHaveBeenCalledWith('old-native-id','00:00:00',null);
});
it('ending a bound old activity cannot end or forget the new activity started during its response',async()=>{
  let release!:(v:boolean)=>void;let enter!:()=>void;const began=new Promise<void>(r=>{enter=r;});
  mockNative.endSleepActivity.mockImplementationOnce(()=>new Promise(r=>{release=r;enter();}));
  const end=sleepActivityService.endSleepActivityById('old-bound-id',null,'60');await began;
  mockNative.startSleepActivity.mockResolvedValueOnce('new-native-id');await sleepActivityService.startSleepActivity(new Date());
  release(true);await end;await sleepActivityService.updateSleepActivity('00:00:02');
  expect(mockNative.endSleepActivity).toHaveBeenCalledWith('old-bound-id','60',null);
  expect(mockNative.updateSleepActivity).toHaveBeenCalledWith('new-native-id','00:00:02',null);
});
it('widget clear drains an already started native write, then removes it',async()=>{
  let release!:()=>void;let enter!:()=>void;const began=new Promise<void>(r=>{enter=r;});mockWidget.syncSnapshot.mockImplementation(()=>new Promise<void>(r=>{release=r;enter();}));
  const write=syncSleepWidget([]);await began;const clear=clearSleepWidget();expect(mockWidget.clearSnapshot).not.toHaveBeenCalled();release();await Promise.all([write,clear]);expect(mockWidget.clearSnapshot).toHaveBeenCalledTimes(1);
});
it('a late end-all reply does not forget a successor activity',async()=>{
  let release!:(value:boolean)=>void;let enter!:()=>void;const began=new Promise<void>(r=>{enter=r;});
  mockNative.endAllSleepActivities.mockImplementationOnce(()=>new Promise(r=>{release=r;enter();}));
  const cleanup=sleepActivityService.endAllSleepActivities();await began;
  mockNative.startSleepActivity.mockResolvedValueOnce('successor-id');await sleepActivityService.startSleepActivity(new Date());
  release(true);await cleanup;await sleepActivityService.updateSleepActivity('00:00:03');
  expect(mockNative.updateSleepActivity).toHaveBeenCalledWith('successor-id','00:00:03',null);
});
it('overlapping native starts keep the successor and end only the late old identifier',async()=>{
  let release!:(value:string)=>void;let enter!:()=>void;const began=new Promise<void>(r=>{enter=r;});
  mockNative.startSleepActivity.mockImplementationOnce(()=>new Promise(r=>{release=r;enter();}));
  const old=sleepActivityService.startSleepActivity(new Date());await began;
  mockNative.startSleepActivity.mockResolvedValueOnce('successor-id');await sleepActivityService.startSleepActivity(new Date());
  release('late-old-id');expect(await old).toBeNull();await sleepActivityService.updateSleepActivity('00:00:04');
  expect(mockNative.endSleepActivity).toHaveBeenCalledWith('late-old-id','00:00:00',null);
  expect(mockNative.updateSleepActivity).toHaveBeenCalledWith('successor-id','00:00:04',null);
});
