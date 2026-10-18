import {FormField} from '@/components/ui/form-sheet';
import React from 'react';
import { Alert, Modal, Text, TouchableOpacity } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { PlannerCaptureModal } from '@/components/planner/PlannerCaptureModal';
import { FloatingAddButton } from '@/components/planner/FloatingAddButton';
import IOSBottomDatePicker from '@/components/modals/IOSBottomDatePicker';
import TextInputOverlay from '@/components/modals/TextInputOverlay';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { DialogActions } from '@/components/ui/dialog-actions';
import type { PlannerTodo, PlannerEvent } from '@/services/planner';

jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', isDarkBackground: false, accent: '#5E3DB3' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('@/components/ui/DateTimePicker', () => ({ __esModule: true, default: jest.fn(() => null) }));

const baseDate = new Date('2026-10-12T12:00:00Z');
let tree: ReactTestRenderer;
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); });
const button = (label: string) => tree.root.findAll(node => node.props.accessibilityRole === 'button'
  && node.props.accessibilityLabel === label && typeof node.props.style === 'function')[0];
const tapField = (label: string) => {
  const field = [...tree.root.findAllByType(FormField), ...tree.root.findAllByType(TouchableOpacity)].find(node =>
    node.findAllByType(Text).some(text => text.props.children === label));
  if (!field) throw new Error('Field missing: ' + label);
  act(() => field.props.onPress());
};
const setup = (props: Partial<React.ComponentProps<typeof PlannerCaptureModal>> = {}) => {
  const onSave = jest.fn(); const onClose = jest.fn(); const onDelete = jest.fn();
  act(() => { tree = create(<PlannerCaptureModal visible type="todo" baseDate={baseDate}
    defaultOwnerId="parent" onSave={onSave} onClose={onClose} onDelete={onDelete} {...props} />); });
  return { onSave, onClose, onDelete };
};
const todo: PlannerTodo = { id: 'todo-1', userId: 'parent', title: 'Baden', completed: false,
  dueAt: baseDate.toISOString(), assignee: 'child', babyId: 'baby-1', color: '#D65A74', notes: 'Handtuch' };

it('blocks an empty save and keeps cancel separate from submitting the trimmed task', () => {
  const { onSave, onClose } = setup();
  expect(button('Speichern').props.disabled).toBe(true);
  act(() => button('Speichern').props.onPress());
  expect(onSave).not.toHaveBeenCalled();
  tapField('Titel');
  act(() => tree.root.findByType(TextInputOverlay).props.onSubmit('  Kinderarzt anrufen  '));
  expect(button('Speichern').props.disabled).toBe(false);
  act(() => button('Abbrechen').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSave).not.toHaveBeenCalled();
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: 'todo', title: 'Kinderarzt anrufen', dueAt: null, ownerId: 'parent', assignee: 'me' }));
});

it('commits the date picker draft only on confirmation and can clear the task date', () => {
  const { onSave } = setup({ editingItem: { type: 'todo', item: todo } });
  act(() => button('Kein Datum setzen').props.onPress());
  act(() => button('Datum hinzufügen').props.onPress());
  const picker = tree.root.findAllByType(IOSBottomDatePicker).find(node => node.props.visible)!;
  const selected = new Date('2026-10-14T14:30:00Z');
  act(() => picker.findByType(DateTimePicker).props.onChange({ type: 'set' }, selected));
  expect(onSave).not.toHaveBeenCalled();
  act(() => button('Fertig').props.onPress());
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ id: todo.id, dueAt: selected, babyId: 'baby-1', color: todo.color!.toLowerCase(), notes: 'Handtuch' }));
  act(() => button('Kein Datum setzen').props.onPress());
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenLastCalledWith(expect.objectContaining({ dueAt: null }));
});

it('applies the chosen time period without saving the event and retains its other details', () => {
  const item: PlannerEvent & { notes: string } = { id: 'event-1', userId: 'parent', title: 'Kinderarzt', start: baseDate.toISOString(),
    end: new Date(baseDate.getTime() + 3600000).toISOString(), location: 'Praxis', notes: 'Impfpass', reminderMinutes: 60, color: '#D65A74', assignee: 'me' };
  const { onSave, onClose } = setup({ type: 'event', editingItem: { type: 'event', item } });
  const period = tree.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text)
    .some(text => typeof text.props.children === 'string' && text.props.children.includes('–')))!;
  act(() => period.props.onPress());
  const endPicker = tree.root.findAllByType(IOSBottomDatePicker).find(node => node.props.title === 'Ende')!;
  act(() => endPicker.props.onConfirm(new Date(item.end)));
  expect(button('Zeitraum übernehmen')).toBeDefined();
  act(() => button('Zeitraum übernehmen').props.onPress());
  expect(tree.root.findAllByType(Modal).filter(node => node.props.visible)).toHaveLength(1);
  expect(onSave).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: item.id, type: 'event', start: baseDate,
    end: new Date(item.end), location: 'Praxis', notes: 'Impfpass', reminderMinutes: 60, color: item.color!.toLowerCase() }));
});

const recurring: PlannerTodo = { ...todo, isRecurring: true, seriesId: 'series-1', occurrenceDate: '2026-10-12', repeatDays: [1, 2, 3, 4, 5] };
it('keeps recurring saves behind the occurrence-or-series confirmation and locks the required time', () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const { onSave, onClose } = setup({ editingItem: { type: 'todo', item: recurring } });
  expect(button('Zeit erforderlich').props.disabled).toBe(true);
  act(() => button('Zeit erforderlich').props.onPress());
  act(() => button('Speichern').props.onPress());
  expect(onSave).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  const choices = alert.mock.calls.at(-1)![2]!;
  expect(choices.map(choice => choice.text)).toEqual(['Abbrechen', 'Nur diesen Tag', 'Gesamte Serie']);
  act(() => choices[1].onPress?.());
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ dueAt: baseDate, repeatEnabled: true,
    repeatDays: recurring.repeatDays, editScope: 'occurrence', recurringSeriesId: 'series-1', recurringOccurrenceDate: '2026-10-12' }));
});

it.each([['Nur diesen Tag löschen', 'exclude:series-1:2026-10-12'], ['Alle Wiederholungen löschen', 'delete-series:series-1']])(
  'deletes recurring entries only after choosing %s', (label, expected) => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { onDelete, onClose } = setup({ editingItem: { type: 'todo', item: recurring } });
    act(() => button('🗑️ Eintrag löschen').props.onPress());
    expect(onDelete).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
    const choice = alert.mock.calls.at(-1)![2]!.find(entry => entry.text === label)!;
    act(() => choice.onPress?.());
    expect(onDelete).toHaveBeenCalledWith(expected); expect(onClose).toHaveBeenCalledTimes(1);
  },
);

it('retains custom picker labels, bounds, and cancel without committing the draft', () => {
  const onConfirm = jest.fn(); const onClose = jest.fn();
  const maximumDate = new Date('2026-10-13T12:00:00Z');
  act(() => { tree = create(<IOSBottomDatePicker visible title="Datum" value={baseDate} maximumDate={maximumDate}
    confirmLabel="Übernehmen" cancelLabel="Zurück" onClose={onClose} onConfirm={onConfirm} />); });
  act(() => tree.root.findByType(DateTimePicker).props.onChange({}, new Date('2026-11-01T12:00:00Z')));
  act(() => button('Zurück').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1); expect(onConfirm).not.toHaveBeenCalled();
  act(() => button('Übernehmen').props.onPress());
  expect(onConfirm).toHaveBeenCalledWith(maximumDate);
});

it('keeps the quick-add callback and accessible name on the restored round plus action', () => {
  const onPress = jest.fn();
  act(() => { tree = create(<FloatingAddButton onPress={onPress} bottomInset={30} />); });
  act(() => button('Schnell hinzufügen').props.onPress());
  expect(onPress).toHaveBeenCalledTimes(1);
});

it('restores the previous period on cancel and keeps explicit confirmation in the bottom actions', () => {
  const item: PlannerEvent = { id: 'event-2', title: 'Spaziergang', start: baseDate.toISOString(),
    end: new Date(baseDate.getTime() + 1800000).toISOString() };
  const { onSave, onClose } = setup({ type: 'event', editingItem: { type: 'event', item } });
  const openPeriod = () => {
    const period = tree.root.findAllByType(TouchableOpacity).find(node => node.findAllByType(Text)
      .some(text => typeof text.props.children === 'string' && text.props.children.includes('–')))!;
    act(() => period.props.onPress());
  };
  openPeriod();
  const end = () => tree.root.findAllByType(IOSBottomDatePicker).find(node => node.props.title === 'Ende')!;
  // Establish a valid selected end, independent of the modal's current-clock default.
  const previous = new Date(item.end);
  act(() => end().props.onConfirm(previous));
  act(() => button('Zeitraum übernehmen').props.onPress());
  openPeriod();
  expect(end().props.value).toEqual(previous);
  act(() => end().props.onConfirm(new Date(baseDate.getTime() + 7200000)));
  const periodActions = tree.root.findAllByType(DialogActions).find(node => node.props.confirmLabel === 'Zeitraum übernehmen')!;
  act(() => periodActions.findAll(node => node.props.accessibilityLabel === 'Abbrechen'
    && typeof node.props.style === 'function')[0].props.onPress());
  expect(onSave).not.toHaveBeenCalled(); expect(onClose).not.toHaveBeenCalled();
  openPeriod();
  expect(end().props.value).toEqual(previous);
  act(() => button('Zeitraum übernehmen').props.onPress());
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ end: previous }));
});
