import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

function run(fn) {
  if (Platform.OS === 'web') return;
  fn().catch(() => {});
}

export function hapticSelection() {
  run(() => Haptics.selectionAsync());
}

export function hapticImpact(style = Haptics.ImpactFeedbackStyle.Light) {
  run(() => Haptics.impactAsync(style));
}

export function hapticLight() {
  hapticImpact(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticMedium() {
  hapticImpact(Haptics.ImpactFeedbackStyle.Medium);
}
