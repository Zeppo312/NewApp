import React from 'react';
import { Platform, type PlatformOSType } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import DateTimePicker from '@/components/ui/DateTimePicker';
import { TimePickerField } from '@/components/SleepQuickAddModal';

jest.mock('@/components/ui/DateTimePicker', () => 'DateTimePicker');
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/constants/DesignGuide', () => ({ RADIUS: 22 }));

const originalOS = Platform.OS;
const props = { label: 'Beginn', time: new Date(2026, 8, 9, 10), accentColor: '#8E4EC6', isDark: false, textPrimary: '#5C4033', textSecondary: '#7D5A50', localeTag: 'de-DE', cancelLabel: 'Abbrechen', doneLabel: 'Fertig', tapLabel: 'Zeit auswählen' };
describe('shared sleep/caretaker time picker on Android', () => {
  let tree: ReactTestRenderer;
  const onConfirm = jest.fn();
  beforeEach(() => { Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' as PlatformOSType }); onConfirm.mockClear(); });
  afterEach(() => { act(() => tree.unmount()); Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS }); });
  async function open() {
    await act(async () => { tree = create(<TimePickerField {...props} onConfirm={onConfirm} />); });
    const button = tree.root.findAll(
      node => node.props.accessibilityRole === 'button' && typeof node.props.onPress === 'function',
    )[0];
    act(() => button.props.onPress());
  }
  it('chooses date first, then time, and confirms only after both', async () => {
    await open();
    expect(tree.root.findByType(DateTimePicker).props.mode).toBe('date');
    const day = new Date(2026, 8, 12, 10);
    act(() => tree.root.findByType(DateTimePicker).props.onChange({ type: 'set' }, day));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(tree.root.findByType(DateTimePicker).props.mode).toBe('time');
    expect(tree.root.findByType(DateTimePicker).props.value).toEqual(day);
    const time = new Date(2026, 8, 12, 14, 30);
    act(() => tree.root.findByType(DateTimePicker).props.onChange({ type: 'set' }, time));
    expect(onConfirm).toHaveBeenCalledWith(time);
    expect(tree.root.findAllByType(DateTimePicker)).toHaveLength(0);
  });
  it('canceling time selection preserves the previously committed value', async () => {
    await open();
    act(() => tree.root.findByType(DateTimePicker).props.onChange({ type: 'set' }, new Date(2026, 8, 12)));
    act(() => tree.root.findByType(DateTimePicker).props.onChange({ type: 'dismissed' }, props.time));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(tree.root.findAllByType(DateTimePicker)).toHaveLength(0);
  });
});
