import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';

export type SortableTileGridScrollMetrics = {
  offsetY: number;
  viewportHeight: number;
  contentHeight: number;
};

type SortableTileGridProps<T extends { id: string }> = {
  items: T[];
  isEditing: boolean;
  onPressItem: (item: T) => void;
  onRequestEditMode: () => void;
  onOrderChange: (items: T[]) => void;
  renderTile: (params: { item: T; isEditing: boolean; isActive: boolean }) => React.ReactNode;
  columns?: number;
  gap?: number;
  itemHeight?: number;
  scrollConfig?: {
    metricsRef: React.MutableRefObject<SortableTileGridScrollMetrics>;
    scrollToOffset: (offsetY: number) => void;
    slowEdgeThreshold?: number;
    fastEdgeThreshold?: number;
    slowSpeed?: number;
    fastSpeed?: number;
  };
  onDragStateChange?: (isDragging: boolean) => void;
  style?: StyleProp<ViewStyle>;
};

type SortableTileGridItemProps<T extends { id: string }> = {
  item: T;
  isEditing: boolean;
  isActive: boolean;
  animatedPosition: Animated.ValueXY;
  tileWidth: number;
  itemHeight: number;
  onPress: (item: T) => void;
  onRequestEditMode: () => void;
  onDragGrant: (id: string, touchOffsetY: number) => void;
  onDragMove: (id: string, dx: number, dy: number) => void;
  onDragRelease: (id: string) => void;
  renderTile: SortableTileGridProps<T>['renderTile'];
};

const DEFAULT_COLUMNS = 2;
const DEFAULT_GAP = 14;
const DEFAULT_ITEM_HEIGHT = 140;
const DEFAULT_SLOW_EDGE_THRESHOLD = 160;
const DEFAULT_FAST_EDGE_THRESHOLD = 72;
const DEFAULT_SLOW_SCROLL_SPEED = 2;
const DEFAULT_FAST_SCROLL_SPEED = 8;
const AUTO_SCROLL_DRAG_INTENT_THRESHOLD = 12;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

function arraysEqualById<T extends { id: string }>(left: T[], right: T[]) {
  if (left.length !== right.length) return false;

  return left.every((item, index) => item.id === right[index]?.id);
}

function moveItem<T>(items: T[], from: number, to: number) {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function SortableTileGridItem<T extends { id: string }>({
  item,
  isEditing,
  isActive,
  animatedPosition,
  tileWidth,
  itemHeight,
  onPress,
  onRequestEditMode,
  onDragGrant,
  onDragMove,
  onDragRelease,
  renderTile,
}: SortableTileGridItemProps<T>) {
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isEditing,
        onMoveShouldSetPanResponder: () => isEditing,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
          if (!isEditing) return;
          onDragGrant(item.id, event.nativeEvent.locationY);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!isEditing) return;
          onDragMove(item.id, gestureState.dx, gestureState.dy);
        },
        onPanResponderRelease: () => {
          if (!isEditing) return;
          onDragRelease(item.id);
        },
        onPanResponderTerminate: () => {
          if (!isEditing) return;
          onDragRelease(item.id);
        },
      }),
    [isEditing, item.id, onDragGrant, onDragMove, onDragRelease],
  );

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.tile,
        {
          width: tileWidth,
          height: itemHeight,
          zIndex: isActive ? 10 : 1,
          transform: [
            { translateX: animatedPosition.x },
            { translateY: animatedPosition.y },
            { scale: isActive ? 1.03 : 1 },
          ],
        },
      ]}
    >
      <Pressable
        onPress={() => {
          if (isEditing) return;
          onPress(item);
        }}
        onLongPress={() => {
          if (isEditing) return;
          onRequestEditMode();
        }}
        delayLongPress={250}
        style={styles.tilePressable}
      >
        {renderTile({ item, isEditing, isActive })}
      </Pressable>
    </Animated.View>
  );
}

export default function SortableTileGrid<T extends { id: string }>({
  items,
  isEditing,
  onPressItem,
  onRequestEditMode,
  onOrderChange,
  renderTile,
  columns = DEFAULT_COLUMNS,
  gap = DEFAULT_GAP,
  itemHeight = DEFAULT_ITEM_HEIGHT,
  scrollConfig,
  onDragStateChange,
  style,
}: SortableTileGridProps<T>) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [orderedItems, setOrderedItems] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const orderedItemsRef = useRef(items);
  const activeIdRef = useRef<string | null>(null);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const dragGestureRef = useRef({ dx: 0, dy: 0 });
  const dragTouchOffsetYRef = useRef(itemHeight / 2);
  const dragStartScrollOffsetRef = useRef(0);
  const layoutYRef = useRef(0);
  const positionsRef = useRef(new Map<string, Animated.ValueXY>());
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);
  const scrollConfigRef = useRef(scrollConfig);
  const recomputeDragPositionRef = useRef<(id: string, dx: number, dy: number) => void>(() => {});
  const stepAutoScrollRef = useRef<() => void>(() => {});
  const liveScrollOffsetRef = useRef(scrollConfig?.metricsRef.current.offsetY ?? 0);

  const startAutoScroll = useCallback((step: () => void) => {
    if (autoScrollFrameRef.current !== null) return;
    autoScrollFrameRef.current = requestAnimationFrame(step);
  }, []);

  const tileWidth =
    layoutWidth > 0 ? Math.max(0, (layoutWidth - gap * (columns - 1)) / columns) : 0;
  const rowCount = Math.ceil(orderedItems.length / columns);
  const containerHeight =
    rowCount > 0 ? rowCount * itemHeight + Math.max(0, rowCount - 1) * gap : 0;

  const getSlotPosition = useCallback(
    (index: number) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      return {
        x: column * (tileWidth + gap),
        y: row * (itemHeight + gap),
      };
    },
    [columns, gap, itemHeight, tileWidth],
  );

  const getAnimatedPosition = useCallback((id: string) => {
    let value = positionsRef.current.get(id);
    if (!value) {
      value = new Animated.ValueXY();
      positionsRef.current.set(id, value);
    }
    return value;
  }, []);

  const stopAutoScroll = useCallback(() => {
    autoScrollSpeedRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    scrollConfigRef.current = scrollConfig;
    liveScrollOffsetRef.current = scrollConfig?.metricsRef.current.offsetY ?? 0;
  }, [scrollConfig]);

  useEffect(() => stopAutoScroll, [stopAutoScroll]);

  useEffect(() => {
    positionsRef.current.forEach((_, id) => {
      if (!items.some((item) => item.id === id)) {
        positionsRef.current.delete(id);
      }
    });
  }, [items]);

  useEffect(() => {
    if (activeIdRef.current) return;
    if (arraysEqualById(orderedItemsRef.current, items)) return;

    orderedItemsRef.current = items;
    setOrderedItems(items);
  }, [items]);

  useEffect(() => {
    orderedItemsRef.current = orderedItems;

    if (!tileWidth) return;

    orderedItems.forEach((item, index) => {
      const position = getAnimatedPosition(item.id);
      const nextSlot = getSlotPosition(index);

      if (activeIdRef.current === item.id) return;

      Animated.spring(position, {
        toValue: nextSlot,
        useNativeDriver: false,
        tension: 220,
        friction: 22,
      }).start();
    });
  }, [getAnimatedPosition, getSlotPosition, orderedItems, tileWidth]);

  const stepAutoScroll = useCallback(() => {
    const config = scrollConfigRef.current;
    const metrics = config?.metricsRef.current;
    const activeId = activeIdRef.current;
    const speed = autoScrollSpeedRef.current;

    if (!config || !metrics || !activeId || speed === 0) {
      autoScrollFrameRef.current = null;
      return;
    }

    const maxOffset = Math.max(0, metrics.contentHeight - metrics.viewportHeight);
    const nextOffset = clamp(metrics.offsetY + speed, 0, maxOffset);

    if (nextOffset !== metrics.offsetY) {
      metrics.offsetY = nextOffset;
      config.scrollToOffset(nextOffset);
      recomputeDragPositionRef.current(activeId, dragGestureRef.current.dx, dragGestureRef.current.dy);
    }

    autoScrollFrameRef.current = requestAnimationFrame(stepAutoScrollRef.current);
  }, []);

  const updateAutoScrollSpeed = useCallback(
    (currentTileY: number, gestureDy: number) => {
      const config = scrollConfigRef.current;
      const metrics = config?.metricsRef.current;
      if (!config || !metrics || !activeIdRef.current) {
        stopAutoScroll();
        return;
      }

      const slowEdgeThreshold = config.slowEdgeThreshold ?? DEFAULT_SLOW_EDGE_THRESHOLD;
      const fastEdgeThreshold = config.fastEdgeThreshold ?? DEFAULT_FAST_EDGE_THRESHOLD;
      const slowSpeed = config.slowSpeed ?? DEFAULT_SLOW_SCROLL_SPEED;
      const fastSpeed = config.fastSpeed ?? DEFAULT_FAST_SCROLL_SPEED;

      const pointerViewportY =
        layoutYRef.current + currentTileY + dragTouchOffsetYRef.current - metrics.offsetY;
      const bottomSlowEdge = metrics.viewportHeight - slowEdgeThreshold;
      const bottomFastEdge = metrics.viewportHeight - fastEdgeThreshold;
      const isDraggingUp = gestureDy < -AUTO_SCROLL_DRAG_INTENT_THRESHOLD;
      const isDraggingDown = gestureDy > AUTO_SCROLL_DRAG_INTENT_THRESHOLD;

      let nextSpeed = 0;
      if (isDraggingUp && pointerViewportY < fastEdgeThreshold) {
        nextSpeed = -fastSpeed;
      } else if (isDraggingUp && pointerViewportY < slowEdgeThreshold) {
        nextSpeed = -slowSpeed;
      } else if (isDraggingDown && pointerViewportY > bottomFastEdge) {
        nextSpeed = fastSpeed;
      } else if (isDraggingDown && pointerViewportY > bottomSlowEdge) {
        nextSpeed = slowSpeed;
      }

      const previousSpeed = autoScrollSpeedRef.current;
      autoScrollSpeedRef.current = nextSpeed;
      if (nextSpeed === 0) {
        stopAutoScroll();
        return;
      }

      if (previousSpeed === 0) {
        startAutoScroll(stepAutoScrollRef.current);
      }
    },
    [itemHeight, startAutoScroll, stopAutoScroll],
  );

  const recomputeDragPosition = useCallback(
    (id: string, dx: number, dy: number) => {
      const position = getAnimatedPosition(id);
      const currentScrollOffset = scrollConfigRef.current?.metricsRef.current.offsetY ?? dragStartScrollOffsetRef.current;
      const scrollDelta = currentScrollOffset - dragStartScrollOffsetRef.current;
      const currentX = dragStartRef.current.x + dx;
      const currentY = dragStartRef.current.y + dy + scrollDelta;

      position.setValue({ x: currentX, y: currentY });

      if (!tileWidth) {
        updateAutoScrollSpeed(currentY, dy);
        return;
      }

      const col = clamp(
        Math.round(currentX / Math.max(1, tileWidth + gap)),
        0,
        columns - 1,
      );
      const row = clamp(
        Math.round(currentY / Math.max(1, itemHeight + gap)),
        0,
        Math.max(0, Math.ceil(orderedItemsRef.current.length / columns) - 1),
      );
      const nextIndex = clamp(row * columns + col, 0, orderedItemsRef.current.length - 1);
      const currentIndex = orderedItemsRef.current.findIndex((item) => item.id === id);

      if (currentIndex >= 0 && currentIndex !== nextIndex) {
        const nextItems = moveItem(orderedItemsRef.current, currentIndex, nextIndex);
        orderedItemsRef.current = nextItems;
        setOrderedItems(nextItems);
      }

      updateAutoScrollSpeed(currentY, dy);
    },
    [columns, gap, getAnimatedPosition, itemHeight, tileWidth, updateAutoScrollSpeed],
  );

  useEffect(() => {
    recomputeDragPositionRef.current = recomputeDragPosition;
  }, [recomputeDragPosition]);

  useEffect(() => {
    stepAutoScrollRef.current = stepAutoScroll;
  }, [stepAutoScroll]);

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, y } = event.nativeEvent.layout;
    layoutYRef.current = y;
    if (!width || width === layoutWidth) return;
    setLayoutWidth(width);
  }, [layoutWidth]);

  const handleDragGrant = useCallback(
    (id: string, touchOffsetY: number) => {
      const index = orderedItemsRef.current.findIndex((item) => item.id === id);
      if (index < 0) return;

      activeIdRef.current = id;
      setActiveId(id);
      onDragStateChange?.(true);
      dragGestureRef.current = { dx: 0, dy: 0 };
      dragTouchOffsetYRef.current = clamp(touchOffsetY, 0, itemHeight);
      dragStartRef.current = getSlotPosition(index);
      dragStartScrollOffsetRef.current = scrollConfigRef.current?.metricsRef.current.offsetY ?? 0;
    },
    [getSlotPosition, itemHeight, onDragStateChange],
  );

  const handleDragMove = useCallback(
    (id: string, dx: number, dy: number) => {
      dragGestureRef.current = { dx, dy };
      recomputeDragPosition(id, dx, dy);
    },
    [recomputeDragPosition],
  );

  const handleDragRelease = useCallback(
    (id: string) => {
      stopAutoScroll();
      const index = orderedItemsRef.current.findIndex((item) => item.id === id);
      if (index >= 0) {
        const position = getAnimatedPosition(id);
        Animated.spring(position, {
          toValue: getSlotPosition(index),
          useNativeDriver: false,
          tension: 220,
          friction: 22,
        }).start();
      }

      activeIdRef.current = null;
      setActiveId(null);
      onDragStateChange?.(false);
      onOrderChange(orderedItemsRef.current);
    },
    [getAnimatedPosition, getSlotPosition, onDragStateChange, onOrderChange, stopAutoScroll],
  );

  return (
    <View style={style} onLayout={handleLayout}>
      {layoutWidth > 0 ? (
        <View style={{ height: containerHeight }}>
          {orderedItems.map((item) => (
            <SortableTileGridItem
              key={item.id}
              item={item}
              isEditing={isEditing}
              isActive={activeId === item.id}
              animatedPosition={getAnimatedPosition(item.id)}
              tileWidth={tileWidth}
              itemHeight={itemHeight}
              onPress={onPressItem}
              onRequestEditMode={onRequestEditMode}
              onDragGrant={handleDragGrant}
              onDragMove={handleDragMove}
              onDragRelease={handleDragRelease}
              renderTile={renderTile}
            />
          ))}
        </View>
      ) : (
        <View style={styles.hiddenMeasureRow}>
          {items.map((item) => (
            <View key={item.id} style={[styles.hiddenMeasureTile, { width: `${100 / columns}%`, height: itemHeight }]}>
              {renderTile({ item, isEditing, isActive: false })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
  tilePressable: {
    flex: 1,
  },
  hiddenMeasureRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    opacity: 0,
  },
  hiddenMeasureTile: {
    paddingRight: 0,
    paddingBottom: 0,
  },
});
