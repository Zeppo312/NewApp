import React from 'react';
import { Text } from 'react-native';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { ProgressCircle } from '../../components/ProgressCircle';
import { SleepTimerFace } from '../../components/tracking/SleepTimerFace';

jest.mock('@/hooks/useColorScheme', () => ({ useColorScheme: () => 'light' }));
jest.mock('@/hooks/useAdaptiveColors', () => ({
  useAdaptiveColors: () => ({ hasCustomBackground: false, isDarkBackground: false }),
}));
jest.mock('@/components/ui/IconSymbol', () => ({ IconSymbol: () => null }));

describe('sleep timer text layers', () => {
  let tree: ReactTestRenderer;
  afterEach(() => act(() => tree?.unmount()));

  const renderedText = () => tree.root.findAllByType(Text)
    .map(node => React.Children.toArray(node.props.children).join(''));

  it('renders only the clock or elapsed time, with no percentage underneath on updates', () => {
    const renderFace = (active: boolean, progress: number, timeLabel: string) => (
      <SleepTimerFace size={234} active={active} progress={progress}
        timeLabel={timeLabel} textColor="#5C4033">
        <Text>{active ? 'Schläft gerade' : 'Nächstes Schlaffenster'}</Text>
      </SleepTimerFace>
    );

    act(() => { tree = create(renderFace(false, 0, '11:57')); });
    expect(renderedText()).toEqual(['11:57', 'Nächstes Schlaffenster']);

    for (const [progress, timeLabel] of [[25, '02:00:00'], [100, '08:00:00']] as const) {
      act(() => tree.update(renderFace(true, progress, timeLabel)));
      expect(renderedText()).toEqual([timeLabel, 'Schläft gerade']);
    }

    act(() => tree.update(renderFace(false, 0, '12:32')));
    expect(renderedText()).toEqual(['12:32', 'Nächstes Schlaffenster']);
  });

  it('preserves percentage labels for ordinary progress circles', () => {
    act(() => { tree = create(<ProgressCircle progress={42} />); });
    expect(renderedText()).toEqual(['42%']);
  });
});
