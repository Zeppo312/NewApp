import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { getAdvisorSettingsSync, type AdvisorSettingsState } from '@/lib/advisor/settingsSync';

const EMPTY: AdvisorSettingsState = { settings: null, status: 'idle' };
const emptySnapshot = () => EMPTY;
const emptySubscribe = () => () => {};

export function useAdvisorSettings(userId?: string) {
  const sync = useMemo(() => userId ? getAdvisorSettingsSync(userId) : null, [userId]);
  const state = useSyncExternalStore(sync?.subscribe ?? emptySubscribe, sync?.getSnapshot ?? emptySnapshot, emptySnapshot);
  useEffect(() => { sync?.start(); }, [sync]);
  return { ...state, update: sync?.update, retry: sync?.retry, reload: sync?.reload };
}
