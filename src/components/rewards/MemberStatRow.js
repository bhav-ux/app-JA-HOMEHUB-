import { Image, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles } from '../../theme';
import { ACCENT } from './rewardsTheme';
import LevelBadge from './LevelBadge';
import StreakBadge from './StreakBadge';
import PointsPill from './PointsPill';

const AVATAR_PALETTE = [
  '#7B93C8', '#D4896A', '#76A895', '#9E7DC4',
  '#6BA4C4', '#C4956A', '#89B488', '#B07AB0',
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

const RANK_COLORS = { 1: ACCENT.gold, 2: ACCENT.silver, 3: ACCENT.bronze };

export default function MemberStatRow({ member, rank, points, streak, levelInfo, highlight = false }) {
  const styles = useStyles();
  const rankColor = RANK_COLORS[rank];

  return (
    <View style={[styles.row, highlight && styles.rowHighlight]}>
      {rank ? (
        <View style={[styles.rankBadge, rankColor && { backgroundColor: rankColor }]}>
          {rankColor ? (
            <Ionicons name="trophy" size={14} color="#FFFFFF" />
          ) : (
            <Text style={styles.rankText}>{rank}</Text>
          )}
        </View>
      ) : null}

      <View style={[styles.avatarRing, highlight && styles.avatarRingHighlight]}>
        {member?.photoURL ? (
          <Image source={{ uri: member.photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarPlaceholder, { backgroundColor: getAvatarColor(member?.name) }]}>
            <Text style={styles.avatarInitials}>{getInitials(member?.name)}</Text>
          </View>
        )}
      </View>

      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={1}>{member?.name || 'Member'}</Text>
        <View style={styles.badgeRow}>
          {levelInfo ? <LevelBadge level={levelInfo.level} icon={levelInfo.icon} size="sm" /> : null}
          {streak != null ? <StreakBadge streak={streak} size="sm" /> : null}
        </View>
      </View>

      <PointsPill points={points} />
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, spacing, radius }) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.sm,
      borderRadius: radius.md,
    },
    rowHighlight: {
      backgroundColor: ACCENT.levelBg,
    },
    rankBadge: {
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBackground,
    },
    rankText: {
      fontSize: 12,
      fontWeight: '700',
      color: theme.secondaryText,
    },
    avatarRing: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    avatarRingHighlight: {
      borderColor: ACCENT.level,
    },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    avatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarInitials: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    info: {
      flex: 1,
      gap: 4,
    },
    name: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    badgeRow: {
      flexDirection: 'row',
      gap: 6,
    },
  })
);
