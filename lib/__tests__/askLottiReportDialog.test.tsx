import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { Modal, TextInput } from 'react-native';
import { ReportAnswerButton } from '../../components/askLotti/ReportAnswerButton';
import { reportLottiAnswer } from '../askLotti/reporting';

jest.mock('@/contexts/LocaleContext', () => ({ useLocale: () => ({ locale: 'de' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 24, bottom: 16 }) }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));
jest.mock('../askLotti/reporting', () => ({
  ...jest.requireActual('../askLotti/reporting'), reportLottiAnswer: jest.fn(),
}));
jest.mock('../supabase', () => ({ supabase: { rpc: jest.fn() } }));
const report = reportLottiAnswer as jest.Mock;
let tree: ReactTestRenderer;
const message = { id: 'saved-answer', role: 'lotti' as const, text: 'Saved answer' };
const buttons = () => tree.root.findAll(node => node.props.accessibilityRole === 'button' || node.props.accessibilityRole === 'radio');
const submit = () => buttons().find(node => node.props.accessibilityState?.busy !== undefined)!;
const chooseReason = () => buttons().find(node => node.props.accessibilityRole === 'radio')!.props.onPress();
const open = async () => {
  await act(async () => { tree = create(<ReportAnswerButton message={message} conversationId="saved-chat" isDark={false} />); });
  act(() => buttons()[0].props.onPress());
};
beforeEach(() => report.mockReset());
afterEach(() => act(() => tree?.unmount()));

it('opens in-app, requires a reason and cancels without sending', async () => {
  await open();
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  expect(submit().props.disabled).toBe(true);
  expect(JSON.stringify(tree.toJSON())).toContain('Der übrige Chatverlauf wird nicht übertragen');
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(tree.root.findByType(Modal).props.visible).toBe(false);
  expect(report).not.toHaveBeenCalled();
});

it('keeps reason and comment after failure, then confirms successful retry', async () => {
  report.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await open();
  act(() => { chooseReason(); tree.root.findByType(TextInput).props.onChangeText('My comment'); });
  await act(async () => submit().props.onPress());
  expect(JSON.stringify(tree.toJSON())).toContain('Die Meldung konnte nicht gesendet werden');
  expect(tree.root.findByType(TextInput).props.value).toBe('My comment');
  await act(async () => submit().props.onPress());
  expect(report).toHaveBeenLastCalledWith({ message, conversationId: 'saved-chat', reason: 'misinformation', details: 'My comment' });
  expect(JSON.stringify(tree.toJSON())).toContain('Danke für deine Meldung');
  expect(tree.root.findAllByType(TextInput)).toHaveLength(0);
});

it('prevents double submission and dismissal while sending', async () => {
  let finish: (value: boolean) => void = () => {};
  report.mockImplementation(() => new Promise<boolean>(resolve => { finish = resolve; }));
  await open();
  act(chooseReason);
  const send = submit().props.onPress;
  act(() => { send(); send(); });
  expect(report).toHaveBeenCalledTimes(1);
  expect(submit().props.disabled).toBe(true);
  act(() => tree.root.findByType(Modal).props.onRequestClose());
  expect(tree.root.findByType(Modal).props.visible).toBe(true);
  await act(async () => finish(true));
});
