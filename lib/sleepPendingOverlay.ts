import type { PendingSleepStop } from './sleepOfflineActions';
export const pendingSleepOverlay = <T extends { id?: string; baby_id?: string | null; start_time?: string | Date; end_time?: string | Date | null }>(entries: T[], actions: PendingSleepStop[]): T[] => {
  const pending = actions.filter(value => !['confirmed','discarded'].includes(value.state));
  return entries.map(entry => { const action = pending.find(value => value.originalEntryId === entry.id && value.scope.babyId === entry.baby_id); return action ? { ...entry, end_time: action.chosenStopAt,
    duration_minutes: Math.max(0, Math.round((Date.parse(action.chosenStopAt) - new Date(entry.start_time ?? action.baseEntry.entry.start_time).getTime())/60000)), localPending: true } : entry; });
};
