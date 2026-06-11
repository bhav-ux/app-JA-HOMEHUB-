import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebaseConfig';
import MemberStatRow from '../src/components/rewards/MemberStatRow';
import { ACCENT } from '../src/components/rewards/rewardsTheme';
import { subscribeSubmissions, subscribeUserStats } from '../services/rewardsService';
import { getLevelInfo } from '../utils/rewardsLevels';
import { computeWeeklyPointsByUser } from '../utils/rewardsStats';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import { hapticLight, hapticSelection } from '../utils/haptics';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

const TABS = [
  { value: 'weekly', label: 'This Week' },
  { value: 'alltime', label: 'All-Time' },
];

export default function RewardsLeaderboardScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const uid = auth.currentUser?.uid;

  const members = useFamilyMemberProfiles(familyId);
  const [submissions, setSubmissions] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('weekly');

  useEffect(() => {
    if (!familyId) { setSubmissions([]); setLoading(false); return; }
    setLoading(true);
    return subscribeSubmissions(familyId, (data) => { setSubmissions(data); setLoading(false); }, () => setLoading(false));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setUserStats([]); return; }
    return subscribeUserStats(familyId, setUserStats, () => setUserStats([]));
  }, [familyId]);

  const weeklyTotals = useMemo(() => computeWeeklyPointsByUser(submissions), [submissions]);

  const ranked = useMemo(() => {
    return members
      .map((member) => {
        const stats = userStats.find((s) => s.id === member.uid);
        const points = tab === 'weekly' ? (weeklyTotals.get(member.uid) || 0) : (stats?.lifetimePoints || 0);
        return {
          member,
          points,
          streak: stats?.streak || 0,
          levelInfo: getLevelInfo(stats?.lifetimePoints || 0),
        };
      })
      .sort((a, b) => b.points - a.points);
  }, [members, userStats, weeklyTotals, tab]);

  const gradientColors = isDark
    ? [theme.background, '#1E2620']
    : ['#FBF6EC', '#F2F8EE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: ACCENT.gold }]} />

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
            <Text style={styles.headerTitle}>🏅 Leaderboard</Text>
            <Text style={styles.headerSubtitle}>See who's leading the pack</Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.tabRow}>
          {TABS.map((t) => {
            const active = tab === t.value;
            return (
              <TouchableOpacity
                key={t.value}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => {
                  hapticSelection();
                  setTab(t.value);
                }}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {!familyId ? (
          <View style={styles.centered}>
            <Ionicons name="trophy-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to see the leaderboard.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ACCENT.level} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
          >
            {ranked.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyCardEmoji}>🌱</Text>
                <Text style={styles.emptyTitle}>No rankings yet</Text>
                <Text style={styles.emptySubtitle}>Complete chores to climb the leaderboard.</Text>
              </View>
            ) : (
              <View style={styles.listCard}>
                {ranked.map((entry, index) => (
                  <View
                    key={entry.member.uid}
                    style={index < ranked.length - 1 ? styles.rowDivider : null}
                  >
                    <MemberStatRow
                      member={entry.member}
                      rank={index + 1}
                      points={entry.points}
                      streak={entry.streak}
                      levelInfo={entry.levelInfo}
                      highlight={entry.member.uid === uid}
                    />
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
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
    tabRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.md,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: radius.md,
      backgroundColor: theme.card,
      ...shadow,
    },
    tabActive: {
      backgroundColor: ACCENT.level,
    },
    tabText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    tabTextActive: {
      color: '#FFFFFF',
    },
    centered: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.xl,
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
    scrollContent: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.xs,
    },
    listCard: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.sm,
      ...shadow,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    emptyCard: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      alignItems: 'center',
      ...shadow,
    },
    emptyCardEmoji: {
      fontSize: 32,
      marginBottom: 6,
    },
  })
);
