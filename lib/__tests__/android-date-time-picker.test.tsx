import React from 'react';
import { Platform } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import NativeDateTimePicker, { DateTimePickerAndroid, type AndroidNativeProps } from '@react-native-community/datetimepicker';
import DateTimePicker from '@/components/ui/DateTimePicker';

jest.mock('@react-native-community/datetimepicker', () => ({
  __esModule: true,
  default: 'NativeDateTimePicker',
  DateTimePickerAndroid: { open: jest.fn(), dismiss: jest.fn().mockResolvedValue(true) },
}));

const originalOS = Platform.OS;
const initial = new Date(2026, 8, 10, 10, 15, 0, 0);
const onChange = jest.fn();
let tree: ReactTestRenderer;
const opens = DateTimePickerAndroid.open as jest.Mock;
const dialog = (): AndroidNativeProps => opens.mock.calls[opens.mock.calls.length - 1][0];
const select = (date: Date) => act(() => dialog().onValueChange?.({
  nativeEvent: { timestamp: date.getTime(), utcOffset: -date.getTimezoneOffset() },
}, date));
const render = (props: Partial<React.ComponentProps<typeof DateTimePicker>> = {}) => {
  act(() => { tree = create(<DateTimePicker value={initial} mode="datetime" onChange={onChange} {...props} />); });
};

beforeEach(() => {
  jest.clearAllMocks();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'android' });
});
afterEach(() => {
  act(() => tree?.unmount());
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
});

it('asks for date then time and commits the combined value exactly once', () => {
  render();
  expect(dialog().mode).toBe('date');
  expect(dialog().onChange).toBeUndefined();
  select(new Date(2026, 8, 12));
  expect(onChange).not.toHaveBeenCalled();
  expect(dialog().mode).toBe('time');
  expect(dialog().value).toEqual(new Date(2026, 8, 12, 10, 15));
  // A native time response must not overwrite the chosen calendar day.
  select(new Date(2000, 0, 1, 14, 30));
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'set' }), new Date(2026, 8, 12, 14, 30));
  expect(opens).toHaveBeenCalledTimes(2);
  act(() => tree.unmount());
  expect(DateTimePickerAndroid.dismiss).not.toHaveBeenCalled();
});

it('does not reopen on parent renders, value updates or changed callbacks', () => {
  render();
  const updatedCallback = jest.fn();
  const update = () => act(() => tree.update(
    <DateTimePicker mode="datetime" value={new Date()} onChange={(...args) => updatedCallback(...args)} />,
  ));
  update(); update();
  expect(opens).toHaveBeenCalledTimes(1);
  select(new Date(2026, 8, 12));
  update();
  expect(opens).toHaveBeenCalledTimes(2);
  select(new Date(2026, 8, 12, 12, 30));
  update();
  expect(opens).toHaveBeenCalledTimes(2);
  expect(updatedCallback).toHaveBeenCalledTimes(1);
  expect(onChange).not.toHaveBeenCalled();
});

it.each(['date', 'time'])('canceling the %s step commits no date and ends the sequence', step => {
  render();
  if (step === 'time') select(new Date(2026, 8, 12));
  act(() => dialog().onDismiss?.());
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'dismissed' }), undefined);
  select(new Date()); // Ignore a late callback from an already dismissed dialog.
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(opens).toHaveBeenCalledTimes(step === 'date' ? 1 : 2);
});

it.each(['date', 'time'])('closing the parent dismisses only the active native %s dialog', step => {
  render();
  if (step === 'time') select(new Date(2026, 8, 12));
  const pending = dialog();
  act(() => tree.unmount());
  expect(DateTimePickerAndroid.dismiss).toHaveBeenCalledWith(step);
  act(() => pending.onValueChange?.({ nativeEvent: { timestamp: initial.getTime(), utcOffset: 0 } }, initial));
  expect(onChange).not.toHaveBeenCalled();
  expect(opens).toHaveBeenCalledTimes(step === 'date' ? 1 : 2);
});

it.each(['date', 'time'] as const)('keeps standalone %s selection to one dialog and allows reopening', mode => {
  render({ mode });
  select(initial);
  expect(onChange).toHaveBeenCalledTimes(1);
  expect(opens).toHaveBeenCalledTimes(1);
  act(() => tree.unmount());
  render({ mode });
  expect(opens).toHaveBeenCalledTimes(2);
});

it('preserves separate date-to-time flows when the caller changes mode', () => {
  render({ mode: 'date' });
  select(initial);
  act(() => tree.update(<DateTimePicker value={initial} mode="time" onChange={onChange} />));
  expect(dialog().mode).toBe('time');
  select(initial);
  expect(onChange).toHaveBeenCalledTimes(2);
});

it('enforces datetime bounds after the time step', () => {
  const maximumDate = new Date(2026, 8, 12, 15);
  render({ minimumDate: initial, maximumDate });
  expect(dialog().minimumDate).toEqual(initial);
  expect(dialog().maximumDate).toEqual(maximumDate);
  select(maximumDate);
  select(new Date(2026, 8, 12, 16));
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'set' }), maximumDate);
});

it('keeps the iOS native picker and its inline updates', () => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  render({ display: 'spinner' });
  const picker = tree.root.findByType(NativeDateTimePicker);
  expect(picker.props.mode).toBe('datetime');
  expect(picker.props.display).toBe('spinner');
  act(() => picker.props.onChange({ type: 'set' }, initial));
  expect(onChange).toHaveBeenCalledWith({ type: 'set' }, initial);
  expect(opens).not.toHaveBeenCalled();
});
