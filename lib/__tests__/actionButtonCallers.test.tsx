import React from 'react';
import { Alert, Modal, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import CustomActivityEntryModal from '@/components/CustomActivityEntryModal';
import CustomActivityDefinitionModal from '@/components/CustomActivityDefinitionModal';
import TextInputOverlay from '@/components/modals/TextInputOverlay';

jest.mock('@/contexts/LocaleContext', () => ({
  useLocale: () => ({ locale: 'de' }),
}));
jest.mock('@/hooks/useAdaptiveColors', () => ({
  useAdaptiveColors: () => ({
    effectiveScheme: 'light',
    isDarkBackground: false,
  }),
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('@/components/ui/glass-sheet-surface', () => ({
  GlassSheetSurface: jest.requireActual('react-native').View,
}));
jest.mock(
  '@/components/ui/DateTimePicker',
  () => jest.requireActual('react-native').View,
);

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));
const button = (label: string) =>
  tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === 'button' &&
      node.props.accessibilityLabel === label &&
      typeof node.props.style === 'function',
  )[0];

it('passes the edited overlay value only on confirmation, retaining custom submit text', () => {
  const onSubmit = jest.fn();
  const onClose = jest.fn();
  act(() => {
    tree = create(
      <TextInputOverlay
        visible
        label="Notiz"
        value="alt"
        submitLabel="Übernehmen"
        accentColor="#FFFFFF"
        onSubmit={onSubmit}
        onClose={onClose}
      />,
    );
  });
  act(() => tree.root.findByType(TextInput).props.onChangeText('neu'));
  act(() => button('Abbrechen').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onSubmit).not.toHaveBeenCalled();
  act(() => button('Übernehmen').props.onPress());
  expect(onSubmit).toHaveBeenCalledWith('neu');
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(onClose).toHaveBeenCalledTimes(2);
});

it('retains the activity entry draft after a failed save and closes only after success', async () => {
  const onClose = jest.fn();
  let finish!: (saved: boolean) => void;
  const onSave = jest
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve;
        }),
    )
    .mockResolvedValueOnce(true);
  const definition = {
    name: 'Baden',
    emoji: '🛁',
    color: '#F5A623',
    tracking_mode: 'event' as const,
    unit: null,
    default_quantity: null,
  };
  act(() => {
    tree = create(
      <CustomActivityEntryModal
        visible
        definition={definition}
        date={new Date('2026-10-12T12:00:00Z')}
        onClose={onClose}
        onSave={onSave}
      />,
    );
  });
  act(() => tree.root.findByType(TextInput).props.onChangeText('Entwurf'));
  let pending!: Promise<void>;
  act(() => {
    pending = button('Speichern').props.onPress();
  });
  expect(button('Speichern').props.accessibilityState.busy).toBe(true);
  expect(button('Abbrechen').props.disabled).toBe(true);
  act(() => button('Speichern').props.onPress());
  expect(onSave).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish(false);
    await pending;
  });
  expect(onClose).not.toHaveBeenCalled();
  expect(tree.root.findByType(TextInput).props.value).toBe('Entwurf');
  await act(async () => {
    await button('Speichern').props.onPress();
  });
  expect(onSave).toHaveBeenLastCalledWith(
    expect.objectContaining({ notes: 'Entwurf', custom_quantity: null }),
    { startTimer: false },
  );
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('keeps the chosen feature color in the definition while saving through the shared primary action', async () => {
  const onSave = jest.fn().mockResolvedValue(false);
  const onClose = jest.fn();
  act(() => {
    tree = create(
      <CustomActivityDefinitionModal
        visible
        onSave={onSave}
        onClose={onClose}
      />,
    );
  });
  const name = tree.root.findAllByType(TextInput)[0];
  act(() => name.props.onChangeText('Baden'));
  const colorButton = tree.root.findAll(
    (node) => node.props.accessibilityLabel === '#F5A623' && node.props.onPress,
  )[0];
  act(() => colorButton.props.onPress());
  await act(async () => {
    await button('Speichern').props.onPress();
  });
  expect(onSave).toHaveBeenCalledWith(
    expect.objectContaining({ name: 'Baden', color: '#F5A623' }),
  );
  expect(onClose).not.toHaveBeenCalled();
  expect(tree.root.findAllByType(TextInput)[0].props.value).toBe('Baden');
});

it('keeps cancelling an existing activity separate from the confirmed archive action', async () => {
  const onClose = jest.fn(), onArchive = jest.fn().mockResolvedValue(true);
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const initialValue = { id: 'activity-1', name: 'Baden', emoji: '🛁', color: '#F5A623',
    tracking_mode: 'event', unit: null, default_quantity: null } as
    NonNullable<React.ComponentProps<typeof CustomActivityDefinitionModal>['initialValue']>;
  act(() => { tree = create(<CustomActivityDefinitionModal visible initialValue={initialValue}
    onSave={jest.fn()} onArchive={onArchive} onClose={onClose} />); });
  act(() => button('Abbrechen').props.onPress());
  expect(onClose).toHaveBeenCalledTimes(1); expect(onArchive).not.toHaveBeenCalled();
  onClose.mockClear();
  act(() => button('Ausblenden').props.onPress());
  expect(onArchive).not.toHaveBeenCalled();
  const confirm = alert.mock.calls.at(-1)![2]!.find(choice => choice.style === 'destructive')!;
  await act(async () => { await confirm.onPress?.(); });
  expect(onArchive).toHaveBeenCalledTimes(1); expect(onClose).toHaveBeenCalledTimes(1);
  alert.mockRestore();
});
