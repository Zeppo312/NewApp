import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState, View, Text, TouchableOpacity } from 'react-native';
import { useAuth } from './AuthContext';
import { useActiveBaby } from './ActiveBabyContext';
import { useLocale } from './LocaleContext';
import { supabase } from '@/lib/supabase';
import { backendHost, readSnapshot, writeSnapshot } from '@/lib/localReadSnapshots';
import { clearLocalHealthData, localHealthAllowed, localHealthGeneration, subscribeLocalHealth } from '@/lib/localHealthStorage';
import { subscribeDataConsents } from '@/lib/dataConsentRuntime';
import { onServerContact } from '@/lib/serverContact';
import { readSleepCapability, readSleepSyncSnapshot, SLEEP_OFFLINE_ENABLED, type VersionedSleepEntry } from '@/lib/sleepSyncContract';
import { createPendingSleepStop, readKnownActiveSleep, rememberActiveSleep, listPendingSleepStops, type ConfirmedSleepSnapshot, type PendingSleepStop } from '@/lib/sleepOfflineActions';
import { runSleepRecovery, editPendingSleepStop } from '@/lib/sleepOfflineRecovery';
import { sleepActivityService } from '@/lib/sleepActivityService';
import { clearSleepWidget, syncSleepWidget } from '@/lib/sleepWidget';
import { SleepSyncConflictModal } from '@/components/SleepSyncConflictModal';
import { loadNightWindowSettings } from '@/lib/nightWindowSettings';
import { pendingSleepOverlay, acknowledgeSleepStop, sleepAccessNoticeKey, recordSleepAccessNotice } from '@/lib/sleepOfflineActions';
import { findFreshActiveSleepEntry } from '@/lib/sleepEntryGuards';
import type { SleepEntry } from '@/lib/sleepData';
import { offlineText } from '@/lib/offlineTranslations';
import type { NightWindowSettings } from '@/lib/nightWindowSettings';
type Value = { enabled: boolean; actions: PendingSleepStop[]; knownActive: ConfirmedSleepSnapshot | null;
  stop: (entry: { id?: string; baby_id?: string | null }, at: string, quality: VersionedSleepEntry['quality'], notes: string | null) => Promise<PendingSleepStop>;
  refresh: () => Promise<void> };
const Context = createContext<Value>({ enabled: false, actions: [], knownActive: null, stop: async () => { throw new Error('Sleep offline unavailable'); }, refresh: async () => {} });
export const useSleepOffline = () => useContext(Context);
const nativeStopDuration = (action: PendingSleepStop) => {
  const seconds = Math.max(0, Math.floor((Date.parse(action.chosenStopAt) - Date.parse(action.baseEntry.entry.start_time)) / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map(value => String(value).padStart(2, '0')).join(':');
};
export function SleepOfflineProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth(); const { activeBabyId, babies } = useActiveBaby(); const { locale } = useLocale();
  const [accessNotice, setAccessNotice] = useState(false);
  const [enabled, setEnabled] = useState(false); const [actions, setActions] = useState<PendingSleepStop[]>([]);
  const [knownActive, setKnownActive] = useState<ConfirmedSleepSnapshot | null>(null);
  const [selected, setSelected] = useState<string | null>(null); const [revision, setRevision] = useState(0);
  const scopeRef = useRef(`${user?.id}:${activeBabyId}`); scopeRef.current = `${user?.id}:${activeBabyId}`;
  const nativeInfoRef = useRef({babies,locale}); nativeInfoRef.current = {babies,locale};
  const nativeBindingRef = useRef<{scope:string;entryId:string;activityId:string} | null>(null);
  const projectionRef = useRef<{scope:string;entries:VersionedSleepEntry[];settings:NightWindowSettings} | null>(null);
  const actionsRef = useRef(actions); actionsRef.current = actions;
  useEffect(() => subscribeDataConsents(() => setRevision(v => v + 1)), []);
  useEffect(() => {
    setAccessNotice(false); setEnabled(false); setActions([]); setKnownActive(null); setSelected(null);
    nativeBindingRef.current = null; projectionRef.current = null;
    const userId = user?.id; if (!userId || !SLEEP_OFFLINE_ENABLED) return;
    const scope = { backendHost: backendHost(), userId, babyId: activeBabyId };
    const key = scopeRef.current; let alive = true; let accessLost = false; let starting = false; let startAgain = false; let reading = false; let readPending = false; let journalSignature = '';

    const generation = localHealthGeneration(); const current = () => alive && scopeRef.current === key && localHealthAllowed(userId, generation);
    const loseAccess = async () => {
      if (!current() || !activeBabyId) return;
      const binding = nativeBindingRef.current;
      accessLost = true;
      nativeBindingRef.current = null; projectionRef.current = null;
      setEnabled(false); setKnownActive(null); setActions([]);
      // A read without a pending stop must enforce the same access boundary.
      await clearLocalHealthData(userId, activeBabyId);
      await recordSleepAccessNotice(userId);
      if (alive && scopeRef.current === key) setAccessNotice(true);
      if (binding?.scope === key) await sleepActivityService.endSleepActivityById(binding.activityId, null, '00:00:00');
      // Do not clear a successor's widget after a scope switch.
      if (scopeRef.current === key) await clearSleepWidget();
    };
    const loadJournal = async () => {
      if (!current()) return; if (reading) { readPending = true; return; } reading = true;
      try { const rows = await listPendingSleepStops(userId); const notice = await AsyncStorage.getItem(sleepAccessNoticeKey(userId)); if (current()) { setAccessNotice(notice === 'access_lost'); } if (current()) { setActions(rows); const signature = rows.map(a => `${a.originalEntryId}:${a.localRevision}`).join('|'); if (signature !== journalSignature) { journalSignature = signature; void start().catch(() => {}); } } }
      finally { reading = false; if (readPending) { readPending = false; void loadJournal(); } }
    };
    const start = async () => {
      if (accessLost && alive && scopeRef.current === key) { setRevision(v => v + 1); return; }
      if (!current()) return;
      if (starting) { startAgain = true; return; } starting = true;
      try {
      const cachedCapability = await readSnapshot(scope, 'sleep-capability', (v): v is boolean => v === true);
      const known = activeBabyId ? await readKnownActiveSleep(scope) : null;
      const savedBinding = await readSnapshot(scope,'sleep-native-binding',(v):v is {entryId:string;activityId:string} => !!v && typeof (v as any).entryId==='string' && typeof (v as any).activityId==='string');
      if (!current()) return;
      if (!nativeBindingRef.current && known && savedBinding?.data.entryId===known.data.entry.id) nativeBindingRef.current={scope:key,...savedBinding.data};
      setEnabled(cachedCapability?.data === true); setKnownActive(known?.data ?? null); await loadJournal();
      const localActions = await listPendingSleepStops(userId); if (!current()) return;
      const localBinding = nativeBindingRef.current;
      const localStop = localActions.find(a => a.scope.babyId === activeBabyId && a.originalEntryId === localBinding?.entryId && a.state !== 'discarded');
      if (localBinding?.scope === key && localStop) {
        // Recover a crash after journal persistence but before native ending,
        // even when the server cannot currently be reached.
        await sleepActivityService.endSleepActivityById(localBinding.activityId, localStop.proposedQuality, nativeStopDuration(localStop));
        if (!current()) return;
        await clearSleepWidget(); if (!current()) return;
      }
      try {
        const available = await readSleepCapability(userId); if (!current()) return; setEnabled(available);
        if (available) {
          await writeSnapshot(scope, 'sleep-capability', true, new Date().toISOString(), generation);
          if (activeBabyId) {
            let snapshot = await readSleepSyncSnapshot(userId, activeBabyId, null);
            if (!current()) return;
            if (snapshot.status === 'forbidden') { await loseAccess(); return; }
            if (snapshot.status === 'available') {
              const initialActive = snapshot.entries.filter(e => e.end_time === null);
              if (initialActive.length === 1) {
                const target = await readSleepSyncSnapshot(userId, activeBabyId, initialActive[0].id);
                if (!current()) return;
                if (target.status === 'forbidden') { await loseAccess(); return; }
                if (target.status === 'available') snapshot = target; else throw new Error('Sleep access changed');
              }
              if (!current()) return;
              await rememberActiveSleep(scope, snapshot); if (!current()) return;
              const active = snapshot.entries.filter(e => e.end_time === null);
              setKnownActive(active.length === 1 ? { canWrite: snapshot.original?.id === active[0].id && snapshot.canWrite, entry: active[0], scopeRevision: snapshot.scopeRevision, verifiedAt: snapshot.verifiedAt } : null);
              const journal = await listPendingSleepStops(userId); if (!current()) return;
              const visible = pendingSleepOverlay(snapshot.entries, journal);
              const settings = await loadNightWindowSettings(userId); if (!current()) return;
              projectionRef.current = {scope:key,entries:snapshot.entries,settings};
              const pending = journal.some(a => a.scope.babyId === activeBabyId && !['confirmed','discarded'].includes(a.state));
              await syncSleepWidget(visible as unknown as SleepEntry[], { locale: nativeInfoRef.current.locale, babyName: nativeInfoRef.current.babies.find(b => b.id === activeBabyId)?.name, nightWindowSettings: settings, localStopPending: pending });
              if (!current()) return;
              const currentActive = findFreshActiveSleepEntry(visible);
              const existing = await sleepActivityService.restoreCurrentActivity(); if (!current()) return;
              if (!currentActive) { nativeBindingRef.current = null; await writeSnapshot(scope,'sleep-native-binding',null,new Date().toISOString(),generation); if (!current()) return; await sleepActivityService.endAllSleepActivities(); }
              else if (!existing?.isTracking || Date.parse(existing.startTime) !== Date.parse(currentActive.start_time)
                || nativeBindingRef.current?.scope !== key || nativeBindingRef.current.entryId !== currentActive.id || nativeBindingRef.current.activityId !== existing.id) {
                await sleepActivityService.endAllSleepActivities(); if (!current()) return;
                const activityId = await sleepActivityService.startSleepActivity(new Date(currentActive.start_time), nativeInfoRef.current.babies.find(b => b.id === activeBabyId)?.name);
                if (!current() && activityId) { await sleepActivityService.endSleepActivityById(activityId, null, '00:00:00'); return; }
                if (current() && activityId) nativeBindingRef.current = {scope:key,entryId:currentActive.id!,activityId};
              } else nativeBindingRef.current = {scope:key,entryId:currentActive.id!,activityId:existing.id};
              const binding = nativeBindingRef.current;
              if (current() && binding?.scope===key) await writeSnapshot(scope,'sleep-native-binding',{entryId:binding.entryId,activityId:binding.activityId},new Date().toISOString(),generation);
            }

          }
          await runSleepRecovery(userId);
        }
      } catch { /* The permitted cached capability/snapshot stays explicitly old. */ }
      } finally { starting = false; if (startAgain && current()) { startAgain = false; void start().catch(() => {}); } }
    };
    void start().catch(() => {});
    const unsubscribe = subscribeLocalHealth(() => { if (!current()) { setActions([]); setKnownActive(null); setEnabled(false); if (alive && !accessLost && generation !== localHealthGeneration()) setRevision(v => v + 1); } else void loadJournal(); });
    const contact = onServerContact(() => { if (current() && actionsRef.current.some(a => ['pending','checking','sending','confirmation_unknown'].includes(a.state))) void runSleepRecovery(userId).catch(() => {}); });
    const foreground = AppState.addEventListener('change', state => { if (state === 'active') void start().catch(() => {}); });
    const channel = supabase.channel(`sleep-journal-${userId}-${generation}-${activeBabyId}`);
    // Payloads trigger reads only. Membership/share changes also re-check access.
    for (const [table, column] of [['baby_members','user_id'],['sleep_entry_shares','shared_with_id']] as const) channel.on('postgres_changes', { event:'*', schema:'public', table, filter:`${column}=eq.${userId}` }, () => { void start().catch(() => {}); });
    for (const column of ['creator_id','invited_id']) channel.on('postgres_changes', { event:'*', schema:'public', table:'account_links', filter:`${column}=eq.${userId}` }, () => { void start().catch(() => {}); });
    if (activeBabyId) channel.on('postgres_changes', { event:'*', schema:'public', table:'sleep_entries', filter:`baby_id=eq.${activeBabyId}` }, () => { void start().catch(() => {}); });
    for (const column of ['user_id','partner_id','shared_with_user_id']) channel.on('postgres_changes', { event:'*', schema:'public', table:'sleep_entries', filter:`${column}=eq.${userId}` }, () => { void start().catch(() => {}); });
    channel.subscribe(status => { if (status === 'SUBSCRIBED') void start().catch(() => {}); });
    return () => { alive=false; unsubscribe(); contact(); foreground.remove(); void supabase.removeChannel(channel); };
  }, [user?.id, activeBabyId, revision]);
  const refresh = async () => {
    if (!user?.id) return;
    setRevision(v => v + 1);
    for (const action of actions) if (action.state === 'blocked') await editPendingSleepStop(action, {}).catch(() => {});
    await runSleepRecovery(user.id);
  };
  const stop: Value['stop'] = async (entry, at, quality, notes) => {
    const userId = user?.id; const generation = localHealthGeneration(); const key = scopeRef.current;
    if (!enabled || !userId || !activeBabyId || entry.baby_id !== activeBabyId || !entry.id || !localHealthAllowed(userId,generation)) throw new Error('Sleep offline unavailable');
    const scope = { backendHost: backendHost(), userId, babyId: activeBabyId };
    let base = knownActive?.entry.id === entry.id && knownActive.entry.baby_id === activeBabyId && knownActive.canWrite ? knownActive : null;
    // The confirmed local base permits an immediate durable intent. Recovery performs
    // the fresh pure read and the server rechecks permission/version atomically.
    if (!base) {
      const fresh = await readSleepSyncSnapshot(userId, activeBabyId, entry.id);
      if (fresh.status !== 'available' || !fresh.canWrite || !fresh.original || fresh.original.end_time) throw new Error('Original sleep is unavailable');
      base = { canWrite: true, entry: fresh.original, scopeRevision: fresh.scopeRevision, verifiedAt: fresh.verifiedAt };
    }
    if (scopeRef.current!==key || !localHealthAllowed(userId,generation) || !base || !base.canWrite || base.entry.id!==entry.id || base.entry.baby_id!==activeBabyId) throw new Error('No matching active snapshot');
    const action = await createPendingSleepStop(scope,base,at,quality,notes);
    if (scopeRef.current !== key || !localHealthAllowed(userId,generation)) return action;
    const binding = nativeBindingRef.current;
    if (binding?.scope === key && binding.entryId === action.originalEntryId) {
      // Retain identity until the next canonical projection: a successor must
      // receive a new activity ID even if its start time happens to be equal.
      void sleepActivityService.endSleepActivityById(binding.activityId,quality,nativeStopDuration(action));
    }
    const projection = projectionRef.current;
    if (projection?.scope === key) void syncSleepWidget(pendingSleepOverlay(projection.entries,[...actionsRef.current.filter(a=>a.originalEntryId!==action.originalEntryId),action]) as unknown as SleepEntry[],
      {locale,babyName:babies.find(b=>b.id===activeBabyId)?.name,nightWindowSettings:projection.settings,localStopPending:true});
    else if (binding?.scope === key && binding.entryId===action.originalEntryId) void clearSleepWidget();
    void runSleepRecovery(userId).catch(() => {});
    return action;
  };
  const pending = actions.filter(a => !['confirmed','discarded'].includes(a.state));
  const result = actions.find(a => ['confirmed','discarded'].includes(a.state) && !a.resultSeen);
  const selectedAction = actions.find(a => a.originalEntryId===selected) ?? null;
  return <Context.Provider value={{enabled,actions,knownActive,stop,refresh}}>
    {children}
    {accessNotice && <TouchableOpacity style={{position:'absolute',left:12,right:12,bottom:145,padding:12,backgroundColor:'#FFF2DA'}} onPress={() => { if (user?.id) void AsyncStorage.removeItem(sleepAccessNoticeKey(user.id)).then(() => setAccessNotice(false)); }}><Text>{offlineText(locale,'accessLost')}</Text></TouchableOpacity>}
    {(pending.length>0 || result) && <View style={{ position:'absolute',left:12,right:12,bottom:96,padding:12,borderRadius:12,backgroundColor:'#FFF2DA' }} accessibilityLiveRegion="polite">
      {pending.map(action => <TouchableOpacity key={action.originalEntryId} onPress={() => setSelected(action.originalEntryId)}><Text style={{color:'#5B4332'}}>{offlineText(locale,'pending',{time:new Date(action.chosenStopAt).toLocaleString(locale)})} · {offlineText(locale,'inspect')}</Text></TouchableOpacity>)}
      {pending.length>0 && <TouchableOpacity onPress={() => void refresh().catch(() => {})}><Text style={{color:'#5B4332',paddingTop:8}}>{offlineText(locale,'sync')}</Text></TouchableOpacity>}
      {result && <TouchableOpacity onPress={() => { void acknowledgeSleepStop(result).catch(() => {}); }}><Text style={{color:'#5B4332'}}>{offlineText(locale,result.outcome==='agreed'?'agreed':result.outcome==='discarded'?'shortDiscarded':result.state==='discarded'?'sharedKept':'applied',{time:new Date(result.chosenStopAt).toLocaleString(locale)})} ✓</Text></TouchableOpacity>}
    </View>}
    <SleepSyncConflictModal action={selectedAction} babyName={babies.find(b=>b.id===selectedAction?.scope.babyId)?.name ?? undefined} onClose={() => setSelected(null)} />
  </Context.Provider>;
}
