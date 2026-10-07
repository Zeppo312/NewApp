import React from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { usePregnancyAge } from '../../hooks/use-pregnancy-age';

jest.mock('expo-router', () => {
  const mockReact = jest.requireActual<typeof React>('react');
  return { useFocusEffect: (callback: () => void) => mockReact.useEffect(callback, [callback]) };
});
function Probe({ due }: { due: unknown }) { return <Text testID="age">{JSON.stringify(usePregnancyAge(due))}</Text>; }
let tree: ReactTestRenderer;
const currentAge = () => JSON.parse(tree.root.findByProps({ testID: 'age' }).props.children);
let active: ((state: AppStateStatus) => void) | undefined;
const remove = jest.fn();
beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_event, callback) => { active = callback; return { remove }; });
});
afterEach(() => { act(() => tree?.unmount()); jest.restoreAllMocks(); jest.useRealTimers(); });
it('advances at local midnight and recalculates an edited ET while still mounted', () => {
  jest.setSystemTime(new Date(2026, 9, 3, 23, 59, 59));
  const due = new Date(2027, 0, 8); // 97 calendar days remaining
  act(() => { tree = create(<Probe due={due} />); });
  expect(currentAge()).toMatchObject({ completedWeeks: 26, day: 1 });
  act(() => { jest.advanceTimersByTime(1020); });
  expect(currentAge()).toMatchObject({ completedWeeks: 26, day: 2 });
  const changed = new Date(due); changed.setDate(changed.getDate() + 2);
  act(() => { tree.update(<Probe due={changed} />); });
  expect(currentAge()).toMatchObject({ completedWeeks: 26, day: 0 });
});
it('refreshes immediately after returning from the background and removes the listener', () => {
  jest.setSystemTime(new Date(2026, 9, 3, 12));
  act(() => { tree = create(<Probe due="2026-10-03" />); });
  expect(currentAge()).toMatchObject({ completedWeeks: 40, day: 0, daysToDueDate: 0 });
  jest.setSystemTime(new Date(2026, 9, 5, 12));
  act(() => { active?.('active'); });
  expect(currentAge()).toMatchObject({ completedWeeks: 40, day: 2, daysToDueDate: -2 });
  act(() => tree.unmount());
  expect(remove).toHaveBeenCalled();
});
