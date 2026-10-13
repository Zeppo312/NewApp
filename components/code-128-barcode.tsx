import React, { useMemo } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import { createCode128Layout } from '@/lib/code-128';

type Code128BarcodeProps = {
  value: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
};

export function Code128Barcode({ value, height = 116, style }: Code128BarcodeProps) {
  const layout = useMemo(() => createCode128Layout(value), [value]);

  return (
    <Svg
      accessibilityLabel={`Barcode ${value}`}
      height={height}
      preserveAspectRatio="none"
      style={style}
      viewBox={`0 0 ${layout.width} 100`}
      width="100%"
    >
      <Rect fill="#FFFFFF" height="100" width={layout.width} x="0" y="0" />
      {layout.bars.map((bar, index) => (
        <Rect
          key={`${bar.x}-${index}`}
          fill="#000000"
          height="100"
          width={bar.width}
          x={bar.x}
          y="0"
        />
      ))}
    </Svg>
  );
}
