import {FormSheet, FormSection, FormField} from '@/components/ui/form-sheet';
import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, TouchableWithoutFeedback, View } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { DialogActions } from '@/components/ui/dialog-actions';
import { TimePickerField } from '@/components/SleepQuickAddModal';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { translateGrowthTrackerText } from '@/lib/growthTrackerTranslations';

jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', isDarkBackground: false }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 34, left: 0, right: 0 }) }));
jest.mock('expo-blur', () => ({ BlurView: jest.requireActual('react-native').View }));
jest.mock('@/components/ui/DateTimePicker', () => ({ __esModule: true, default: jest.fn(() => null) }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));
const button = (label: string) => tree.root.findAll(node => node.props.accessibilityLabel === label
  && node.props.accessibilityRole === 'button' && typeof node.props.style === 'function')[0];

it('preserves the asynchronous callback and blocks both actions during a pending save', async () => {
  let finish!: () => void;
  const onConfirm = jest.fn(() => new Promise<void>(resolve => { finish = resolve; }));
  const onCancel = jest.fn();
  const render = (busy = false) => <DialogActions busy={busy} onCancel={onCancel} onConfirm={onConfirm} />;
  act(() => { tree = create(render()); });
  let pending!: Promise<void>;
  act(() => { pending = button('Speichern').props.onPress(); tree.update(render(true)); });
  expect(button('Speichern').props.accessibilityState.busy).toBe(true);
  act(() => { button('Speichern').props.onPress(); button('Abbrechen').props.onPress(); });
  expect(onConfirm).toHaveBeenCalledTimes(1); expect(onCancel).not.toHaveBeenCalled();
  await act(async () => { finish(); await pending; tree.update(render()); });
  act(() => button('Abbrechen').props.onPress());
  expect(onCancel).toHaveBeenCalledTimes(1);
});

it('keeps read-only confirmation disabled while leaving cancel available', () => {
  const onConfirm = jest.fn(); const onCancel = jest.fn();
  act(() => { tree = create(<DialogActions confirmDisabled onConfirm={onConfirm} onCancel={onCancel} />); });
  act(() => { button('Speichern').props.onPress(); button('Abbrechen').props.onPress(); });
  expect(onConfirm).not.toHaveBeenCalled(); expect(onCancel).toHaveBeenCalledTimes(1);
});

// Execute the actual growth modal JSX with fixture data, without loading chart/auth providers.
function growthForm(kind: 'weight' | 'size', overrides: Record<string, unknown> = {}) {
  const file = join(__dirname, `../../app/(tabs)/${kind}-tracker.tsx`);
  const ast = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let form: ts.VariableDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'renderWeightCaptureModal') form = node;
    ts.forEachChild(node, visit);
  }
  visit(ast);
  if (!form) throw new Error('Growth capture form missing');
  const jsx = ts.transpileModule(`const ${form.getText(ast)}; renderWeightCaptureModal;`, {
    compilerOptions: { jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  const onSave = jest.fn(); const onClose = jest.fn();
  const values = { React, Modal, ScrollView, Text, TouchableOpacity, TouchableWithoutFeedback, View, StyleSheet,
    DialogActions, FormSheet, FormSection, FormField, BlurView: View, TextInputOverlay: () => null, IOSBottomDatePicker: () => null, DateTimePicker,
    Platform: { OS: 'ios' }, styles: {}, isDark: false, insets: { bottom: 34 }, headerTextColor: '#5C4033', localeTag: 'de-DE',
    weightModalVisible: true, isSaving: false, isReadOnlyPreviewMode: false, editingEntry: { id: 'entry-1' },
    weightInput: kind === 'weight' ? '3200' : '68', weightNotes: 'Zuhause', weightDate: new Date('2026-10-12T12:00:00Z'),
    weightModalSubject: 'baby', babyLabel: 'Levi', subjectLabels: { mom: 'Ich', baby: 'Levi' },
    SUBJECT_OPTIONS: ['mom', 'baby'], PLANNER_PRIMARY: '#5E3DB3',
    getWeightUnit: () => kind === 'weight' ? 'g' : 'cm', getSubjectLabel: () => 'Levi', showDatePicker: false,
    formatDisplayDate: () => '12.10.2026', MIN_VALID_TRACKER_DATE: new Date(2000, 0, 1),
    focusConfig: null, focusValue: '', closeFocusEditor: jest.fn(), saveFocusEditor: jest.fn(),
    setWeightModalSubject: jest.fn(), setShowDatePicker: jest.fn(), setWeightDate: jest.fn(), openFocusEditor: jest.fn(),
    t: (key: Parameters<typeof translateGrowthTrackerText>[1], vars?: Record<string, string>) => translateGrowthTrackerText('de', key, vars),
    closeWeightModal: onClose, handleSaveWeightEntry: onSave, ...overrides };
  const render = runInNewContext(jsx, values, { filename: file }) as () => React.ReactElement;
  return { render, onSave, onClose };
}

it.each(['weight', 'size'] as const)('%s add/edit form submits through the bottom action and keeps cancel separate', kind => {
  const { render, onSave, onClose } = growthForm(kind);
  act(() => { tree = create(render()); });
  expect(tree.root.findAllByType(Text).some(node => node.props.children === '✓')).toBe(false);
  const actions = tree.root.findByType(DialogActions);
  for (let parent = actions.parent; parent; parent = parent.parent) expect(parent.type).not.toBe(ScrollView);
  expect(actions.parent?.findAllByType(ScrollView)).toHaveLength(1);
  act(() => button('Abbrechen').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1); expect(onSave).not.toHaveBeenCalled();
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenCalledTimes(1);
});

it.each(['weight', 'size'] as const)('%s preview cannot submit and an empty value remains unsaved', kind => {
  const preview = growthForm(kind, { isReadOnlyPreviewMode: true });
  act(() => { tree = create(preview.render()); });
  act(() => button('Speichern').props.onPress());
  expect(preview.onSave).not.toHaveBeenCalled();
  const empty = growthForm(kind, { weightInput: '' });
  act(() => tree.update(empty.render()));
  act(() => button('Speichern').props.onPress());
  expect(empty.onSave).not.toHaveBeenCalled();
});

it('keeps sleep picker changes as a draft when cancelled or dismissed, and confirms only from the footer', () => {
  const onConfirm = jest.fn(); const original = new Date('2026-10-12T12:00:00Z');
  act(() => { tree = create(<TimePickerField label="Start" time={original} onConfirm={onConfirm}
    accentColor="#8E4EC6" isDark={false} textPrimary="#5C4033" textSecondary="#7D5A50"
    localeTag="de-DE" cancelLabel="Abbrechen" doneLabel="Fertig" tapLabel="Wählen" />); });
  const open = () => act(() => tree.root.findAllByType(FormField).find(node => node.props.label === 'Start')!.props.onPress());
  const change = () => act(() => tree.root.findByType(DateTimePicker).props.onChange({}, new Date('2026-10-12T14:00:00Z')));
  open(); change();
  act(() => button('Abbrechen').props.onPress()); expect(onConfirm).not.toHaveBeenCalled();
  open(); change();
  act(() => tree.root.findByType(Modal).props.onRequestClose()); expect(onConfirm).not.toHaveBeenCalled();
  open();
  expect(tree.root.findByType(DateTimePicker).props.value).toEqual(original);
  change(); act(() => button('Fertig').props.onPress());
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(onConfirm).toHaveBeenCalledWith(new Date('2026-10-12T14:00:00Z'));
});
