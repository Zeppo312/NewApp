import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useAuth } from './AuthContext';
import { localHealthAllowed, localHealthGeneration, subscribeLocalHealth } from '@/lib/localHealthStorage';
import { subscribeDataConsents } from '@/lib/dataConsentRuntime';
import { onServerContact } from '@/lib/serverContact';
import { readTrackingOutbox, runTrackingSync, type TrackingOperation } from '@/lib/trackingOutbox';

type Value = { operations: TrackingOperation[]; ready: boolean; storageError: boolean; refresh: () => Promise<void> };
const Context = createContext<Value>({ operations: [], ready: false, storageError: false, refresh: async () => {} });
export const useTrackingSync = () => useContext(Context);
export function TrackingSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [value, setValue] = useState<Omit<Value,'refresh'>>({ operations: [], ready: false, storageError: false });
  const [revision, setRevision] = useState(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => subscribeDataConsents(() => setRevision(v => v + 1)), []);
  useEffect(() => {
    const userId = user?.id; let alive = true; let reading = false; let again = false;
    const generation = localHealthGeneration();
    const current = () => alive && !!userId && localHealthAllowed(userId, generation);
    setValue({ operations: [], ready: false, storageError: false });
    if (!userId || !localHealthAllowed(userId, generation)) return;
    const read = async () => {
      if (!current()) return;
      if (reading) { again = true; return; } reading = true;
      try { const operations = await readTrackingOutbox(userId); if (current()) setValue(v => v.ready && !v.storageError && JSON.stringify(v.operations) === JSON.stringify(operations) ? v : { operations, ready: true, storageError: false }); }
      catch { if (current()) setValue(v => ({ ...v, ready: true, storageError: true })); }
      finally { reading = false; if (again && current()) { again = false; void read(); } }
    };
    const sync = async () => {
      if (!current() || AppState.currentState !== 'active') return;
      await runTrackingSync(userId).catch(() => {}); await read();
    };
    refreshRef.current = sync;
    void read().then(sync);
    const local = subscribeLocalHealth(() => {
      if (!current()) { setValue({ operations: [], ready: false, storageError: false }); if (alive) setRevision(v => v + 1); }
      else void read();
    });
    // A transport can reconnect without a navigation or AppState transition.
    const heartbeat = setInterval(() => { void sync(); }, 15000);
    const state = AppState.addEventListener('change', next => { if (next === 'active') void sync(); });
    const contact = onServerContact(() => { void sync(); });
    return () => { alive = false; local(); contact(); state.remove(); clearInterval(heartbeat); };
  }, [user?.id, revision]);
  return <Context.Provider value={{ ...value, refresh: () => refreshRef.current() }}>{children}</Context.Provider>;
}
