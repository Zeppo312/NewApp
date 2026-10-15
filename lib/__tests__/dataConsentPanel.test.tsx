import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { DataConsentPanel } from "../../components/privacy/DataConsentPanel";
// Consent pages use the app shell (Header, background, glass card); keep it light in tests.
jest.mock('@/components/Header', () => { const R = require('react'); const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ title, showBackButton, onBackPress, backAccessibilityLabel }: any) => R.createElement(R.Fragment, null,
    R.createElement(Text, null, title), showBackButton ? R.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: backAccessibilityLabel, onPress: onBackPress }) : null) }; });
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: ({ children }: any) => children }));
jest.mock('@/components/ui/content-card', () => ({ ContentCard: ({ children }: any) => children }));
jest.mock('@/contexts/NavigationContext', () => ({ NavigationProvider: ({ children }: any) => children }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', isDarkBackground: false, textPrimary: '#000', textSecondary: '#333', textTertiary: '#666' }) }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));
it.each(["health", "ai"] as const)(
  "%s requires an unchecked explicit choice; refusal and closing never accept",
  async (scope) => {
    const decide = jest.fn(),
      cancel = jest.fn();
    await act(async () => {
      tree = create(
        <DataConsentPanel
          scope={scope}
          locale="de"
          onDecide={decide}
          onCancel={cancel}
        />,
      );
    });
    const controls = () =>
      tree.root.findAll(
        (n) =>
          !!n.props.accessibilityRole && typeof n.props.onPress === "function",
      );
    const checkbox = () =>
      controls().find((n) => n.props.accessibilityRole === "checkbox")!;
    const accept = () =>
      controls().find(
        (n) =>
          n.props.accessibilityState?.disabled !== undefined &&
          n.props.accessibilityRole === "button",
      )!;
    expect(checkbox().props.accessibilityState.checked).toBe(false);
    expect(accept().props.disabled).toBe(true);
    act(() => checkbox().props.onPress());
    expect(accept().props.disabled).toBe(false);
    act(() => accept().props.onPress());
    expect(decide).toHaveBeenLastCalledWith(true);
    const buttons = controls().filter(
      (n) => n.props.accessibilityRole === "button",
    );
    act(() => buttons[1].props.onPress());
    expect(decide).toHaveBeenLastCalledWith(false);
    act(() => buttons[2].props.onPress());
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(decide).toHaveBeenCalledTimes(2);
  },
);
