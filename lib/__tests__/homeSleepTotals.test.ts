import { homeSleepMinutes } from '../homeSleepTotals';
import { pendingSleepOverlay } from '../sleepPendingOverlay';
import type { SleepEntry } from '../sleepData';
import type { PendingSleepStop } from '../sleepOfflineActions';
const day=new Date('2026-10-08T12:00:00');
const at=(h:number)=>new Date(2026,9,8,h).toISOString();
const entries:SleepEntry[]=[{id:'original',baby_id:'baby',start_time:at(8),end_time:null},{id:'nap',baby_id:'baby',start_time:at(6),end_time:at(7)}];
const action={scope:{babyId:'baby'},originalEntryId:'original',baseEntry:{entry:entries[0]},state:'needs_decision',chosenStopAt:at(9)} as PendingSleepStop;
it('separates confirmed totals from pending totals without changing the confirmed rows',()=>{
  expect(homeSleepMinutes(entries,day,day)).toBe(300);
  expect(homeSleepMinutes(pendingSleepOverlay(entries,[action]),day,day)).toBe(120);
  expect(entries[0].end_time).toBeNull();
  expect(homeSleepMinutes(pendingSleepOverlay(entries,[{...action,state:'discarded'}]),day,day)).toBe(300);
});
it('the new active sleep keeps its own duration while an old pending stop is shown',()=>{
  const rows=[{...entries[0],end_time:at(10)},entries[1],{id:'new',baby_id:'baby',start_time:at(11),end_time:null}];
  expect(homeSleepMinutes(pendingSleepOverlay(rows,[action]),day,day)).toBe(180);
  expect(pendingSleepOverlay(rows,[action]).find(e=>e.id==='new')?.end_time).toBeNull();
});
