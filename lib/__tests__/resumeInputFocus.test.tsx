import React from 'react';
import { AppState, Keyboard, Platform, type AppStateStatus, type TextInput } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useResumeInputFocus } from '@/hooks/use-resume-input-focus';

const mockScreenFocusContext = React.createContext(true);
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const { useContext, useEffect } = jest.requireActual('react');
    const focused = useContext(mockScreenFocusContext);
    useEffect(() => focused ? callback() : undefined, [callback, focused]);
  },
}));

const originalOS = Platform.OS;
const originalAppState = AppState.currentState;
let tree: ReactTestRenderer;
let keyboardVisible: boolean;
const appListeners = new Map<string, Set<(state: AppStateStatus) => void>>();
const keyboardListeners = new Map<string, Set<Parameters<typeof Keyboard.addListener>[1]>>();

function makeInput() {
  let focused = false;
  const input = {
    focus: jest.fn(() => { focused = true; }),
    blur: jest.fn(() => { focused = false; }),
    isFocused: jest.fn(() => focused),
  };
  return { input, setFocused: (value: boolean) => { focused = value; } };
}

let inputs: ReturnType<typeof makeInput>[];
let inputRefs: React.RefObject<TextInput | null>[];
function FocusHarness() {
  useResumeInputFocus(inputRefs);
  return null;
}

function Harness({ focused = true }: { focused?: boolean }) {
  return <mockScreenFocusContext.Provider value={focused}><FocusHarness /></mockScreenFocusContext.Provider>;
}

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  keyboardVisible = false;
  appListeners.clear();
  keyboardListeners.clear();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: 'active' });
  inputs = [makeInput(), makeInput()];
  inputRefs = inputs.map(({ input }) => ({ current: input as unknown as TextInput }));
  jest.spyOn(Keyboard, 'isVisible').mockImplementation(() => keyboardVisible);
  jest.spyOn(Keyboard, 'addListener').mockImplementation((event, callback) => {
    const callbacks = keyboardListeners.get(event) ?? new Set();
    callbacks.add(callback);
    keyboardListeners.set(event, callbacks);
    return { remove: () => { callbacks.delete(callback); } } as ReturnType<typeof Keyboard.addListener>;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation((event, callback) => {
    const callbacks = appListeners.get(event) ?? new Set();
    callbacks.add(callback);
    appListeners.set(event, callbacks);
    return { remove: () => { callbacks.delete(callback); } };
  });
  jest.spyOn(global, 'requestAnimationFrame').mockImplementation(callback =>
    setTimeout(() => callback(0), 16) as unknown as number);
  jest.spyOn(global, 'cancelAnimationFrame').mockImplementation(id => clearTimeout(id));
});

afterEach(() => {
  if (tree) act(() => tree.unmount());
  jest.restoreAllMocks();
  jest.useRealTimers();
  Object.defineProperty(Platform, 'OS', { configurable: true, value: originalOS });
  Object.defineProperty(AppState, 'currentState', { configurable: true, value: originalAppState });
});

function mount(platform: 'ios' | 'android' | 'web' = 'ios') {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: platform });
  act(() => { tree = create(<Harness />); });
}

function appEvent(event: 'change' | 'blur' | 'focus', state: AppStateStatus = 'active') {
  if (event === 'change') {
    Object.defineProperty(AppState, 'currentState', { configurable: true, value: state });
  }
  act(() => appListeners.get(event)?.forEach(callback => callback(state)));
}

function keyboard(visible: boolean) {
  keyboardVisible = visible;
  act(() => keyboardListeners.get(visible ? 'keyboardDidShow' : 'keyboardDidHide')?.forEach(callback => callback({
    duration: 0,
    easing: 'keyboard',
    endCoordinates: { screenX: 0, screenY: 0, width: 390, height: visible ? 300 : 0 },
  })));
}

function startEditing(index = 0) {
  inputs.forEach((input, i) => input.setFocused(i === index));
  keyboard(true);
}

function finishResume() {
  act(() => jest.runOnlyPendingTimers());
}

it('restores the original input after iOS inactive → background → active, despite system blur/hide', () => {
  mount();
  startEditing();
  appEvent('change', 'inactive');
  inputs[0].setFocused(false);
  keyboard(false);
  appEvent('change', 'background');
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.focus).toHaveBeenCalledTimes(1);
  expect(inputs[1].input.focus).not.toHaveBeenCalled();
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.focus).toHaveBeenCalledTimes(1);
});

it('refocuses an input whose JS focus survived, so focus() is not ignored by React Native', () => {
  mount();
  startEditing();
  appEvent('change', 'inactive');
  keyboard(false);
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.blur).toHaveBeenCalledTimes(1);
  expect(inputs[0].input.focus).toHaveBeenCalledTimes(1);
  expect(inputs[0].input.blur.mock.invocationCallOrder[0])
    .toBeLessThan(inputs[0].input.focus.mock.invocationCallOrder[0]);
});

it.each(['ios', 'android'] as const)('respects deliberate keyboard dismissal on %s even if the field remains focused', platform => {
  mount(platform);
  startEditing();
  keyboard(false);
  if (platform === 'android') appEvent('blur');
  appEvent('change', 'background');
  appEvent('change', 'active');
  if (platform === 'android') appEvent('focus');
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
});

it('does not open a software keyboard when editing with a hardware keyboard', () => {
  mount();
  inputs[0].setFocused(true);
  appEvent('change', 'background');
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
});

it('waits for Android window focus and retains the intent across blur/hide/background', () => {
  mount('android');
  startEditing(1);
  appEvent('blur');
  keyboard(false);
  appEvent('change', 'background');
  appEvent('change', 'active');
  finishResume();
  expect(inputs[1].input.focus).not.toHaveBeenCalled();
  appEvent('focus');
  finishResume();
  expect(inputs[1].input.focus).toHaveBeenCalledTimes(1);
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
});

it('also handles Android background preceding window blur', () => {
  mount('android');
  startEditing();
  appEvent('change', 'background');
  keyboard(false);
  appEvent('blur');
  appEvent('focus');
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.focus).toHaveBeenCalledTimes(1);
});

it('does not refocus when the system already restored the keyboard', () => {
  mount();
  startEditing();
  appEvent('change', 'inactive');
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.blur).not.toHaveBeenCalled();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
});

it('does not restore a field removed by a save finishing in the background', () => {
  mount();
  startEditing();
  appEvent('change', 'background');
  keyboard(false);
  inputRefs[0].current = null;
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
});

it('does not steal focus from a different input selected before the resume frame', () => {
  mount();
  startEditing();
  appEvent('change', 'background');
  keyboard(false);
  appEvent('change', 'active');
  inputs[0].setFocused(false);
  inputs[1].setFocused(true);
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
});

it('cancels restoration and listeners when navigating away before the resume frame', () => {
  mount();
  startEditing();
  appEvent('change', 'background');
  keyboard(false);
  appEvent('change', 'active');
  act(() => tree.update(<Harness focused={false} />));
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
  expect([...appListeners.values()].every(listeners => listeners.size === 0)).toBe(true);
  expect([...keyboardListeners.values()].every(listeners => listeners.size === 0)).toBe(true);
});

it('defers a pending restore until the final return when switching apps twice quickly', () => {
  mount();
  startEditing();
  appEvent('change', 'background');
  inputs[0].setFocused(false);
  keyboard(false);
  appEvent('change', 'active');
  appEvent('change', 'background');
  finishResume();
  expect(inputs[0].input.focus).not.toHaveBeenCalled();
  appEvent('change', 'active');
  finishResume();
  expect(inputs[0].input.focus).toHaveBeenCalledTimes(1);
});

it('leaves web focus handling to the browser', () => {
  mount('web');
  expect(AppState.addEventListener).not.toHaveBeenCalled();
  expect(Keyboard.addListener).not.toHaveBeenCalled();
});
