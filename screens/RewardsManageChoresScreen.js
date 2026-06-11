import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebaseConfig';
import AnimatedCard from '../src/components/AnimatedCard';
import ChoreFormSheet from '../src/components/rewards/ChoreFormSheet';
import PointsPill from '../src/components/rewards/PointsPill';
import { ACCENT } from '../src/components/rewards/rewardsTheme';
import { frequencyLabel, subscribeChores, updateChore, verificationLabel } from '../services/rewardsService';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import { useFamilyRole, isApproverRole } from '../hooks/useFamilyRole';
import { hapticLight } from '../utils/haptics';
import { showAlert } from '../utils/dialogs';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

export default function RewardsManageChoresScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const uid = auth.currentUser?.uid;

  const role = useFamilyRole(familyId, uid);
  const canManage = isApproverRole(role);
  const members = useFamilyMemberProfiles(familyId);

  const [chores, setChores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formVisible, setFormVisible] = useState(false);
  const [editingChore, setEditingChore] = useState(null);
  const [togglingId, setTogglingId] = useState(null);

  useEffect(() => {
    if (!familyId) { setChores([]); setLoading(false); return; }
    setLoading(true);
    return subscribeChores(familyId, (data) => { setChores(data); setLoading(false); }, () => setLoading(false));
  }, [familyId]);

  const sortedChores = useMemo(() => {
    return [...chores].sort((a, b) => {
      if ((a.active !== false) !== (b.active !== false)) return a.active === false ? 1 : -1;
      return (a.title || '').localeCompare(b.title || '');
    });
  }, [chores]);

  const handleToggleActive = async (chore, value) => {
    if (togglingId) return;
    hapticLight();
    setTogglingId(chore.id);
    try {
      await updateChore(familyId, chore.id, { active: value });
    } catch (error) {
      console.error('[RewardsManageChoresScreen] Failed to toggle chore', error);
      showAlert('Error', 'Could not update this chore. Please try again.');
    } finally {
      setTogglingId(null);
    }
  };

  const assigneeLabel = (chore) => {
    if (!chore.assignedTo?.length) return 'Everyone';
    const names = chore.assignedTo
      .map((id) => members.find((m) => m.uid === id)?.name)
      .filter(Boolean);
    return names.length ? names.join(', ') : `${chore.assignedTo.length} member${chore.assignedTo.length === 1 ? '' : 's'}`;
  };

  const gradientColors = isDark
    ? [theme.background, '#1E2620']
    : ['#FBF6EC', '#F2F8EE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: ACCENT.level }]} />

      <SafeAreaView style={styles.flex} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              hapticLight();
              if (navigation.canGoBack()) navigation.goBack();
              else navigation.navigate('MainTabs');
            }}
            style={styles.headerBtn}
            accessibilityLabel="Go back"
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="chevron-back" size={24} color={theme.text} />
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.headerTitle}>📋 Manage Chores</Text>
            <Text style={styles.headerSubtitle}>Create and edit family chores</Text>
          </View>
          {canManage ? (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setEditingChore(null);
                setFormVisible(true);
              }}
              style={styles.headerBtn}
              accessibilityLabel="Add chore"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="add-circle-outline" size={24} color={theme.text} />
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {!familyId ? (
          <View style={styles.centered}>
            <Ionicons name="list-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to manage chores.</Text>
          </View>
        ) : !canManage ? (
          <View style={styles.centered}>
            <Ionicons name="lock-closed-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>Parents only</Text>
            <Text style={styles.emptySubtitle}>Only family owners and admins can manage chores.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ACCENT.level} />
          </View>
        ) : sortedChores.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>No chores yet</Text>
            <Text style={styles.emptySubtitle}>Add your first chore to start the family rewards system.</Text>
            <TouchableOpacity
              style={[styles.emptyCta, { backgroundColor: ACCENT.level }]}
              onPress={() => { setEditingChore(null); setFormVisible(true); }}
            >
              <Ionicons name="add" size={18} color="#FFFFFF" />
              <Text style={styles.emptyCtaText}>Add a chore</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
          >
            <View style={styles.list}>
              {sortedChores.map((chore) => (
                <AnimatedCard
                  key={chore.id}
                  style={[styles.choreCard, chore.active === false && styles.choreCardInactive]}
                  onPress={() => { setEditingChore(chore); setFormVisible(true); }}
                  accessibilityLabel={`Edit ${chore.title}`}
                  scaleDown={0.99}
                >
                  <View style={styles.choreRow}>
                    <View style={styles.iconCircle}>
                      <Ionicons name={chore.icon || 'checkmark-circle-outline'} size={20} color={ACCENT.level} />
                    </View>
                    <View style={styles.choreInfo}>
                      <Text style={styles.choreTitle} numberOfLines={1}>{chore.title}</Text>
                      <Text style={styles.choreMeta} numberOfLines={1}>
                        {frequencyLabel(chore.frequency)} · {verificationLabel(chore.verification)}
                      </Text>
                      <Text style={styles.choreAssignees} numberOfLines={1}>{assigneeLabel(chore)}</Text>
                    </View>
                    <View style={styles.choreActions}>
                      <PointsPill points={chore.points} size="sm" />
                      <Switch
                        value={chore.active !== false}
                        onValueChange={(value) => handleToggleActive(chore, value)}
                        trackColor={{ true: ACCENT.level, false: theme.border }}
                        thumbColor="#FFFFFF"
                        disabled={togglingId === chore.id}
                      />
                    </View>
                  </View>
                </AnimatedCard>
              ))}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <ChoreFormSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        familyId={familyId}
        chore={editingChore}
        members={members}
        uid={uid}
      />
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow, radius }) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    blob: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.08,
    },
    blobTop: {
      width: 320,
      height: 320,
      top: -120,
      right: -100,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.sm,
    },
    headerBtn: {
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
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    list: {
      gap: spacing.sm,
    },
    choreCard: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      ...shadow,
    },
    choreCardInactive: {
      opacity: 0.55,
    },
    choreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.levelBg,
    },
    choreInfo: {
      flex: 1,
      gap: 2,
    },
    choreTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    choreMeta: {
      fontSize: 11,
      color: theme.secondaryText,
    },
    choreAssignees: {
      fontSize: 11,
      color: theme.secondaryText,
      fontStyle: 'italic',
    },
    choreActions: {
      alignItems: 'center',
      gap: 6,
    },
  })
);
