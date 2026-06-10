import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TreeConnectors from './TreeConnectors';
import TreeNode from './TreeNode';
import { computeFamilyTreeLayout } from '../../../utils/familyTreeLayout';
import { createThemedStyles, useAppTheme } from '../../theme';

const SCALE = 0.46;

function sortKey(member) {
  const ts = member.createdAt;
  if (ts?.toMillis) return ts.toMillis();
  if (typeof ts?.seconds === 'number') return ts.seconds * 1000;
  return Number.MAX_SAFE_INTEGER;
}

// Picks the current user's immediate family (parents, spouse, children) so the
// preview mirrors the spec mockup: parent(s) on top, self + spouse in the
// middle, children below.
function buildPreviewSubset(members, relationships, currentUserId) {
  const membersById = new Map(members.map((m) => [m.id, m]));
  const anchor =
    members.find((m) => m.userId === currentUserId) ||
    [...members].sort((a, b) => sortKey(a) - sortKey(b))[0];

  if (!anchor) return { members: [], relationships: [] };

  const parents = [];
  const children = [];
  let spouse = null;

  (relationships || []).forEach((rel) => {
    if (!membersById.has(rel.fromMemberId) || !membersById.has(rel.toMemberId)) return;
    if ((rel.type === 'father' || rel.type === 'mother') && rel.toMemberId === anchor.id) {
      parents.push(membersById.get(rel.fromMemberId));
    } else if ((rel.type === 'son' || rel.type === 'daughter') && rel.toMemberId === anchor.id) {
      children.push(membersById.get(rel.fromMemberId));
    } else if (rel.type === 'spouse' && !spouse) {
      if (rel.fromMemberId === anchor.id) spouse = membersById.get(rel.toMemberId);
      else if (rel.toMemberId === anchor.id) spouse = membersById.get(rel.fromMemberId);
    }
  });

  let subsetMembers = [anchor, ...parents.slice(0, 2), ...(spouse ? [spouse] : []), ...children.slice(0, 3)];

  if (subsetMembers.length === 1) {
    const others = members.filter((m) => m.id !== anchor.id).slice(0, 3);
    subsetMembers = [anchor, ...others];
  }

  const ids = new Set(subsetMembers.map((m) => m.id));
  const subsetRelationships = (relationships || []).filter(
    (rel) => ids.has(rel.fromMemberId) && ids.has(rel.toMemberId)
  );

  return { members: subsetMembers, relationships: subsetRelationships };
}

export default function MiniFamilyTree({ members, relationships, currentUserId }) {
  const { theme } = useAppTheme();
  const styles = useStyles();

  const subset = useMemo(
    () => buildPreviewSubset(members || [], relationships || [], currentUserId),
    [members, relationships, currentUserId]
  );

  const layout = useMemo(
    () => computeFamilyTreeLayout(subset.members, subset.relationships),
    [subset]
  );

  if (!members || members.length < 2) {
    return (
      <View style={styles.empty}>
        <View style={[styles.emptyIcon, { backgroundColor: theme.primary + '1A' }]}>
          <Ionicons name="people-outline" size={22} color={theme.primary} />
        </View>
        <Text style={styles.emptyTitle}>Start building your family tree</Text>
        <Text style={styles.emptySubtitle}>
          Add parents, siblings and more to see how everyone connects.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { height: layout.height * SCALE }]} pointerEvents="none">
      <View
        style={{
          width: layout.width,
          height: layout.height,
          transform: [{ scale: SCALE }],
        }}
      >
        <TreeConnectors connectors={layout.connectors} width={layout.width} height={layout.height} />
        {layout.nodes.map((node) => (
          <TreeNode key={node.id} node={node} compact />
        ))}
      </View>
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, spacing }) =>
  StyleSheet.create({
    wrap: {
      width: '100%',
      overflow: 'hidden',
      alignItems: 'center',
      justifyContent: 'center',
    },
    empty: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.md,
    },
    emptyIcon: {
      width: 44,
      height: 44,
      borderRadius: 22,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 10,
    },
    emptyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    emptySubtitle: {
      marginTop: 4,
      fontSize: 12,
      color: theme.secondaryText,
      textAlign: 'center',
      maxWidth: 240,
    },
  })
);
