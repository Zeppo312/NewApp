import type { SleepEntry } from './sleepData';
/** Preserve Home's existing whole-block metric when a block touches this day. */
export function homeSleepMinutes(entries: SleepEntry[], day: Date, now = new Date()) {
  const start = new Date(day);start.setHours(0,0,0,0);const end = new Date(day);end.setHours(23,59,59,999);
  const intervals = entries.map(entry=>({start:Date.parse(String(entry.start_time)),end:entry.end_time ? Date.parse(String(entry.end_time)) : now.getTime()}))
    .filter(v=>Number.isFinite(v.start)&&Number.isFinite(v.end)&&v.end>v.start&&v.start<=end.getTime()&&v.end>=start.getTime()).sort((a,b)=>a.start-b.start);
  const merged:{start:number;end:number}[]=[];
  for(const interval of intervals){const last=merged[merged.length-1];if(!last||interval.start>last.end)merged.push({...interval});else last.end=Math.max(last.end,interval.end);}
  return merged.reduce((sum,v)=>sum+Math.round((v.end-v.start)/60000),0);
}
export function validHomeSleepRows(value:unknown): value is SleepEntry[] {
  return Array.isArray(value) && value.every(e=>e&&typeof e.id==='string'&&typeof e.baby_id==='string'&&Number.isFinite(Date.parse(e.start_time))&&(e.end_time===null||Number.isFinite(Date.parse(e.end_time))));
}
