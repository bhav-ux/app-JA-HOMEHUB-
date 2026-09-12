import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedCard from '../src/components/AnimatedCard';
import { ACCENT } from '../src/components/rewards/rewardsTheme';
import { subscribeRedemptions, subscribeSubmissions } from '../services/rewardsService';
import { subscribeFamilyMembers } from '../services/familyTreeService';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import { toJsDate } from '../utils/dateKeys';
import { hapticLight } from '../utils/haptics';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

function getDayLabel(date) {
  const now = new Date();
  const diff = Math.floor(
    (new Date(now.getFullYear(), now.getMonth(), now.getDate()) -
      new Date(date.getFullYear(), date.getMonth(), date.getDate())) /
      86400000
  );
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return date.toLocaleDateString([], { weekday: 'long' });
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function getTimeLabel(date) {
  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function TimelineScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;

  const members = useFamilyMemberProfiles(familyId);
  const memberMap = useMemo(() => new Map(members.map((m) => [m.uid, m])), [members]);

  const [submissions, setSubmissions] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!familyId) { setSubmissions([]); setLoading(false); return; }
    setLoading(true);
    return subscribeSubmissions(familyId, (data) => { setSubmissions(data); setLoading(false); }, () => setLoading(false));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setRedemptions([]); return; }
    return subscribeRedemptions(familyId, setRedemptions, () => setRedemptions([]));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setFamilyMembers([]); return; }
    return subscribeFamilyMembers(familyId, setFamilyMembers, () => setFamilyMembers([]));
  }, [familyId]);

  const items = useMemo(() => {
    const list = [];

    submissions
      .filter((s) => s.status === 'approved')
      .forEach((s) => {
        const date = toJsDate(s.reviewedAt) || toJsDate(s.submittedAt);
        if (!date) return;
        const name = memberMap.get(s.userId)?.name || 'Someone';
        list.push({
          id: `chore-${s.id}`,
          date,
          icon: s.choreIcon || 'checkmark-circle-outline',
          iconColor: ACCENT.level,
          iconBg: ACCENT.levelBg,
          text: `${name} completed ${s.choreTitle}`,
          meta: `+${s.points} points`,
          onPress: () => navigation.navigate('RewardsHome', { familyId }),
        });
      });

    redemptions.forEach((r) => {
      const date = toJsDate(r.redeemedAt);
      if (!date) return;
      const name = memberMap.get(r.userId)?.name || 'Someone';
      list.push({
        id: `redeem-${r.id}`,
        date,
        icon: r.rewardIcon || 'gift-outline',
        iconColor: ACCENT.streak,
        iconBg: ACCENT.streakBg,
        text: `${name} redeemed ${r.rewardTitle}`,
        meta: `-${r.cost} points`,
        onPress: () => navigation.navigate('RewardsShop', { familyId }),
      });
    });

    familyMembers.forEach((m) => {
      const date = toJsDate(m.createdAt);
      if (!date) return;
      list.push({
        id: `member-${m.id}`,
        date,
        icon: 'person-add-outline',
        iconColor: theme.primary,
        iconBg: theme.primaryLight,
        text: m.userId ? `${m.name} joined the family` : `${m.name} was added to the family tree`,
        meta: null,
        onPress: () => navigation.navigate('FamilyTree', { familyId }),
      });
    });

    return list.sort((a, b) => b.date - a.date);
  }, [submissions, redemptions, familyMembers, memberMap, navigation, familyId, theme]);

  const sections = useMemo(() => {
    const groups = [];
    let current = null;
    items.forEach((item) => {
      const label = getDayLabel(item.date);
      if (!current || current.label !== label) {
        current = { label, items: [] };
        groups.push(current);
      }
      current.items.push(item);
    });
    return groups;
  }, [items]);

  const gradientColors = isDark
    ? [theme.background, '#1E2620']
    : ['#FBF6EC', '#F2F8EE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: theme.primary }]} />

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
            <Text style={styles.headerTitle}>🕓 Family Timeline</Text>
            <Text style={styles.headerSubtitle}>Moments that matter</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        {!familyId ? (
          <View style={styles.centered}>
            <Ionicons name="time-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to start building your timeline.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : sections.length === 0 ? (
          <View style={styles.centered}>
            <Text style={styles.emptyEmoji}>🌱</Text>
            <Text style={styles.emptyTitle}>Nothing here yet</Text>
            <Text style={styles.emptySubtitle}>
              Completed chores, redeemed rewards, and new family members will show up here.
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
          >
            {sections.map((section) => (
              <View key={section.label} style={styles.section}>
                <Text style={styles.sectionLabel}>{section.label}</Text>
                <View style={styles.card}>
                  {section.items.map((item, index) => (
                    <AnimatedCard
                      key={item.id}
                      onPress={item.onPress}
                      accessibilityLabel={item.text}
                      scaleDown={0.98}
                    >
                      <View style={[styles.row, index < section.items.length - 1 && styles.rowDivider]}>
                        <View style={[styles.iconCircle, { backgroundColor: item.iconBg }]}>
                          <Ionicons name={item.icon} size={16} color={item.iconColor} />
                        </View>
                        <View style={styles.rowBody}>
                          <Text style={styles.rowText} numberOfLines={2}>{item.text}</Text>
                          <View style={styles.rowMetaRow}>
                            <Text style={styles.rowTime}>{getTimeLabel(item.date)}</Text>
                            {item.meta ? (
                              <>
                                <Text style={styles.rowMetaDot}>·</Text>
                                <Text style={[styles.rowMeta, { color: item.iconColor }]}>{item.meta}</Text>
                              </>
                            ) : null}
                          </View>
                        </View>
                      </View>
                    </AnimatedCard>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow, radius }) =>
  StyleSheet.create({
    flex: { flex: 1 },
    blob: {
      position: 'absolute',
      borderRadius: 9999,
      opacity: 0.06,
      width: 320,
      height: 320,
    },
    blobTop: { top: -120, right: -100 },
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
    headerSpacer: { width: 40 },
    headerTextWrap: { flex: 1, alignItems: 'center' },
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
    emptyEmoji: { fontSize: 44, marginBottom: spacing.sm },
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
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    section: { marginBottom: spacing.lg },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.secondaryText,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      paddingHorizontal: spacing.sm,
      ...shadow,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.xs,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    iconCircle: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      marginTop: 1,
    },
    rowBody: { flex: 1 },
    rowText: {
      fontSize: 14,
      color: theme.text,
      lineHeight: 19,
      fontWeight: '500',
    },
    rowMetaRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      marginTop: 3,
    },
    rowTime: {
      fontSize: 11,
      color: theme.secondaryText,
    },
    rowMetaDot: {
      fontSize: 11,
      color: theme.secondaryText,
    },
    rowMeta: {
      fontSize: 11,
      fontWeight: '700',
    },
  })
);
