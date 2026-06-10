import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AnimatedCard from '../AnimatedCard';
import { createThemedStyles, useAppTheme } from '../../theme';
import { CARD_HEIGHT, CARD_WIDTH, NODE_SIZE } from '../../../utils/familyTreeLayout';

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

export default function TreeNode({ node, relationshipLabel, onPress, onQuickAdd, isSelf = false, compact = false, style }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const { member } = node;
  const size = compact ? 44 : NODE_SIZE;
  const ringColor = isSelf ? theme.primary : getAvatarColor(member.name);

  return (
    <View
      style={[
        styles.wrap,
        { left: node.x, top: node.y, width: CARD_WIDTH, height: compact ? size + 38 : CARD_HEIGHT },
        style,
      ]}
    >
      <AnimatedCard onPress={onPress} accessibilityLabel={`Open ${member.name}`} scaleDown={0.95}>
        <View style={styles.content}>
          <View
            style={[
              styles.photoRing,
              {
                width: size + 6,
                height: size + 6,
                borderRadius: (size + 6) / 2,
                borderColor: ringColor,
              },
            ]}
          >
            <View
              style={[
                styles.photoWrap,
                { width: size, height: size, borderRadius: size / 2 },
                member.isPlaceholder && styles.photoWrapPlaceholder,
              ]}
            >
              {member.photoURL ? (
                <Image source={{ uri: member.photoURL }} style={styles.photo} />
              ) : (
                <View style={[styles.initialsCircle, { backgroundColor: getAvatarColor(member.name) }]}>
                  <Text style={[styles.initialsText, { fontSize: size * 0.36 }]}>
                    {getInitials(member.name)}
                  </Text>
                </View>
              )}
              {member.isPlaceholder && (
                <View style={[styles.badge, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Ionicons name="person-add-outline" size={10} color={theme.secondaryText} />
                </View>
              )}
            </View>
          </View>
          <Text style={[styles.name, compact && styles.nameCompact]} numberOfLines={1}>
            {member.name}
          </Text>
          {!compact ? (
            <Text style={styles.relationship} numberOfLines={1}>
              {isSelf ? 'You' : relationshipLabel || ' '}
            </Text>
          ) : null}
        </View>
      </AnimatedCard>

      {!compact && onQuickAdd ? (
        <TouchableOpacity
          style={[styles.quickAdd, { backgroundColor: theme.primary, borderColor: theme.card }]}
          onPress={() => onQuickAdd(member)}
          accessibilityLabel={`Add a relative of ${member.name}`}
          hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
        >
          <Ionicons name="add" size={14} color="#FFFFFF" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    wrap: {
      position: 'absolute',
      alignItems: 'center',
    },
    content: {
      alignItems: 'center',
      width: '100%',
    },
    photoRing: {
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      backgroundColor: theme.card,
      ...shadow,
    },
    photoWrap: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
    },
    photoWrapPlaceholder: {
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
    },
    photo: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
    },
    initialsCircle: {
      width: '100%',
      height: '100%',
      borderRadius: 999,
      alignItems: 'center',
      justifyContent: 'center',
    },
    initialsText: {
      fontWeight: '700',
      color: '#FFFFFF',
      letterSpacing: 0.3,
    },
    badge: {
      position: 'absolute',
      bottom: -2,
      right: -2,
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
    name: {
      marginTop: 8,
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      letterSpacing: -0.1,
      maxWidth: CARD_WIDTH,
    },
    nameCompact: {
      fontSize: 11,
      marginTop: 6,
    },
    relationship: {
      marginTop: 2,
      fontSize: 11,
      color: theme.secondaryText,
      textAlign: 'center',
      maxWidth: CARD_WIDTH,
    },
    quickAdd: {
      position: 'absolute',
      top: -4,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
  })
);
