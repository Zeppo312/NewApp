import { Alert } from 'react-native';
import { confirmPendingSleepLogout } from '../sleepLogout';
import { listPendingSleepStops } from '../sleepOfflineActions';
import { readTrackingOutbox } from '../trackingOutbox';
let mockHealth=true;
jest.mock('../localHealthStorage',()=>({localHealthAllowed:()=>mockHealth,localHealthGeneration:()=>1}));
jest.mock('../sleepOfflineActions',()=>({listPendingSleepStops:jest.fn()}));
jest.mock('../trackingOutbox',()=>({readTrackingOutbox:jest.fn(async()=>[])}));
jest.mock('../localization',()=>({getPersistedAppLocale:async()=> 'de'}));
beforeEach(()=>{mockHealth=true;jest.clearAllMocks();});
it('explains pending count and Back preserves the session; explicit discard permits sign-out',async()=>{
  jest.mocked(listPendingSleepStops).mockResolvedValue([{state:'pending'},{state:'confirmed'},{state:'needs_decision'}] as any);
  const alert=jest.spyOn(Alert,'alert').mockImplementation((_t,_body,buttons)=>buttons?.[0].onPress?.());
  expect(await confirmPendingSleepLogout('a')).toBe(false);expect(alert.mock.calls[0][1]).toContain('2 ausstehende');
  alert.mockImplementation((_t,_body,buttons)=>buttons?.[1].onPress?.());expect(await confirmPendingSleepLogout('a')).toBe(true);alert.mockRestore();
});
it('health withdrawal never waits for the logout decision',async()=>{
  mockHealth=false;expect(await confirmPendingSleepLogout('a')).toBe(true);expect(listPendingSleepStops).not.toHaveBeenCalled();
});
it('warns once for an unsynced activity and its dependent stop before explicit sign-out',async()=>{
  jest.mocked(listPendingSleepStops).mockResolvedValue([]);
  jest.mocked(readTrackingOutbox).mockResolvedValueOnce([{state:'sending',kind:'care',entryId:'one',scope:{babyId:'baby'}},{state:'pending',kind:'care',entryId:'one',scope:{babyId:'baby'}}] as any);
  const alert=jest.spyOn(Alert,'alert').mockImplementation((_t,_body,buttons)=>buttons?.[0].onPress?.());
  expect(await confirmPendingSleepLogout('a')).toBe(false);expect(alert.mock.calls[0][1]).toContain('1 ausstehende Einträge');alert.mockRestore();
});
