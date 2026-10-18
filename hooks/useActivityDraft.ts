import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { type LocalScope, localScopeKey } from '@/lib/localReadSnapshots';
import { localHealthAllowed, localHealthGeneration } from '@/lib/localHealthStorage';
import { activityDraftKey, claimActivityDraft, readActivityDraft, persistActivityDraft, removeActivityDraft,
  type ActivityDraft, type ActivityDraftValues, type ActivitySaveOutcome } from '@/lib/activityDrafts';

export function useActivityDraft({ enabled, scope, kind, values, restore }: {
  enabled: boolean; scope: LocalScope; kind: ActivityDraft['kind']; values: ActivityDraftValues; restore: (values: ActivityDraftValues) => void;
}) {
  const stableScope = useMemo(() => ({backendHost:scope.backendHost,userId:scope.userId,babyId:scope.babyId,localDateKey:scope.localDateKey}), [scope.backendHost,scope.userId,scope.babyId,scope.localDateKey]);
  const key = enabled ? `${localScopeKey(scope)}:${kind}` : '';
  const [view, setView] = useState<{ ready: boolean; choice?: ActivityDraft; corrupt?: boolean; saved?: boolean; error?: boolean; unknown?: boolean }>({ ready: false });
  const draft = useRef<ActivityDraft | null>(null); const latest = useRef(values); latest.current = values;
  const restoreRef = useRef(restore); restoreRef.current = restore;
  const session = useRef({ key: '', generation: 0, active: false, dirty: false, baseline: '', busy: false, values, draft: null as ActivityDraft | null });
  const preparing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flight = useRef<Promise<ActivityDraft | null> | null>(null);
  const cancel = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };
  const current = useCallback(() => session.current.active && session.current.key === key && localHealthAllowed(scope.userId, session.current.generation),[key,scope.userId]);
  const flush = async (): Promise<ActivityDraft | null> => {
    cancel(); if (flight.current) await flight.current;
    if (!current() || !session.current.dirty || session.current.busy) return draft.current;
    const captured = session.current; const nextValues = latest.current; captured.dirty = false;
    const job = persistActivityDraft(scope, kind, nextValues, captured.draft, captured.draft?.state ?? 'editing', captured.generation);
    flight.current = job;
    try { const saved = await job; captured.draft = saved; if (session.current === captured && current()) { draft.current = saved; setView(v => ({ ...v, saved: true, error: false })); } return saved; }
    catch (error) { if (session.current === captured && current()) { captured.dirty = true; setView(v => ({ ...v, error: true, saved: false })); } throw error; }
    finally { if (flight.current === job) flight.current = null; }
  };
  const flushRef = useRef(flush); flushRef.current = flush;
  useEffect(() => {
    cancel(); const captured = { key, generation: localHealthGeneration(), active: false, dirty: false, baseline: '', busy: false, values: latest.current, draft: null as ActivityDraft | null };
    session.current = captured; draft.current = null; setView({ ready: !enabled });
    if (!enabled) return;
    const release = claimActivityDraft(activityDraftKey(stableScope, kind));
    if (!release) { setView({ ready: false, error: true }); return; }
    let alive = true;
    void readActivityDraft(stableScope, kind).then(({ draft: saved, corrupt }) => {
      if (!alive || session.current !== captured || !localHealthAllowed(stableScope.userId, captured.generation)) return;
      captured.baseline = JSON.stringify(latest.current); captured.values = latest.current; captured.draft = saved; draft.current = saved;
      captured.active = !saved && !corrupt;
      setView({ ready: !saved && !corrupt, choice: saved ?? undefined, corrupt });
    }).catch(() => { if (alive) { captured.active = true; captured.baseline = JSON.stringify(latest.current); setView({ ready: true, error: true }); } });
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') void flushRef.current().catch(() => {}); });
    return () => { alive = false; cancel(); if (captured.active && captured.dirty && !captured.busy) {
      const previousFlight = flight.current;
      void (async () => { await previousFlight?.catch(() => {}); await persistActivityDraft(stableScope, kind, captured.values, captured.draft, captured.draft?.state ?? 'editing', captured.generation); })().catch(() => {});
    } captured.active = false; release(); subscription.remove(); };
  }, [key, enabled, kind, stableScope]);
  const signature = JSON.stringify(values);
  useEffect(() => {
    if (!current() || !view.ready || session.current.busy || draft.current?.state !== undefined && draft.current.state !== 'editing') return;
    if (signature === session.current.baseline) return;
    session.current.values = values; session.current.baseline = signature; session.current.dirty = true; cancel();
    timer.current = setTimeout(() => { void flushRef.current().catch(() => {}); }, 300);
  }, [signature, view.ready, key, current, values]);
  const resume = () => {
    const saved = draft.current; if (!saved) return;
    restoreRef.current(saved.values); latest.current = saved.values;
    session.current.values = saved.values; session.current.baseline = JSON.stringify(saved.values); session.current.active = true;
    setView({ ready: true, saved: true, unknown: saved.state === 'confirmation_unknown' });
  };
  const discard = async () => {
    await removeActivityDraft(scope, kind); draft.current = null; session.current.draft = null; session.current.active = true;
    session.current.baseline = JSON.stringify(latest.current); setView({ ready: true });
  };
  const save = async (send: () => Promise<ActivitySaveOutcome | void>, unsafe = false) => {
    if (!current() || preparing.current || session.current.busy || !view.ready || view.unknown || draft.current?.state === 'confirmation_unknown' || draft.current?.state === 'sending') return;
    preparing.current = true;
    try {
    let sent: ActivityDraft | null = null;
    try {
      session.current.dirty = true; await flush();
      sent = await persistActivityDraft(scope, kind, latest.current, draft.current, 'sending', session.current.generation);
      draft.current = sent; session.current.draft = sent;
    } catch { if (!unsafe) return; }
    if (!current()) return;
    session.current.busy = true;
    let outcome: ActivitySaveOutcome | void;
    try { outcome = await send(); } catch (error) { outcome = { status: 'confirmation_unknown', error }; }
    if (!current()) return;
    if ((outcome?.status === 'confirmed' || outcome?.status === 'queued') && outcome.entryId) {
      if (sent) await removeActivityDraft(scope, kind, sent).catch(() => {});
      session.current.dirty = false; draft.current = null; session.current.draft = null; setView({ ready: true });
    } else {
      const state = outcome?.status === 'rejected' ? 'editing' : 'confirmation_unknown';
      if (sent) {
        try { draft.current = await persistActivityDraft(scope, kind, sent.values, sent, state, session.current.generation); session.current.draft = draft.current; }
        catch { setView(v => ({ ...v, error: true })); }
      }
      setView(v => ({ ...v, unknown: state === 'confirmation_unknown', saved: !!sent }));
    }
    session.current.busy = false;
    return outcome;
    } finally { preparing.current = false; }
  };
  const allowRetryAfterReview = async () => {
    if (draft.current) draft.current = await persistActivityDraft(scope, kind, draft.current.values, draft.current, 'editing', session.current.generation);
    session.current.draft = draft.current;
    setView(v => ({ ...v, unknown: false }));
  };
  return { ...view, draft: draft.current, flush, resume, discard, save, allowRetryAfterReview };
}
