import { useCallback, type RefObject } from 'react';
import { AppState, Keyboard, Platform, type TextInput } from 'react-native';
import { useFocusEffect } from 'expo-router';

/** Restore an open keyboard after returning to the same, still-mounted input. */
export function useResumeInputFocus(inputRefs: readonly RefObject<TextInput | null>[]) {
  useFocusEffect(useCallback(() => {
    if (Platform.OS === 'web') return;

    let appState = AppState.currentState;
    let windowFocused = true;
    let keyboardVisible = Keyboard.isVisible();
    let resumeInput: TextInput | null = null;
    let frame: number | null = null;

    const cancelRestore = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    };

    const rememberInput = () => {
      // A second app switch can happen before the first resume frame runs.
      if (frame !== null && resumeInput) return;
      resumeInput = keyboardVisible
        ? inputRefs.find(ref => ref.current?.isFocused())?.current ?? null
        : null;
    };

    const restoreInput = () => {
      cancelRestore();
      if (appState !== 'active' || !windowFocused || !resumeInput) return;

      // Android's Activity may resume before its window gains focus. Wait for
      // the focus event and a frame before asking the IME to open again.
      frame = requestAnimationFrame(() => {
        frame = null;
        const input = resumeInput;
        resumeInput = null;
        if (appState !== 'active' || !windowFocused || !input) return;
        if (!inputRefs.some(ref => ref.current === input)) return;
        const focusedInput = inputRefs.find(ref => ref.current?.isFocused())?.current;
        if (focusedInput && focusedInput !== input) return;
        if (Keyboard.isVisible()) return;

        // RN ignores focus() on an input it still considers focused, even if
        // the system hid the keyboard during the app switch.
        if (input.isFocused()) input.blur();
        input.focus();
      });
    };

    const subscriptions = [
      Keyboard.addListener('keyboardDidShow', () => { keyboardVisible = true; }),
      Keyboard.addListener('keyboardDidHide', () => {
        // System dismissal in the background must not erase the saved intent.
        if (appState === 'active' && AppState.currentState === 'active' && windowFocused) {
          keyboardVisible = false;
        }
      }),
      AppState.addEventListener('change', nextState => {
        if (appState === 'active' && nextState !== 'active' && windowFocused) {
          rememberInput();
        }
        const returning = appState !== 'active' && nextState === 'active';
        appState = nextState;
        if (nextState !== 'active') cancelRestore();
        if (returning) restoreInput();
      }),
    ];

    if (Platform.OS === 'android') {
      subscriptions.push(
        AppState.addEventListener('blur', () => {
          if (appState === 'active' && windowFocused) rememberInput();
          windowFocused = false;
          cancelRestore();
        }),
        AppState.addEventListener('focus', () => {
          windowFocused = true;
          restoreInput();
        }),
      );
    }

    return () => {
      cancelRestore();
      resumeInput = null;
      subscriptions.forEach(subscription => subscription.remove());
    };
  }, [inputRefs]));
}
