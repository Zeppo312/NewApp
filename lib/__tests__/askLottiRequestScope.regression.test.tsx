import React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { Alert, Modal, Text, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AskLottiScreen from '../../app/frag-lotti';
import { askLotti, AskLottiError } from '../askLotti/api';
import { loadConversations, saveConversations, type AskLottiConversation } from '../askLotti/chatStore';
import { translateAskLotti } from '../askLotti/translations';
import type { AskLottiResponse } from '../askLotti/types';

let mockUserId: string | null = 'qa-user-a';
let mockBabyId: string | null = 'qa-baby-a';
let mockIsBabyBorn = true;

// Keep the screen, input/message logic, translations and chat store real.
// Only network, context providers and native/irrelevant child effects are replaced.
jest.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mockUserId ? { id: mockUserId } : null }) }));
jest.mock('@/contexts/ActiveBabyContext', () => ({ useActiveBaby: () => ({ activeBabyId: mockBabyId, activeBaby: { name: 'QA' } }) }));
jest.mock('@/contexts/BabyStatusContext', () => ({ useBabyStatus: () => ({ isBabyBorn: mockIsBabyBorn }) }));
jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('../askLotti/access', () => ({ useAskLottiAccess: () => true }));
jest.mock('../askLotti/api', () => ({
  askLotti: jest.fn(),
  AskLottiError: class extends Error {
    code: string;
    status: number | null;
    constructor(message: string, code: string, status: number | null = null) {
      super(message); this.code = code; this.status = status;
    }
  },
}));
jest.mock('../dataConsentRuntime', () => ({ runtimeConsentAllowed: () => true }));
jest.mock('@/components/privacy/DataConsentBoundary', () => ({ AiConsentGate: ({ children }: React.PropsWithChildren) => children }));
jest.mock('@/components/Header', () => ({ rightContent }: { rightContent: React.ReactNode }) => rightContent);
jest.mock('@/components/ThemedBackground', () => ({ ThemedBackground: require('react-native').View }));
jest.mock('@/components/LockedFeatureScreen', () => ({ LockedFeatureScreen: () => null }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('@/components/VoiceLogModal', () => () => null);
jest.mock('@/components/askLotti/ReportAnswerButton', () => ({ ReportAnswerButton: () => null }));
jest.mock('../voiceLog/api', () => ({ parseLottiEntries: jest.fn() }));
jest.mock('expo-haptics', () => ({ impactAsync: jest.fn(), ImpactFeedbackStyle: { Light: 'light' } }));
jest.mock('expo-blur', () => ({ BlurView: require('react-native').View }));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const ask = jest.mocked(askLotti);
const t = (key: Parameters<typeof translateAskLotti>[1], params?: Record<string, string | number>) => translateAskLotti('de', key, params);
const questionA = 'Wie war der Schlaf gestern?';
const questionB = 'Wie war die Trinkmenge heute?';
const foreignAnswer = 'QA Antwort ausschließlich für Gespräch A';
const ownAnswer = 'QA Antwort ausschließlich für Gespräch B';
const response = (answer = foreignAnswer, day = 17): AskLottiResponse => ({
  answer, evidence: [], disclaimer: '', intent: 'sleep_overview', mode: 'data', followUps: [], remaining: { day },
});
const deferred = () => {
  let resolve!: (value: AskLottiResponse) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<AskLottiResponse>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const existingB: AskLottiConversation = {
  id: 'qa-existing-b', title: 'QA bestehendes Gespräch B',
  createdAt: '2026-10-15T08:00:00.000Z', updatedAt: '2026-10-15T08:00:00.000Z',
  messages: [{ id: 'qa-message-b', role: 'user', text: 'QA frühere Frage in B' }],
};

describe('Frag Lotti request ownership (real screen and persistence)', () => {
  let tree: ReactTestRenderer | undefined;
  const root = () => tree!.root;
  const mount = async () => { await act(async () => { tree = create(<AskLottiScreen />); }); };
  const unmount = () => { act(() => tree?.unmount()); tree = undefined; };
  const rerender = async () => { await act(async () => tree!.update(<AskLottiScreen />)); };
  const input = () => root().findByType(TextInput);
  const buttons = () => root().findAll(node => typeof node.props.onPress === 'function');
  const sendButton = () => buttons().find(node => node.props.accessibilityLabel === t('send'))!;
  const messages = () => root().findAllByType(Text).filter(node => node.props.selectable).map(node => node.props.children);
  const uiText = () => JSON.stringify(tree!.toJSON());
  const buttonWithText = (label: string): ReactTestInstance => {
    const button = buttons().find(node => node.findAllByType(Text).some(text => text.props.children === label));
    if (!button) throw new Error(`Missing button: ${label}`);
    return button;
  };
  const pressText = (label: string) => act(() => buttonWithText(label).props.onPress());
  const showChats = () => {
    const button = buttons().find(node => node.props.accessibilityLabel === t('chatsTitle'));
    if (!button) throw new Error('Missing chat list button');
    act(() => button.props.onPress());
    expect(root().findByType(Modal).props.visible).toBe(true);
  };
  const newChat = () => { showChats(); pressText(t('newChat')); };
  const send = (value = questionA) => {
    act(() => input().props.onChangeText(value));
    act(() => input().props.onSubmitEditing());
  };
  const settle = async (pending: ReturnType<typeof deferred>, outcome: 'success' | 'error', answer = foreignAnswer) => {
    await act(async () => {
      if (outcome === 'success') pending.resolve(response(answer));
      else pending.reject(new AskLottiError('QA late failure', 'request_failed', 503));
    });
  };
  const expectClean = () => {
    expect(messages()).not.toContain(foreignAnswer);
    expect(messages()).not.toContain(t('serviceUnavailable'));
    expect(uiText()).not.toContain(t('retry'));
    expect(uiText()).not.toContain(t('remaining', { count: 17 }));
  };
  const persistedText = async () => JSON.stringify(await loadConversations());

  beforeEach(async () => {
    jest.useFakeTimers();
    ask.mockReset();
    mockUserId = 'qa-user-a'; mockBabyId = 'qa-baby-a'; mockIsBabyBorn = true;
    await AsyncStorage.clear();
  });
  afterEach(() => {
    unmount();
    jest.restoreAllMocks();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('discards late A success after New Chat, including disk and restart', async () => {
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); send(); newChat();
    await settle(a, 'success');
    expectClean();
    expect(messages()).toHaveLength(1);
    expect(await persistedText()).not.toContain(foreignAnswer);
    // Give B a local exchange so the empty new chat has a persisted identity.
    send('Hallo');
    const stored = await loadConversations();
    expect(stored).toHaveLength(2);
    expect(stored[0].messages.map(message => message.text)).toEqual(['Hallo', t('greeting')]);
    unmount(); await mount();
    expect(messages()).toEqual([t('intro'), 'Hallo', t('greeting')]);
    expectClean();
  });

  it.each(['success', 'error'] as const)('discards late A %s when an existing B is opened, including restart', async outcome => {
    await saveConversations([existingB]);
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); newChat(); send();
    showChats(); pressText(existingB.title);
    await settle(a, outcome);
    expectClean();
    expect(messages()).toEqual([t('intro'), existingB.messages[0].text]);
    const savedB = (await loadConversations()).find(chat => chat.id === existingB.id)!;
    expect(savedB.messages).toHaveLength(1);
    unmount(); await mount(); showChats(); pressText(existingB.title);
    expectClean();
    expect(messages()).toEqual([t('intro'), existingB.messages[0].text]);
  });

  it.each(['success', 'error'] as const)('never resurrects an active chat deleted before late %s', async outcome => {
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); send();
    const [original] = await loadConversations();
    showChats();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    act(() => buttons().find(node => node.props.accessibilityLabel === t('deleteChat'))!.props.onPress());
    const confirm = alert.mock.calls[0][2]!.find(button => button.style === 'destructive')!;
    act(() => confirm.onPress!());
    await settle(a, outcome);
    expectClean();
    expect(await loadConversations()).toEqual([]);
    expect(await persistedText()).not.toContain(original.id);
    unmount(); await mount(); expect(messages()).toEqual([t('intro')]);
  });

  it.each(['success', 'error'] as const)('drops late A %s in an empty new B without an error or retry', async outcome => {
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); send(); newChat(); await settle(a, outcome);
    expectClean(); expect(messages()).toEqual([t('intro')]);
    expect(input().props.editable).toBe(true);
  });

  it.each(['success', 'error'] as const)('keeps B loading and its double-send lock when A reaches %s/finally', async outcome => {
    const a = deferred(); const b = deferred();
    ask.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    await mount(); send(); newChat();
    expect(input().props.editable).toBe(true);
    send(questionB);
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][0].history).toEqual([]);
    await settle(a, outcome);
    expectClean();
    expect(input().props.editable).toBe(false);
    expect(sendButton().props.disabled).toBe(true);
    expect(uiText()).toContain(t('loading'));
    // Invoke the real submit handler twice, bypassing UI disabled as a race probe.
    act(() => input().props.onChangeText(questionB));
    act(() => { input().props.onSubmitEditing(); input().props.onSubmitEditing(); });
    expect(ask).toHaveBeenCalledTimes(2);
    await settle(b, 'success', ownAnswer);
    expect(messages()).toEqual([t('intro'), questionB, ownAnswer]);
    expect(input().props.editable).toBe(true);
  });

  it('does not revalidate A by opening it again after B', async () => {
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); send(); const [original] = await loadConversations();
    newChat(); showChats(); pressText(original.title);
    await settle(a, 'success');
    expectClean(); expect(messages()).toEqual([t('intro'), questionA]);
  });

  const boundaries = ['user', 'logout', 'baby', 'noBaby', 'pregnancy'] as const;
  const changeContext = (boundary: typeof boundaries[number]) => {
    if (boundary === 'user') mockUserId = 'qa-user-b';
    if (boundary === 'logout') mockUserId = null;
    if (boundary === 'baby') mockBabyId = 'qa-baby-b';
    if (boundary === 'noBaby') mockBabyId = null;
    if (boundary === 'pregnancy') mockIsBabyBorn = false;
  };
  it.each(boundaries.flatMap(boundary => (['success', 'error'] as const).map(outcome => [boundary, outcome] as const)))(
    'invalidates pending work on %s change before late %s', async (boundary, outcome) => {
      const a = deferred(); ask.mockReturnValueOnce(a.promise);
      await mount(); send(); changeContext(boundary); await rerender();
      await settle(a, outcome); expectClean(); expect(input().props.editable).toBe(true);
      expect(await persistedText()).not.toContain(foreignAnswer);
    },
  );

  it.each(['user', 'baby', 'pregnancy'] as const)('does not revalidate a request when the %s context returns to A', async boundary => {
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); send(); changeContext(boundary); await rerender();
    mockUserId = 'qa-user-a'; mockBabyId = 'qa-baby-a'; mockIsBabyBorn = true; await rerender();
    await settle(a, 'success'); expectClean();
  });

  it.each((['user', 'baby', 'pregnancy'] as const).flatMap(boundary => (['success', 'error'] as const).map(outcome => [boundary, outcome] as const)))(
    'allows a new request after %s change and keeps its lock through old %s/finally', async (boundary, outcome) => {
      const a = deferred(); const b = deferred();
      ask.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
      await mount(); send(); changeContext(boundary); await rerender();
      expect(input().props.editable).toBe(true);
      send(questionB); expect(ask).toHaveBeenCalledTimes(2);
      expect(ask.mock.calls[1][0]).toMatchObject({
        babyId: boundary === 'pregnancy' ? null : mockBabyId,
        mode: boundary === 'pregnancy' ? 'pregnancy' : 'baby',
      });
      await settle(a, outcome); expectClean();
      expect(input().props.editable).toBe(false);
      act(() => input().props.onChangeText(questionB));
      act(() => input().props.onSubmitEditing());
      expect(ask).toHaveBeenCalledTimes(2);
      await settle(b, 'success', ownAnswer);
      expect(messages()).toContain(ownAnswer);
      expect(input().props.editable).toBe(true);
    },
  );

  it('also invalidates a pregnancy request when switching to baby mode', async () => {
    mockIsBabyBorn = false;
    const a = deferred(); ask.mockReturnValueOnce(a.promise);
    await mount(); send();
    expect(ask.mock.calls[0][0]).toMatchObject({ babyId: null, mode: 'pregnancy' });
    mockIsBabyBorn = true; await rerender(); await settle(a, 'success');
    expectClean(); expect(input().props.editable).toBe(true);
  });

  it.each(['success', 'error'] as const)('discards unmounted A %s while a fresh screen has B pending', async outcome => {
    const a = deferred(); const b = deferred();
    ask.mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    await mount(); send(); unmount(); await mount(); newChat(); send(questionB);
    await loadConversations(); // Drain B's legitimate queued write before counting.
    const writes = jest.mocked(AsyncStorage.setItem).mock.calls.length;
    const readOutcome = jest.fn(() => outcome === 'success' ? { day: 17 } : 503);
    const reply = response();
    const error = new AskLottiError('QA late failure', 'request_failed', 503);
    Object.defineProperty(reply, 'remaining', { get: readOutcome });
    Object.defineProperty(error, 'status', { get: readOutcome });
    await act(async () => { if (outcome === 'success') a.resolve(reply); else a.reject(error); });
    expect(readOutcome).not.toHaveBeenCalled();
    expectClean(); expect(input().props.editable).toBe(false);
    expect(jest.mocked(AsyncStorage.setItem).mock.calls).toHaveLength(writes);
    await settle(b, 'success', ownAnswer);
    expect(messages()).toEqual([t('intro'), questionB, ownAnswer]);
  });

  it('preserves normal success, quota, history and saved messages', async () => {
    const a = deferred(); const next = deferred();
    ask.mockReturnValueOnce(a.promise).mockReturnValueOnce(next.promise);
    await mount(); send();
    // Same-render duplicate submission must not issue another request.
    act(() => input().props.onChangeText(questionA));
    act(() => input().props.onSubmitEditing()); expect(ask).toHaveBeenCalledTimes(1);
    await settle(a, 'success');
    expect(messages()).toEqual([t('intro'), questionA, foreignAnswer]);
    expect(uiText()).toContain(t('remaining', { count: 17 }));
    expect(input().props.editable).toBe(true);
    send(questionB);
    expect(ask.mock.calls[1][0]).toMatchObject({ babyId: 'qa-baby-a', mode: 'baby', history: [
      { role: 'user', text: questionA }, { role: 'assistant', text: foreignAnswer },
    ] });
    await settle(next, 'success', ownAnswer);
    unmount(); await mount();
    expect(messages()).toEqual([t('intro'), questionA, foreignAnswer, questionB, ownAnswer]);
  });

  it('preserves a normal error and the actual retry button', async () => {
    const a = deferred(); const retry = deferred();
    ask.mockReturnValueOnce(a.promise).mockReturnValueOnce(retry.promise);
    await mount(); send(); await settle(a, 'error');
    expect(messages()).toEqual([t('intro'), questionA, t('serviceUnavailable')]);
    expect(input().props.editable).toBe(true);
    pressText(t('retry'));
    expect(ask).toHaveBeenCalledTimes(2);
    expect(ask.mock.calls[1][0].question).toBe(questionA);
    await settle(retry, 'success', ownAnswer);
    expect(messages()).toContain(ownAnswer);
    const saved = await loadConversations();
    expect(saved[0].messages.find(message => message.isError)?.retryQuestion).toBe(questionA);
  });

  it.each([true, false])('keeps local greeting/thanks and persistence in born=%s mode', async born => {
    mockIsBabyBorn = born;
    await mount(); send('Hallo'); send('Danke');
    expect(ask).not.toHaveBeenCalled();
    const expected = [t(born ? 'intro' : 'introPregnancy'), 'Hallo', t(born ? 'greeting' : 'greetingPregnancy'), 'Danke', t('thanks')];
    expect(messages()).toEqual(expected);
    unmount(); await mount(); expect(messages()).toEqual(expected);
  });
});
