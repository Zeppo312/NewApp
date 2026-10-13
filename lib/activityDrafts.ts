import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { type LocalScope, localScopeKey } from './localReadSnapshots';
import { localHealthAllowed, localHealthGeneration, serializeLocalHealth, notifyLocalHealth } from './localHealthStorage';
export type ActivitySaveOutcome = { status: 'confirmed' | 'queued'; entryId: string } | { status: 'rejected' | 'confirmation_unknown'; error?: unknown };
export type ActivityDraftValues = {
  startTime: string; endTime: string | null; isEndTimeVisible: boolean; notes: string;
  volumeMl: number; diaperType: 'wet' | 'dirty' | 'both';
  selectedDiaperItemId: string | null; selectedFormulaItemId: string | null;
  diaperFeverMeasured: boolean; diaperTemperatureC: string; diaperSuppositoryGiven: boolean; diaperSuppositoryDoseMg: string;
};
export type ActivityDraft = { schemaVersion: 1; id: string; revision: number; scope: LocalScope; kind: 'bottle' | 'diaper';
  createdAt: string; updatedAt: string; state: 'editing' | 'sending' | 'confirmation_unknown'; values: ActivityDraftValues };
export const activityDraftKey = (scope: LocalScope, kind: ActivityDraft['kind']) => `local_activity_draft_v1:${localScopeKey(scope)}:${kind}`;
export function validDraftValues(v: any): v is ActivityDraftValues {
  return v && typeof v.startTime === 'string' && Number.isFinite(Date.parse(v.startTime)) && (v.endTime === null || typeof v.endTime === 'string' && Number.isFinite(Date.parse(v.endTime)))
    && typeof v.isEndTimeVisible === 'boolean' && typeof v.notes === 'string' && typeof v.volumeMl === 'number' && Number.isFinite(v.volumeMl)
    && ['wet','dirty','both'].includes(v.diaperType) && ['selectedDiaperItemId','selectedFormulaItemId'].every(key => v[key] === null || typeof v[key] === 'string')
    && ['diaperFeverMeasured','diaperSuppositoryGiven'].every(key => typeof v[key] === 'boolean')
    && ['diaperTemperatureC','diaperSuppositoryDoseMg'].every(key => typeof v[key] === 'string');
}
export async function readActivityDraft(scope: LocalScope, kind: ActivityDraft['kind']): Promise<{ draft: ActivityDraft | null; corrupt: boolean }> {
  const generation = localHealthGeneration();
  if (!localHealthAllowed(scope.userId, generation)) return { draft: null, corrupt: false };
  const raw = await AsyncStorage.getItem(activityDraftKey(scope, kind));
  if (!raw || !localHealthAllowed(scope.userId, generation)) return { draft: null, corrupt: false };
  try {
    const v = JSON.parse(raw);
    if (v.schemaVersion !== 1 || typeof v.id !== 'string' || !Number.isInteger(v.revision) || v.revision < 1
      || localScopeKey(v.scope) !== localScopeKey(scope) || v.kind !== kind || !Number.isFinite(Date.parse(v.createdAt)) || !Number.isFinite(Date.parse(v.updatedAt))
      || !['editing','sending','confirmation_unknown'].includes(v.state) || !validDraftValues(v.values)) throw new Error();
    if (v.state === 'sending') v.state = 'confirmation_unknown';
    return { draft: v, corrupt: false };
  } catch { return { draft: null, corrupt: true }; }
}
export async function persistActivityDraft(scope: LocalScope, kind: ActivityDraft['kind'], values: ActivityDraftValues, previous: ActivityDraft | null,
  state: ActivityDraft['state'] = 'editing', generation = localHealthGeneration()): Promise<ActivityDraft> {
  const at = new Date().toISOString();
  const draft: ActivityDraft = { schemaVersion: 1, id: previous?.id ?? randomUUID(), revision: (previous?.revision ?? 0) + 1,
    scope, kind, values, state, createdAt: previous?.createdAt ?? at, updatedAt: at };
  return serializeLocalHealth(activityDraftKey(scope, kind), async () => {
    if (!localHealthAllowed(scope.userId, generation)) throw new Error('Local scope unavailable');
    const raw = await AsyncStorage.getItem(activityDraftKey(scope, kind));
    if (raw) {
      let current; try { current = JSON.parse(raw); } catch { throw new Error('Unreadable draft'); }
      if (current.id !== previous?.id || current.revision !== previous?.revision) throw new Error('Draft changed');
    } else if (previous) throw new Error('Draft removed');
    await AsyncStorage.setItem(activityDraftKey(scope, kind), JSON.stringify(draft));
    if (!localHealthAllowed(scope.userId, generation)) throw new Error('Local scope unavailable');
    notifyLocalHealth(); return draft;
  });
}
export async function removeActivityDraft(scope: LocalScope, kind: ActivityDraft['kind'], expected?: Pick<ActivityDraft, 'id' | 'revision'>) {
  const generation = localHealthGeneration(); const key = activityDraftKey(scope, kind);
  await serializeLocalHealth(key, async () => {
    if (!localHealthAllowed(scope.userId, generation)) return;
    if (expected) { const raw = await AsyncStorage.getItem(key); if (!raw) return; const value = JSON.parse(raw); if (value.id !== expected.id || value.revision !== expected.revision) return; }
    await AsyncStorage.removeItem(key); notifyLocalHealth();
  });
}
const owners = new Map<string, symbol>();
export function claimActivityDraft(key: string) {
  if (owners.has(key)) return null;
  const token = Symbol(); owners.set(key, token);
  return () => { if (owners.get(key) === token) owners.delete(key); };
}
