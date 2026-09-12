import { Image, StyleSheet, Text, View } from 'react-native';
import { createThemedStyles } from '../../theme';

const AVATAR_COLORS = [
  '#6366F1', '#F43F5E', '#F59E0B', '#0D9488',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

function getAvatarColor(seed) {
  if (!seed) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  return parts.length === 1
    ? parts[0].charAt(0).toUpperCase()
    : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * Circular avatar: photo (`uri`) > `emoji` > initials from `name`, colored by
 * `seed` (falls back to `name`) so the same person/chat always gets the same color.
 */
export default function HomeHubAvatar({ uri, name, emoji, seed, size = 44, status, style }) {
  const styles = useStyles();
  const bg = getAvatarColor(seed || name || '');
  const dim = { width: size, height: size, borderRadius: size / 2 };

  return (
    <View style={[dim, style]}>
      {uri ? (
        <Image source={{ uri }} style={[dim, styles.image]} />
      ) : (
        <View style={[dim, styles.fallback, { backgroundColor: bg }]}>
          <Text style={{ fontSize: emoji ? size * 0.5 : size * 0.38, color: '#fff', fontWeight: '700' }}>
            {emoji || getInitials(name)}
          </Text>
        </View>
      )}
      {status ? (
        <View
          style={[
            styles.statusDot,
            {
              width: Math.max(10, size * 0.26),
              height: Math.max(10, size * 0.26),
              borderRadius: Math.max(5, size * 0.13),
              backgroundColor: status === 'online' ? '#22C55E' : styles.statusOffline.backgroundColor,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    image: { resizeMode: 'cover' },
    fallback: { alignItems: 'center', justifyContent: 'center' },
    statusDot: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      borderWidth: 2,
      borderColor: theme.card,
    },
    statusOffline: { backgroundColor: theme.secondaryText },
  })
);
