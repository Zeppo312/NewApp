import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, Text, TouchableOpacity } from 'react-native';
import { LinkedBabySelectionModal } from '@/components/LinkedBabySelectionModal';

const mockOptions = jest.fn();
jest.mock('@/lib/baby', () => ({ getLinkedBabySelectionOptions: (...args: any[]) => mockOptions(...args), applyLinkedBabySelection: jest.fn() }));
jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/ThemedText', () => ({ ThemedText: jest.requireActual('react-native').Text }));

it('requires a successful retry instead of treating failed loading as an empty baby list', async () => {
  const onApplied = jest.fn();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const error = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockOptions.mockResolvedValueOnce({ data: null, error: new Error('offline') })
    .mockResolvedValueOnce({ data: [], error: null });
  let tree!: ReactTestRenderer;
  try {
    await act(async () => { tree = create(<LinkedBabySelectionModal visible currentUserId="invited" linkedUserId="parent" onApplied={onApplied} />); });
    expect(onApplied).not.toHaveBeenCalled();
    const buttons = tree.root.findAllByType(TouchableOpacity);
    expect(buttons).toHaveLength(1);
    expect(buttons[0].findAllByType(Text).some(node => node.props.children === 'Erneut versuchen')).toBe(true);
    await act(async () => { buttons[0].props.onPress(); });
    expect(mockOptions).toHaveBeenCalledTimes(2);
    expect(onApplied).not.toHaveBeenCalled();
    await act(async () => { tree.root.findByType(TouchableOpacity).props.onPress(); });
    expect(onApplied).toHaveBeenCalledTimes(1);
  } finally {
    act(() => tree?.unmount()); alert.mockRestore(); error.mockRestore();
  }
});
