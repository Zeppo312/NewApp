import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Keyboard, Platform, StyleSheet, Text, View } from 'react-native';

type LiveInputPreviewProps = {
  value: string;
  label?: string;
  visible?: boolean;
  maxLines?: number;
  interactive?: boolean;
  enableSelectionInput?: boolean;
  selection?: { start: number; end: number };
  caretColor?: string;
  onSelectionChange?: (selection: { start: number; end: number }) => void;
};

/**
 * Small floating preview bubble that mirrors the current TextInput value.
 * Use pointerEvents="none" so it does not intercept touches.
 */
export const LiveInputPreview: React.FC<LiveInputPreviewProps> = ({
  value,
  label,
  visible = true,
  maxLines = 3,
  interactive = false,
  enableSelectionInput = false,
  selection,
  caretColor = '#FFFFFF',
  onSelectionChange,
}) => {
  const [isMounted, setIsMounted] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const opacity = useRef(new Animated.Value(0)).current;

  const shouldShow = useMemo(() => visible && value !== undefined && value !== null, [visible, value]);

  useEffect(() => {
    const onShow = (e: any) => setKeyboardHeight(e?.endCoordinates?.height ?? 0);
    const onHide = () => setKeyboardHeight(0);

    const showSub = Keyboard.addListener('keyboardDidShow', onShow);
    const hideSub = Keyboard.addListener('keyboardDidHide', onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    if (shouldShow) {
      setIsMounted(true);
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 140,
        useNativeDriver: true,
      }).start(() => setIsMounted(false));
    }
  }, [shouldShow, opacity]);

  if (!isMounted) return null;

  return (
    <View
      pointerEvents={interactive ? 'box-none' : 'none'}
      style={[
        styles.container,
        { bottom: (Platform.OS === 'ios' ? 12 : 8) + keyboardHeight },
      ]}
    >
      <Animated.View
        pointerEvents={interactive ? 'auto' : 'none'}
        style={[styles.bubble, { opacity }]}
      >
        {label ? <Text style={styles.label}>{label}</Text> : null}
        <Text
          style={[styles.value, enableSelectionInput && styles.valueSelectable]}
          numberOfLines={maxLines}
          selectable={false}
        >
          {renderWithCaret(
            value || ' ',
            selection,
            caretColor,
            interactive || enableSelectionInput,
            onSelectionChange
          )}
        </Text>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  bubble: {
    maxWidth: '94%',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 6,
  },
  label: {
    color: '#D8D8D8',
    fontSize: 12,
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  valueSelectable: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  caret: {
    fontWeight: '900',
  },
  selected: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    color: '#FFFFFF',
  },
});

const clampSelection = (text: string, selection?: { start: number; end: number }) => {
  if (!selection) {
    return { start: text.length, end: text.length };
  }
  const start = Math.max(0, Math.min(selection.start ?? 0, text.length));
  const end = Math.max(start, Math.min(selection.end ?? start, text.length));
  return { start, end };
};

const renderWithCaret = (
  text: string,
  selection: { start: number; end: number } | undefined,
  caretColor: string,
  showCaret: boolean,
  onSelectionChange?: (selection: { start: number; end: number }) => void
) => {
  if (!showCaret) return text;
  const { start, end } = clampSelection(text, selection);

  const handlePressAtIndex = (index: number) => {
    onSelectionChange?.({ start: index, end: index });
  };

  // Leerer Text: Caret an Position 0
  if (!text.length) {
    return (
      <Text onPress={() => handlePressAtIndex(0)}>
        <Text style={[styles.caret, { color: caretColor }]}>|</Text>{' '}
      </Text>
    );
  }

  const chars = text.split('');
  const children: React.ReactNode[] = [];

  chars.forEach((ch, i) => {
    const isSelected = i >= start && i < end;

    children.push(
      <Text
        key={`ch-${i}`}
        style={isSelected ? styles.selected : undefined}
        onPress={() => handlePressAtIndex(i)}
      >
        {ch}
      </Text>
    );

    // Caret direkt nach aktuellem Zeichen, wenn Cursor/Ende hier liegt
    if (i === end - 1) {
      children.push(
        <Text
          key={`caret-${i}`}
          style={[styles.caret, { color: caretColor }]}
          onPress={() => handlePressAtIndex(i + 1)}
        >
          |
        </Text>
      );
    }
  });

  // Falls Caret ganz am Ende stehen soll
  if (end === text.length) {
    children.push(
      <Text
        key="caret-end"
        style={[styles.caret, { color: caretColor }]}
        onPress={() => handlePressAtIndex(end)}
      >
        |
      </Text>
    );
  }

  // Kleines Padding am Ende
  children.push(<Text key="space-end"> </Text>);

  return children;
};
