import { useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import TreeConnectors from './TreeConnectors';
import TreeNode from './TreeNode';
import { computeFamilyTreeLayout } from '../../../utils/familyTreeLayout';
import { hapticLight, hapticMedium } from '../../../utils/haptics';
import { createThemedStyles, useAppTheme } from '../../theme';

const MIN_SCALE = 0.5;
const MAX_SCALE = 2.5;

function distance(touches) {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export default function FamilyTreeCanvas({ members, relationships, getRelationshipLabel, onNodePress, onQuickAdd, currentUserId }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const layout = useMemo(() => computeFamilyTreeLayout(members, relationships), [members, relationships]);

  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(1)).current;

  const base = useRef({ x: 0, y: 0, scale: 1 });
  const lastDistance = useRef(null);
  const atScaleLimit = useRef(false);
  const initialized = useRef(false);

  const initialOffset = useMemo(() => {
    if (!viewport.width || !layout.width) return { x: 0, y: 0 };
    const x = layout.width < viewport.width ? (viewport.width - layout.width) / 2 : 24;
    const y = 32;
    return { x, y };
  }, [viewport, layout]);

  if (viewport.width && layout.width && !initialized.current) {
    initialized.current = true;
    base.current = { x: initialOffset.x, y: initialOffset.y, scale: 1 };
    translateX.setValue(initialOffset.x);
    translateY.setValue(initialOffset.y);
  }

  const recenter = () => {
    hapticMedium();
    base.current = { x: initialOffset.x, y: initialOffset.y, scale: 1 };
    Animated.parallel([
      Animated.spring(translateX, { toValue: initialOffset.x, useNativeDriver: false, friction: 8 }),
      Animated.spring(translateY, { toValue: initialOffset.y, useNativeDriver: false, friction: 8 }),
      Animated.spring(scale, { toValue: 1, useNativeDriver: false, friction: 8 }),
    ]).start();
  };

  const zoomBy = (factor) => {
    const next = clamp(base.current.scale * factor, MIN_SCALE, MAX_SCALE);
    if (next === base.current.scale) {
      hapticLight();
      return;
    }
    base.current.scale = next;
    hapticLight();
    Animated.spring(scale, { toValue: next, useNativeDriver: false, friction: 8 }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponder: (evt, gesture) => {
        if (evt.nativeEvent.touches.length === 2) return true;
        return Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6;
      },
      onMoveShouldSetPanResponderCapture: (evt, gesture) => {
        if (evt.nativeEvent.touches.length === 2) return true;
        return Math.abs(gesture.dx) > 6 || Math.abs(gesture.dy) > 6;
      },
      onPanResponderGrant: () => {
        lastDistance.current = null;
      },
      onPanResponderMove: (evt, gesture) => {
        const { touches } = evt.nativeEvent;
        if (touches.length === 2) {
          const dist = distance(touches);
          if (lastDistance.current != null) {
            const ratio = dist / lastDistance.current;
            const raw = base.current.scale * ratio;
            const next = clamp(raw, MIN_SCALE, MAX_SCALE);
            if (raw !== next && (next === MIN_SCALE || next === MAX_SCALE)) {
              if (!atScaleLimit.current) hapticLight();
              atScaleLimit.current = true;
            } else {
              atScaleLimit.current = false;
            }
            scale.setValue(next);
          }
          lastDistance.current = dist;
        } else {
          translateX.setValue(base.current.x + gesture.dx);
          translateY.setValue(base.current.y + gesture.dy);
        }
      },
      onPanResponderRelease: (evt, gesture) => {
        if (evt.nativeEvent.touches.length < 2 && lastDistance.current == null) {
          base.current.x += gesture.dx;
          base.current.y += gesture.dy;
        }
        if (lastDistance.current != null) {
          scale.stopAnimation((value) => { base.current.scale = value; });
        }
        lastDistance.current = null;
        atScaleLimit.current = false;
      },
    })
  ).current;

  return (
    <View
      style={styles.flex}
      onLayout={(e) => setViewport({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}
      {...panResponder.panHandlers}
    >
      <Animated.View
        style={{
          transform: [
            { translateX },
            { translateY },
            { scale },
          ],
          transformOrigin: '0 0',
          width: layout.width,
          height: layout.height,
        }}
      >
        <TreeConnectors connectors={layout.connectors} width={layout.width} height={layout.height} />
        {layout.nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            relationshipLabel={getRelationshipLabel?.(node.id)}
            onPress={() => onNodePress?.(node.member)}
            onQuickAdd={onQuickAdd}
            isSelf={!!currentUserId && node.member.userId === currentUserId}
          />
        ))}
      </Animated.View>

      <View style={styles.toolbar} pointerEvents="box-none">
        <AnimatedCard
          style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => zoomBy(1.25)}
          accessibilityLabel="Zoom in"
          scaleDown={0.92}
        >
          <Ionicons name="add" size={20} color={theme.primary} />
        </AnimatedCard>
        <AnimatedCard
          style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={() => zoomBy(0.8)}
          accessibilityLabel="Zoom out"
          scaleDown={0.92}
        >
          <Ionicons name="remove" size={20} color={theme.primary} />
        </AnimatedCard>
        <AnimatedCard
          style={[styles.toolbarBtn, { backgroundColor: theme.card, borderColor: theme.border }]}
          onPress={recenter}
          accessibilityLabel="Recenter tree"
          scaleDown={0.92}
        >
          <Ionicons name="locate-outline" size={20} color={theme.primary} />
        </AnimatedCard>
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ shadow }) =>
  StyleSheet.create({
    flex: {
      flex: 1,
      overflow: 'hidden',
    },
    toolbar: {
      position: 'absolute',
      bottom: 24,
      left: 20,
      gap: 10,
    },
    toolbarBtn: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
  })
);
