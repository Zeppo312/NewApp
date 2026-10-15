import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import DataConsentsScreen from "../../app/data-consents";
import { DataConsentPanel } from "../../components/privacy/DataConsentPanel";
import { dataConsentCopy } from "../dataConsentCopy";
// Consent pages use the app shell (Header, background, glass card); keep it light in tests.
jest.mock('@/components/Header', () => { const R = require('react'); const { Pressable, Text } = require('react-native');
  return { __esModule: true, default: ({ title, showBackButton, onBackPress, backAccessibilityLabel }: any) => R.createElement(R.Fragment, null,
    R.createElement(Text, null, title), showBackButton ? R.createElement(Pressable, { accessibilityRole: 'button', accessibilityLabel: backAccessibilityLabel, onPress: onBackPress }) : null) }; });
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: ({ children }: any) => children }));
jest.mock('@/components/ui/content-card', () => ({ ContentCard: ({ children }: any) => children }));
jest.mock('@/contexts/NavigationContext', () => ({ NavigationProvider: ({ children }: any) => children }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light', isDarkBackground: false, textPrimary: '#000', textSecondary: '#333', textTertiary: '#666' }) }));

jest.mock("@/contexts/LocaleContext", () => ({
  useLocale: () => ({ locale: "de" }),
}));
jest.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ signOut: jest.fn() }) }));
jest.mock("@/contexts/DataConsentContext", () => ({ useDataConsents: () => ({ mode: 'preview' }) }));
const mockBack = jest.fn();
jest.mock("expo-router", () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ canGoBack: () => true, back: mockBack }),
}));
let tree: ReactTestRenderer;
const copy = dataConsentCopy.de;
const text = () => JSON.stringify(tree.toJSON());
const buttons = () =>
  tree.root.findAll(
    (node) =>
      node.props.accessibilityRole === "button" &&
      typeof node.props.onPress === "function",
  );
// Content buttons only; the shared header adds its own back button first.
const reviewButtons = () =>
  buttons().filter((node) => node.findAll((child) => child.props.children === copy.review).length > 0);
const open = async () => {
  await act(async () => {
    tree = create(<DataConsentsScreen />);
  });
};
afterEach(() => {
  act(() => tree?.unmount());
  jest.restoreAllMocks();
});
it("keeps both dialogs optional and explains that the preview changes no processing", async () => {
  await open();
  expect(text()).toContain(copy.settingsIntro);
  expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
  act(() => reviewButtons()[0].props.onPress());
  expect(tree.root.findByType(DataConsentPanel).props.scope).toBe("health");
  act(() => tree.root.findByType(DataConsentPanel).props.onCancel());
  expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
  act(() => buttons().at(-1)!.props.onPress());
  expect(mockBack).toHaveBeenCalled();
});
it("allows refusal while keeping the other dialog and navigation available, without network calls", async () => {
  const network = jest.spyOn(global, "fetch");
  await open();
  act(() => reviewButtons()[0].props.onPress());
  act(() => tree.root.findByType(DataConsentPanel).props.onDecide(false));
  expect(text()).toContain(copy.disabled);
  act(() => reviewButtons().at(-1)!.props.onPress());
  expect(tree.root.findByType(DataConsentPanel).props.scope).toBe("ai");
  act(() => tree.root.findByType(DataConsentPanel).props.onDecide(true));
  expect(text()).toContain(copy.granted);
  expect(text()).toContain(copy.disabled);
  expect(network).not.toHaveBeenCalled();
});
it("forgets preview choices when the page is closed", async () => {
  await open();
  act(() => reviewButtons()[0].props.onPress());
  act(() => tree.root.findByType(DataConsentPanel).props.onDecide(true));
  expect(text()).toContain(copy.granted);
  act(() => tree.unmount());
  await open();
  expect(text()).not.toContain(copy.granted);
  expect(text()).toContain(copy.undecided);
});
