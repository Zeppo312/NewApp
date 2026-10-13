import React from 'react';
import { Platform, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import NativeDateTimePicker, { DateTimePickerAndroid, type AndroidNativeProps } from '@react-native-community/datetimepicker';
import { SleepSyncConflictModal } from '@/components/SleepSyncConflictModal';
import { editPendingSleepStop } from '../sleepOfflineRecovery';
import type { PendingSleepStop } from '../sleepOfflineActions';
jest.mock('@react-native-community/datetimepicker', () => ({ __esModule: true, default: 'NativeDateTimePicker', DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn().mockResolvedValue(true) } }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('../sleepOfflineRecovery', () => ({ editPendingSleepStop: jest.fn(async () => {}), decideSleepStop: jest.fn() }));
const originalOS = Platform.OS;
const start = new Date(2026, 9, 8, 8);
const action: PendingSleepStop = {
  schemaVersion: 1, operationId: 'op', localRevision: 1, scope: { backendHost: 'fixture', userId: 'a', babyId: 'baby' }, originalEntryId: 'original',
  baseEntry: { canWrite: true, scopeRevision: '1', verifiedAt: start.toISOString(), entry: { id: 'original', user_id: 'a', baby_id: 'baby', start_time: start.toISOString(), end_time: null, duration_minutes: null, quality: null, notes: null, partner_id: null, shared_with_user_id: null, updated_by: null, sync_revision: '1' } },
  originalStopAt: new Date(2026, 9, 8, 9).toISOString(), chosenStopAt: new Date(2026, 9, 8, 9).toISOString(), proposedQuality: null, proposedNotes: null, reconcilePolicy: 'ask_always', state: 'needs_decision',
};
let tree: ReactTestRenderer;
const button = (label: string) => tree.root.findAllByType(TouchableOpacity).find(node => JSON.stringify(node.findAllByType(Text).map(text => text.props.children)).includes(label))!;
const opens = DateTimePickerAndroid.open as jest.Mock;
const dialog = (): AndroidNativeProps => opens.mock.calls[opens.mock.calls.length - 1][0];
const select = (date: Date) => act(() => dialog().onValueChange?.({ nativeEvent: { timestamp: date.getTime(), utcOffset: -date.getTimezoneOffset() } }, date));
beforeEach(() => { jest.clearAllMocks(); });
afterEach(() => { act(() => tree.unmount()); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });
it('Android commits date and time together only after explicit confirmation', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  act(() => { tree = create(<SleepSyncConflictModal action={action} onClose={jest.fn()} />); });
  act(() => button('Stoppzeit korrigieren').props.onPress());
  select(new Date(2026, 9, 9));
  expect(dialog().mode).toBe('time'); expect(editPendingSleepStop).not.toHaveBeenCalled();
  select(new Date(2000, 0, 1, 10, 45));
  expect(editPendingSleepStop).not.toHaveBeenCalled();
  await act(async () => { button('Korrigierte Stoppzeit sichern').props.onPress(); });
  expect(editPendingSleepStop).toHaveBeenCalledTimes(1);
  expect(editPendingSleepStop).toHaveBeenCalledWith(action, { chosenStopAt: new Date(2026, 9, 9, 10, 45).toISOString(), reconcilePolicy: 'ask_always' });
});
it.each(['date', 'time'])('Android cancel in the %s step never changes the journal', step => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
  act(() => { tree = create(<SleepSyncConflictModal action={action} onClose={jest.fn()} />); });
  act(() => button('Stoppzeit korrigieren').props.onPress());
  if (step === 'time') select(new Date(2026, 9, 9));
  act(() => dialog().onDismiss?.());
  expect(editPendingSleepStop).not.toHaveBeenCalled(); expect(button('Korrigierte Stoppzeit sichern')).toBeUndefined();
});
it('iOS keeps inline date/time edits open and persists the final selected time once', async () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  act(() => { tree = create(<SleepSyncConflictModal action={action} onClose={jest.fn()} />); });
  act(() => button('Stoppzeit korrigieren').props.onPress());
  const final = new Date(2026, 9, 8, 10, 45);
  act(() => tree.root.findByType(NativeDateTimePicker).props.onChange({ type: 'set' }, new Date(2026, 9, 8, 10, 30)));
  act(() => tree.root.findByType(NativeDateTimePicker).props.onChange({ type: 'set' }, final));
  expect(editPendingSleepStop).not.toHaveBeenCalled(); expect(opens).not.toHaveBeenCalled();
  await act(async () => { button('Korrigierte Stoppzeit sichern').props.onPress(); });
  expect(editPendingSleepStop).toHaveBeenCalledTimes(1);
  expect(editPendingSleepStop).toHaveBeenCalledWith(action, { chosenStopAt: final.toISOString(), reconcilePolicy: 'ask_always' });
});
