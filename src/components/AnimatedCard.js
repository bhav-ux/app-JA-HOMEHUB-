import { useRef } from 'react';
import { Animated, Pressable } from 'react-native';

const SPRING = { tension: 300, friction: 20, useNativeDriver: true };
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function AnimatedCard({
  onPress,
  onLongPress,
  style,
  children,
  scaleDown = 0.97,
  disabled = false,
  accessibilityLabel,
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: scaleDown, ...SPRING }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(scale, { toValue: 1, ...SPRING }).start();
  };

  return (
    <AnimatedPressable
      style={[style, { transform: [{ scale }] }]}
      onPress={disabled ? undefined : onPress}
      onLongPress={disabled ? undefined : onLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
    </AnimatedPressable>
  );
}
