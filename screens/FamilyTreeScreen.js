import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebaseConfig';
import AnimatedCard from '../src/components/AnimatedCard';
import FamilyTreeCanvas from '../src/components/familyTree/FamilyTreeCanvas';
import AddFamilyMemberSheet from '../src/components/familyTree/AddFamilyMemberSheet';
import FamilyMemberSheet from '../src/components/familyTree/FamilyMemberSheet';
import {
  ensureSelfMember,
  relationshipLabel,
  subscribeFamilyMembers,
  subscribeRelationships,
} from '../services/familyTreeService';
import { getRelationshipLabelsForMember } from '../utils/familyTreeLayout';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

export default function FamilyTreeScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const user = auth.currentUser;

  const [members, setMembers] = useState([]);
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addVisible, setAddVisible] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  useEffect(() => {
    if (!familyId) { setMembers([]); setLoading(false); return; }
    setLoading(true);
    return subscribeFamilyMembers(
      familyId,
      (data) => { setMembers(data); setLoading(false); },
      () => setLoading(false)
    );
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setRelationships([]); return; }
    return subscribeRelationships(familyId, setRelationships, () => setRelationships([]));
  }, [familyId]);

  useEffect(() => {
    if (!familyId || !user || loading) return;
    ensureSelfMember(familyId, user, members).catch((error) => {
      console.error('[FamilyTreeScreen] Failed to ensure self member', error);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [familyId, user?.uid, loading]);

  const membersById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  const getRelationshipLabel = useCallback(
    (memberId) => {
      const labels = getRelationshipLabelsForMember(memberId, relationships, membersById, relationshipLabel);
      return labels[0] || null;
    },
    [relationships, membersById]
  );

  const selectedMember = selectedMemberId ? membersById.get(selectedMemberId) || null : null;

  const gradientColors = isDark
    ? [theme.background, '#1A2030']
    : ['#F8F8F5', '#EEF1FE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: theme.primary }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: theme.primary }]} />

      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>🌳 Family Tree</Text>
            <Text style={styles.headerSubtitle}>See how everyone is connected</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {!familyId ? (
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to start your tree.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : members.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>🌳</Text>
            <Text style={styles.emptyTitle}>Your tree is just getting started</Text>
            <Text style={styles.emptySubtitle}>
              Add parents, siblings, and relatives — even ones without a HomeHub account — to build a living picture of your family.
            </Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: theme.primary }]}
              onPress={() => setAddVisible(true)}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>Add a family member</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FamilyTreeCanvas
            members={members}
            relationships={relationships}
            getRelationshipLabel={getRelationshipLabel}
            onNodePress={(member) => setSelectedMemberId(member.id)}
          />
        )}
      </SafeAreaView>

      {familyId && members.length > 0 && (
        <AnimatedCard
          style={[styles.fab, { backgroundColor: theme.primary, bottom: insets.bottom + spacing.lg }]}
          onPress={() => setAddVisible(true)}
          accessibilityLabel="Add family member"
          scaleDown={0.92}
        >
          <Ionicons name="add" size={28} color="#FFFFFF" />
        </AnimatedCard>
      )}

      <AddFamilyMemberSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        familyId={familyId}
        members={members}
      />

      <FamilyMemberSheet
        visible={!!selectedMember}
        onClose={() => setSelectedMemberId(null)}
        member={selectedMember}
        members={members}
        relationships={relationships}
        relationshipCaption={selectedMember ? getRelationshipLabel(selectedMember.id) : null}
        familyId={familyId}
        navigation={navigation}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    blob: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.06,
    },
    blobTop: {
      width: 320,
      height: 320,
      top: -120,
      right: -100,
    },
    blobBottom: {
      width: 360,
      height: 360,
      bottom: -160,
      left: -120,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    backBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSpacer: {
      width: 40,
    },
    headerTextWrap: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    headerSubtitle: {
      marginTop: 2,
      fontSize: 12,
      color: theme.secondaryText,
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
    },
    emptyEmoji: {
      fontSize: 44,
      marginBottom: spacing.sm,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
      marginTop: spacing.sm,
    },
    emptySubtitle: {
      marginTop: 6,
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: 'center',
      lineHeight: 19,
      maxWidth: 300,
    },
    emptyCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.lg,
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderRadius: 24,
      ...shadow,
    },
    emptyCtaText: {
      fontSize: 14,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
  })
);
