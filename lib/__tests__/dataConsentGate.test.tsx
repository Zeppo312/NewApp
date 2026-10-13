import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { AiConsentGate, DataConsentBoundary } from '../../components/privacy/DataConsentBoundary';
import { activeDataConsentCopy } from '../dataConsentCopy';
let mockAllowed = false;
let mockHealthAllowed = false;
let mockMode = 'checking';
const mockPush = jest.fn();
const mockMount = jest.fn();
const mockStack = jest.fn();
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'a' }, loading: false }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/contexts/DataConsentContext', () => ({ useDataConsents: () => ({ aiAllowed: mockAllowed, healthAllowed: mockHealthAllowed, mode: mockMode }) }));
jest.mock('@/lib/dataConsentRuntime', () => ({ DATA_CONSENTS_ENABLED: true }));
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: React.ReactNode }) => { mockStack(); return children; };
  Stack.Screen = function MockScreen() { return null; }; Stack.Protected = function MockProtected() { return null; };
  return { Stack, useRouter: () => ({ push: mockPush, canGoBack: () => true, back: jest.fn() }) };
});
let tree: ReactTestRenderer;
function PrivateFeature() { mockMount(); return <Text>AI feature</Text>; }
beforeEach(() => { mockAllowed = false; mockHealthAllowed = false; mockMode = 'checking'; jest.clearAllMocks(); });
afterEach(() => { act(() => tree?.unmount()); });
it('explains the missing consent and opens the matching review without mounting the private feature', async () => {
  await act(async () => { tree = create(<AiConsentGate><PrivateFeature /></AiConsentGate>); });
  expect(JSON.stringify(tree.toJSON())).toContain(activeDataConsentCopy.de.aiRequired);
  expect(mockMount).not.toHaveBeenCalled();
  const button = tree.root.findAll(n => n.props.accessibilityRole === 'button')[0];
  act(() => button.props.onPress());
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/data-consents', params: { scope: 'ai' } });
  expect(mockMount).not.toHaveBeenCalled();
});
it('opens the feature after confirmed consent and removes it again on withdrawal', async () => {
  await act(async () => { tree = create(<AiConsentGate><PrivateFeature /></AiConsentGate>); });
  mockAllowed = true; act(() => tree.update(<AiConsentGate><PrivateFeature /></AiConsentGate>));
  expect(JSON.stringify(tree.toJSON())).toContain('AI feature'); expect(mockMount).toHaveBeenCalledTimes(1);
  mockAllowed = false; act(() => tree.update(<AiConsentGate><PrivateFeature /></AiConsentGate>));
  expect(tree.root.findAllByType(PrivateFeature)).toHaveLength(0);
  expect(JSON.stringify(tree.toJSON())).toContain(activeDataConsentCopy.de.aiRequired);
});
it('waits for local hydration without navigating into the consent screen', async () => {
  await act(async () => { tree = create(<DataConsentBoundary><PrivateFeature /></DataConsentBoundary>); });
  expect(mockStack).not.toHaveBeenCalled();expect(mockMount).not.toHaveBeenCalled();
  mockMode = 'active';mockHealthAllowed = true;
  act(() => tree.update(<DataConsentBoundary><PrivateFeature /></DataConsentBoundary>));
  expect(mockStack).not.toHaveBeenCalled();expect(mockMount).toHaveBeenCalledTimes(1);
});
it('opens the consent screen once a resolved decision requires it', async () => {
  mockMode = 'active';
  await act(async () => { tree = create(<DataConsentBoundary><PrivateFeature /></DataConsentBoundary>); });
  expect(mockStack).toHaveBeenCalledTimes(1);expect(mockMount).not.toHaveBeenCalled();
});
