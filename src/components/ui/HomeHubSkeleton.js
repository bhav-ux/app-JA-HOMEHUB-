import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { createThemedStyles, radius } from '../../theme';

/**
 * Simple shimmering placeholder block for loading states (replaces bare
 * ActivityIndicator spinners with a shape that hints at incoming content).
 */
export default function HomeHubSkeleton({ width = '100%', height = 16, borderRadius = radius.sm, style }) {
  const styles = useStyles();
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 650, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 650, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[styles.base, { width, height, borderRadius, opacity }, style]}
    />
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    base: { backgroundColor: theme.inputBackground },
  })
);
