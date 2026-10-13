import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { SleepTimerFace, type SleepTimerFaceProps } from '@/components/tracking/SleepTimerFace';

jest.mock('@/components/ui/home-glass', () => ({ HomeGlassSurface: jest.requireActual('react-native').View, useHomeBlurAvailable: () => true }));
jest.mock('@/hooks/useAdaptiveColors', () => ({ useAdaptiveColors: () => ({ effectiveScheme: 'light' }) }));
jest.mock('@/components/ProgressCircle', () => ({ ProgressCircle: () => null }));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));

let tree: ReactTestRenderer;
afterEach(() => act(() => tree?.unmount()));
const base: SleepTimerFaceProps = {
  size: 234, active: false, progress: 0, timeLabel: '14:30', textColor: '#5C4033',
  startLabel: 'Schlaf starten', startHint: 'Timer beginnen',
};
const buttons = () => tree.root.findAll(n => n.props.accessibilityRole === 'button' && typeof n.props.style === 'function');
const render = (props: Partial<SleepTimerFaceProps>) => act(() => {
  tree = create(<SleepTimerFace {...base} {...props} />);
});

it('offers a localized start action and delegates to the supplied flow', async () => {
  const onStart = jest.fn().mockResolvedValue(true);
  render({ onStart, startLabel: 'Iniciar sueño' });
  expect(buttons()[0].props.accessibilityLabel).toBe('Iniciar sueño');
  await act(async () => { await buttons()[0].props.onPress(); });
  expect(onStart).toHaveBeenCalledTimes(1);
});

it.each([{ pending: true }, { startDisabled: true }])('blocks a start while %j', async props => {
  const onStart = jest.fn();
  render({ ...props, onStart });
  expect(buttons()[0].props.accessibilityState.disabled).toBe(true);
  await act(async () => { await buttons()[0].props.onPress(); });
  expect(onStart).not.toHaveBeenCalled();
});

it('keeps a running sleep display and the onboarding preview free of start actions', () => {
  const onStart = jest.fn();
  render({ onStart, active: true });
  expect(buttons()).toHaveLength(0);
  act(() => tree.update(<SleepTimerFace {...base} />));
  expect(buttons()).toHaveLength(0);
  expect(onStart).not.toHaveBeenCalled();
});

it('prevents rapid repeated starts before the parent can update its loading state', async () => {
  let finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const onStart = jest.fn().mockReturnValueOnce(pending).mockResolvedValue(true);
  render({ onStart });
  let first!: Promise<void>;
  act(() => { first = buttons()[0].props.onPress(); });
  await act(async () => { await buttons()[0].props.onPress(); });
  expect(onStart).toHaveBeenCalledTimes(1);
  await act(async () => { finish(); await first; });
  await act(async () => { await buttons()[0].props.onPress(); });
  expect(onStart).toHaveBeenCalledTimes(2);
});

it('releases the tap lock after an unsuccessful start so the same control can retry', async () => {
  const onStart = jest.fn().mockResolvedValue(false);
  render({ onStart });
  await act(async () => { await buttons()[0].props.onPress(); });
  await act(async () => { await buttons()[0].props.onPress(); });
  expect(onStart).toHaveBeenCalledTimes(2);
});
