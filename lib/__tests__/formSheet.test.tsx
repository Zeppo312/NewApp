import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { FormSheet } from '@/components/ui/form-sheet';
import { DialogActions } from '@/components/ui/dialog-actions';
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
  useSafeAreaInsets: () => ({ top: 47, bottom: 34, left: 0, right: 0 }),
}));
jest.mock('expo-blur', () => ({
  BlurView: jest.requireActual('react-native').View,
}));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));

it('guards native dismiss, backdrop, header close and both footer actions while saving', () => {
  const close = jest.fn(),
    confirm = jest.fn();
  act(() => {
    tree = create(
      <FormSheet
        visible
        title="Gewicht"
        isDark={false}
        busy
        onClose={close}
        onConfirm={confirm}
      >
        <TextInput />
      </FormSheet>,
    );
  });
  act(() => {
    tree.root.findByType(Modal).props.onRequestClose();
    tree.root
      .findAllByType(Pressable)
      .forEach((node) => node.props.onPress?.());
  });
  expect(close).not.toHaveBeenCalled();
  expect(confirm).not.toHaveBeenCalled();
});

it('keeps the footer outside scrolling content and removes nested editors when the parent closes', () => {
  const render = (visible: boolean) => (
    <FormSheet
      visible={visible}
      title="Notizen"
      isDark
      onClose={() => {}}
      onConfirm={() => {}}
      overlays={
        <Modal visible>
          <TextInput testID="nested" />
        </Modal>
      }
    >
      <TextInput testID="body" />
    </FormSheet>
  );
  act(() => {
    tree = create(render(true));
  });
  const footer = tree.root.findByType(DialogActions);
  for (let parent = footer.parent; parent; parent = parent.parent)
    expect(parent.type).not.toBe(ScrollView);
  expect(tree.root.findAllByType(TextInput)).toHaveLength(2);
  act(() => tree.update(render(false)));
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
});

it('keeps the focused text field mounted when the caller receives each draft keystroke', () => {
  const submit = jest.fn();
  function Parent() {
    const [value, setValue] = useState('alt');
    return (
      <TextInputOverlay
        visible
        label="Notiz"
        value={value}
        onChangeText={setValue}
        onClose={() => {}}
        onSubmit={submit}
      />
    );
  }
  act(() => {
    tree = create(<Parent />);
  });
  const input = tree.root.findByType(TextInput);
  act(() => input.props.onChangeText('neu'));
  expect(tree.root.findByType(TextInput)).toBe(input);
  expect(input.props.value).toBe('neu');
  expect(submit).not.toHaveBeenCalled();
  act(() => tree.root.findByType(DialogActions).props.onConfirm());
  expect(submit).toHaveBeenCalledWith('neu');
});
