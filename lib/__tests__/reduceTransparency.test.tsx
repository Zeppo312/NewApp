import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AccessibilityInfo } from 'react-native';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';

jest.spyOn(AccessibilityInfo, 'addEventListener');
jest.spyOn(AccessibilityInfo, 'isReduceTransparencyEnabled');

let tree: ReactTestRenderer | undefined;
let listener: (value: boolean) => void;
let resolveRead: (value: boolean) => void;
const remove = jest.fn();
const values = new Map<string, boolean>();
function Reader({ name }: { name: string }) {
  values.set(name, useReduceTransparency());
  return null;
}
beforeEach(() => {
  jest.clearAllMocks();
  values.clear();
  (AccessibilityInfo.addEventListener as jest.Mock).mockImplementation((_name, callback) => {
    listener = callback;
    return { remove };
  });
  (AccessibilityInfo.isReduceTransparencyEnabled as jest.Mock).mockImplementation(
    () => new Promise<boolean>(resolve => { resolveRead = resolve; }),
  );
});
afterEach(() => { act(() => tree?.unmount()); tree = undefined; });

it('shares one native subscription across cards and applies preference changes to every reader', async () => {
  act(() => { tree = create(<><Reader name="home" /><Reader name="sleep" /></>); });
  expect(AccessibilityInfo.isReduceTransparencyEnabled).toHaveBeenCalledTimes(1);
  expect(AccessibilityInfo.addEventListener).toHaveBeenCalledTimes(1);
  await act(async () => resolveRead(false));
  act(() => listener(true));
  expect([...values.values()]).toEqual([true, true]);
  act(() => tree!.update(<Reader name="home" />));
  expect(remove).not.toHaveBeenCalled();
  act(() => tree!.unmount()); tree = undefined;
  expect(remove).toHaveBeenCalledTimes(1);
});

it('ignores an older initial preference response after a newer system event', async () => {
  act(() => { tree = create(<Reader name="card" />); });
  act(() => listener(false));
  await act(async () => resolveRead(true));
  expect(values.get('card')).toBe(false);
});
