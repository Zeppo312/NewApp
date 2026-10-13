import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import DataConsentsScreen from "../../app/data-consents";
import { DataConsentPanel } from "../../components/privacy/DataConsentPanel";
import { dataConsentCopy } from "../dataConsentCopy";
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
  act(() => buttons()[0].props.onPress());
  expect(tree.root.findByType(DataConsentPanel).props.scope).toBe("health");
  act(() => tree.root.findByType(DataConsentPanel).props.onCancel());
  expect(tree.root.findAllByType(DataConsentPanel)).toHaveLength(0);
  act(() => buttons().at(-1)!.props.onPress());
  expect(mockBack).toHaveBeenCalled();
});
it("allows refusal while keeping the other dialog and navigation available, without network calls", async () => {
  const network = jest.spyOn(global, "fetch");
  await open();
  act(() => buttons()[0].props.onPress());
  act(() => tree.root.findByType(DataConsentPanel).props.onDecide(false));
  expect(text()).toContain(copy.disabled);
  const reviews = buttons().filter(
    (node) => node.props.children?.props?.children === copy.review,
  );
  act(() => reviews[1].props.onPress());
  expect(tree.root.findByType(DataConsentPanel).props.scope).toBe("ai");
  act(() => tree.root.findByType(DataConsentPanel).props.onDecide(true));
  expect(text()).toContain(copy.granted);
  expect(text()).toContain(copy.disabled);
  expect(network).not.toHaveBeenCalled();
});
it("forgets preview choices when the page is closed", async () => {
  await open();
  act(() => buttons()[0].props.onPress());
  act(() => tree.root.findByType(DataConsentPanel).props.onDecide(true));
  expect(text()).toContain(copy.granted);
  act(() => tree.unmount());
  await open();
  expect(text()).not.toContain(copy.granted);
  expect(text()).toContain(copy.undecided);
});
