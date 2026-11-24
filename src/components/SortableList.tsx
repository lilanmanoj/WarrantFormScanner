import React, { ReactNode, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors } from '../theme';

interface Props<T> {
  items: T[];
  keyExtractor: (item: T) => string;
  /** Every row has this fixed height (including spacing). */
  rowHeight: number;
  /** Renders the row content to the right of the drag handle. */
  renderItem: (item: T, index: number) => ReactNode;
  onReorder: (items: T[]) => void;
  /** Lets the parent disable scrolling while a row is dragged. */
  onDragStateChange?: (dragging: boolean) => void;
}

/** Vertical space between rows (part of rowHeight). */
const ROW_GAP = 8;

interface DragState {
  from: number;
  to: number;
}

export function move<T>(list: T[], from: number, to: number): T[] {
  const copy = [...list];
  const [item] = copy.splice(from, 1);
  copy.splice(to, 0, item);
  return copy;
}

/**
 * Drag-to-reorder list built on PanResponder (no extra native dependencies).
 * Press and drag the ☰ handle to move a row.
 */
export function SortableList<T>({
  items,
  keyExtractor,
  rowHeight,
  renderItem,
  onReorder,
  onDragStateChange,
}: Props<T>) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const dy = useRef(new Animated.Value(0)).current;

  const targetIndex = (from: number, offset: number) =>
    Math.max(0, Math.min(items.length - 1, from + Math.round(offset / rowHeight)));

  const handleStart = (index: number) => {
    dy.setValue(0);
    setDrag({ from: index, to: index });
    onDragStateChange?.(true);
  };

  const handleMove = (index: number, offset: number) => {
    dy.setValue(offset);
    const to = targetIndex(index, offset);
    setDrag(d => (d && d.to !== to ? { ...d, to } : d));
  };

  const handleEnd = (index: number, offset: number) => {
    const to = targetIndex(index, offset);
    dy.setValue(0);
    setDrag(null);
    onDragStateChange?.(false);
    if (to !== index) {
      onReorder(move(items, index, to));
    }
  };

  /** How far a non-dragged row shifts to make room for the dragged one. */
  const shiftFor = (index: number): number => {
    if (!drag || index === drag.from) {
      return 0;
    }
    if (drag.from < drag.to && index > drag.from && index <= drag.to) {
      return -rowHeight;
    }
    if (drag.from > drag.to && index < drag.from && index >= drag.to) {
      return rowHeight;
    }
    return 0;
  };

  return (
    <View style={{ height: rowHeight * items.length }}>
      {items.map((item, index) => {
        const isDragged = drag?.from === index;
        return (
          <Animated.View
            key={keyExtractor(item)}
            style={[
              styles.row,
              { height: rowHeight - ROW_GAP, top: index * rowHeight },
              isDragged
                ? [styles.dragged, { transform: [{ translateY: dy }] }]
                : { transform: [{ translateY: shiftFor(index) }] },
            ]}>
            <DragHandle
              index={index}
              onStart={handleStart}
              onMove={handleMove}
              onEnd={handleEnd}
            />
            <View style={styles.content}>{renderItem(item, index)}</View>
          </Animated.View>
        );
      })}
    </View>
  );
}

interface HandleProps {
  index: number;
  onStart: (index: number) => void;
  onMove: (index: number, dy: number) => void;
  onEnd: (index: number, dy: number) => void;
}

function DragHandle(props: HandleProps) {
  // PanResponder is created once; read the latest props through a ref.
  const latest = useRef(props);
  latest.current = props;

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => latest.current.onStart(latest.current.index),
      onPanResponderMove: (_, g) => latest.current.onMove(latest.current.index, g.dy),
      onPanResponderRelease: (_, g) => latest.current.onEnd(latest.current.index, g.dy),
      onPanResponderTerminate: (_, g) => latest.current.onEnd(latest.current.index, g.dy),
    }),
  ).current;

  return (
    <View
      {...responder.panHandlers}
      style={styles.handle}
      accessibilityLabel="Drag to reorder"
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}>
      <Text style={styles.handleText}>☰</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  dragged: {
    zIndex: 10,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    borderColor: colors.primary,
  },
  handle: {
    width: 44,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
  },
  handleText: {
    fontSize: 22,
    color: colors.textMuted,
  },
  content: {
    flex: 1,
    alignSelf: 'stretch',
  },
});
