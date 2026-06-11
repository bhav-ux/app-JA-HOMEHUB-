import { StyleSheet, View } from 'react-native';
import { useAppTheme } from '../../theme';

export default function ProgressBar({ progress = 0, color, height = 8, style }) {
  const { theme } = useAppTheme();
  const pct = Math.min(1, Math.max(0, progress));

  return (
    <View style={[styles.track, { height, borderRadius: height / 2, backgroundColor: theme.border }, style]}>
      <View
        style={[
          styles.fill,
          { width: `${pct * 100}%`, height, borderRadius: height / 2, backgroundColor: color || theme.primary },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    minWidth: 4,
  },
});
