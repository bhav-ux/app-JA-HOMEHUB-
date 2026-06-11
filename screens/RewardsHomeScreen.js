import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { auth } from '../firebaseConfig';
import AnimatedCard from '../src/components/AnimatedCard';
import ProgressBar from '../src/components/rewards/ProgressBar';
import LevelBadge from '../src/components/rewards/LevelBadge';
import StreakBadge from '../src/components/rewards/StreakBadge';
import PointsPill from '../src/components/rewards/PointsPill';
import ChoreCard from '../src/components/rewards/ChoreCard';
import MemberStatRow from '../src/components/rewards/MemberStatRow';
import RewardCard from '../src/components/rewards/RewardCard';
import { ACCENT } from '../src/components/rewards/rewardsTheme';
import {
  getEmptyStats,
  getPeriodKey,
  getSubmissionId,
  redeemReward,
  subscribeChores,
  subscribeRedemptions,
  subscribeRewards,
  subscribeSubmissions,
  subscribeUserStats,
  submitChore,
  uploadChoreProof,
} from '../services/rewardsService';
import { getLevelInfo } from '../utils/rewardsLevels';
import { computeWeeklyPointsByUser } from '../utils/rewardsStats';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import { useFamilyRole, isApproverRole } from '../hooks/useFamilyRole';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { showAlert } from '../utils/dialogs';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

const STATUS_PRIORITY = { rejected: 0, none: 0, pending: 1, approved: 2 };

export default function RewardsHomeScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const user = auth.currentUser;
  const uid = user?.uid;

  const role = useFamilyRole(familyId, uid);
  const canManage = isApproverRole(role);
  const members = useFamilyMemberProfiles(familyId);

  const [chores, setChores] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [redeemingId, setRedeemingId] = useState(null);
  const [menuVisible, setMenuVisible] = useState(false);

  useEffect(() => {
    if (!familyId) { setChores([]); setLoading(false); return; }
    setLoading(true);
    return subscribeChores(familyId, (data) => { setChores(data); setLoading(false); }, () => setLoading(false));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setSubmissions([]); return; }
    return subscribeSubmissions(familyId, setSubmissions, () => setSubmissions([]));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setUserStats([]); return; }
    return subscribeUserStats(familyId, setUserStats, () => setUserStats([]));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setRewards([]); return; }
    return subscribeRewards(familyId, setRewards, () => setRewards([]));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) return;
    return subscribeRedemptions(familyId, () => {}, () => {});
  }, [familyId]);

  const submissionsById = useMemo(() => new Map(submissions.map((s) => [s.id, s])), [submissions]);
  const weeklyTotals = useMemo(() => computeWeeklyPointsByUser(submissions), [submissions]);
  const pendingCount = useMemo(() => submissions.filter((s) => s.status === 'pending').length, [submissions]);

  const myStats = useMemo(() => userStats.find((s) => s.id === uid) || getEmptyStats(uid), [userStats, uid]);
  const levelInfo = useMemo(() => getLevelInfo(myStats.lifetimePoints), [myStats.lifetimePoints]);
  const myWeeklyPoints = weeklyTotals.get(uid) || 0;

  const myChores = useMemo(() => {
    const items = chores
      .filter((c) => c.active !== false && (!c.assignedTo?.length || c.assignedTo.includes(uid)))
      .map((chore) => {
        const periodKey = getPeriodKey(chore.frequency);
        const submissionId = getSubmissionId(chore.id, uid, periodKey);
        return { chore, submission: submissionsById.get(submissionId) };
      });
    items.sort((a, b) => {
      const pa = STATUS_PRIORITY[a.submission?.status || 'none'];
      const pb = STATUS_PRIORITY[b.submission?.status || 'none'];
      return pa - pb;
    });
    return items;
  }, [chores, submissionsById, uid]);

  const doneCount = myChores.filter((i) => i.submission?.status === 'approved').length;

  const leaderboardPreview = useMemo(() => {
    return members
      .map((member) => {
        const stats = userStats.find((s) => s.id === member.uid);
        return {
          member,
          points: weeklyTotals.get(member.uid) || 0,
          streak: stats?.streak || 0,
          levelInfo: getLevelInfo(stats?.lifetimePoints || 0),
        };
      })
      .sort((a, b) => b.points - a.points)
      .slice(0, 3);
  }, [members, userStats, weeklyTotals]);

  const shopPreview = useMemo(
    () => rewards.filter((r) => r.active !== false).sort((a, b) => a.cost - b.cost).slice(0, 2),
    [rewards]
  );

  const handleSubmitChore = async (chore) => {
    if (!familyId || !uid || submittingId) return;
    hapticLight();

    if (chore.verification === 'photo') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission needed', 'Allow photo library access to attach proof.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) return;

      setSubmittingId(chore.id);
      try {
        const periodKey = getPeriodKey(chore.frequency);
        const submissionId = getSubmissionId(chore.id, uid, periodKey);
        const photoURL = await uploadChoreProof(uri, familyId, submissionId);
        await submitChore(familyId, chore, uid, { photoURL });
        hapticMedium();
        showAlert('Submitted!', 'Your photo proof was sent for review.');
      } catch (error) {
        console.error('[RewardsHomeScreen] Failed to submit chore with photo', error);
        showAlert('Error', error.message || 'Could not submit this chore. Please try again.');
      } finally {
        setSubmittingId(null);
      }
      return;
    }

    setSubmittingId(chore.id);
    try {
      await submitChore(familyId, chore, uid);
      hapticMedium();
      if (chore.verification === 'auto') {
        showAlert('Nice work! 🎉', `You earned +${chore.points} points.`);
      } else {
        showAlert('Submitted!', 'Waiting for a parent to approve.');
      }
    } catch (error) {
      console.error('[RewardsHomeScreen] Failed to submit chore', error);
      showAlert('Error', error.message || 'Could not submit this chore. Please try again.');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleRedeem = async (reward) => {
    if (!familyId || !uid || redeemingId) return;
    hapticLight();
    setRedeemingId(reward.id);
    try {
      await redeemReward(familyId, reward, uid);
      hapticMedium();
      showAlert('Redeemed!', `${reward.title} is on its way. A parent will follow up.`);
    } catch (error) {
      console.error('[RewardsHomeScreen] Failed to redeem reward', error);
      showAlert('Error', error.message || 'Could not redeem this reward. Please try again.');
    } finally {
      setRedeemingId(null);
    }
  };

  const gradientColors = isDark
    ? [theme.background, '#1E2620']
    : ['#FBF6EC', '#F2F8EE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: ACCENT.level }]} />
      <View style={[styles.blob, styles.blobBottom, { backgroundColor: ACCENT.streak }]} />

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
            <Text style={styles.headerTitle}>🏆 Family Rewards</Text>
            <Text style={styles.headerSubtitle}>Earn points, level up, redeem rewards</Text>
          </View>
          {canManage ? (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setMenuVisible((v) => !v);
              }}
              style={styles.headerBtn}
              accessibilityLabel="Manage rewards"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="ellipsis-horizontal" size={22} color={theme.text} />
              {pendingCount > 0 ? <View style={styles.headerDot} /> : null}
            </TouchableOpacity>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {menuVisible && (
          <>
            <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setMenuVisible(false)} />
            <View style={[styles.menu, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('RewardsVerification', { familyId });
                }}
              >
                <Ionicons name="checkmark-done-outline" size={18} color={theme.text} />
                <Text style={styles.menuItemText}>Verification Queue</Text>
                {pendingCount > 0 ? (
                  <View style={styles.menuBadge}>
                    <Text style={styles.menuBadgeText}>{pendingCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('RewardsManageChores', { familyId });
                }}
              >
                <Ionicons name="list-outline" size={18} color={theme.text} />
                <Text style={styles.menuItemText}>Manage Chores</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.menuItem}
                onPress={() => {
                  setMenuVisible(false);
                  navigation.navigate('RewardsShop', { familyId });
                }}
              >
                <Ionicons name="gift-outline" size={18} color={theme.text} />
                <Text style={styles.menuItemText}>Manage Rewards</Text>
              </TouchableOpacity>
            </View>
          </>
        )}

        {!familyId ? (
          <View style={styles.centered}>
            <Ionicons name="trophy-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to start earning rewards.</Text>
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
            {/* Hero */}
            <View style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View>
                  <Text style={styles.heroEyebrow}>YOUR LEVEL</Text>
                  <View style={styles.heroLevelRow}>
                    <Text style={styles.heroLevelIcon}>{levelInfo.icon}</Text>
                    <Text style={styles.heroLevelTitle}>{levelInfo.title}</Text>
                    <LevelBadge level={levelInfo.level} icon={levelInfo.icon} />
                  </View>
                </View>
                <View style={styles.heroBalance}>
                  <Text style={styles.heroBalanceValue}>{myStats.balance || 0}</Text>
                  <Text style={styles.heroBalanceLabel}>points balance</Text>
                </View>
              </View>

              <View style={styles.heroProgressWrap}>
                <ProgressBar progress={levelInfo.progress} color={ACCENT.level} height={10} />
                <Text style={styles.heroProgressLabel}>
                  {levelInfo.isMaxLevel
                    ? "You've reached the top level!"
                    : `${levelInfo.pointsToNext} points to ${levelInfo.title === 'Hall of Fame' ? '' : 'next level'}`}
                </Text>
              </View>

              <View style={styles.heroStatsRow}>
                <StreakBadge streak={myStats.streak || 0} />
                <View style={styles.heroStatChip}>
                  <Ionicons name="trending-up-outline" size={13} color={ACCENT.level} />
                  <Text style={styles.heroStatChipText}>{myWeeklyPoints} this week</Text>
                </View>
                <View style={styles.heroStatChip}>
                  <Ionicons name="checkmark-done-outline" size={13} color={ACCENT.level} />
                  <Text style={styles.heroStatChipText}>{myStats.totalCompleted || 0} total</Text>
                </View>
              </View>
            </View>

            {/* Verification banner */}
            {canManage && pendingCount > 0 ? (
              <AnimatedCard
                style={styles.verifyBanner}
                onPress={() => navigation.navigate('RewardsVerification', { familyId })}
                accessibilityLabel="Open verification queue"
                scaleDown={0.98}
              >
                <View style={styles.verifyIconCircle}>
                  <Ionicons name="alert-circle" size={20} color={ACCENT.points} />
                </View>
                <View style={styles.verifyBody}>
                  <Text style={styles.verifyTitle}>
                    {pendingCount} chore{pendingCount === 1 ? '' : 's'} waiting for approval
                  </Text>
                  <Text style={styles.verifySubtitle}>Review submissions and award points</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.secondaryText} />
              </AnimatedCard>
            ) : null}

            {/* My Chores */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>My Chores</Text>
                <Text style={styles.sectionMeta}>{doneCount}/{myChores.length} done</Text>
              </View>

              {myChores.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardEmoji}>🌱</Text>
                  <Text style={styles.emptyCardTitle}>No chores yet</Text>
                  <Text style={styles.emptyCardSubtitle}>
                    {canManage ? 'Add a chore to get the family started.' : 'Check back soon for new chores.'}
                  </Text>
                  {canManage ? (
                    <TouchableOpacity
                      style={styles.emptyCardCta}
                      onPress={() => navigation.navigate('RewardsManageChores', { familyId })}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyCardCtaText}>Add a chore</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                myChores.map(({ chore, submission }) => (
                  <ChoreCard
                    key={chore.id}
                    chore={chore}
                    submission={submission}
                    loading={submittingId === chore.id}
                    onPress={() => handleSubmitChore(chore)}
                  />
                ))
              )}
            </View>

            {/* Leaderboard preview */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Leaderboard</Text>
                <TouchableOpacity onPress={() => navigation.navigate('RewardsLeaderboard', { familyId })}>
                  <Text style={styles.sectionLink}>View all</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.previewCard}>
                {leaderboardPreview.length === 0 ? (
                  <Text style={styles.emptyText}>No activity yet this week.</Text>
                ) : (
                  leaderboardPreview.map((entry, index) => (
                    <MemberStatRow
                      key={entry.member.uid}
                      member={entry.member}
                      rank={index + 1}
                      points={entry.points}
                      streak={entry.streak}
                      levelInfo={entry.levelInfo}
                      highlight={entry.member.uid === uid}
                    />
                  ))
                )}
              </View>
            </View>

            {/* Reward shop preview */}
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Reward Shop</Text>
                <TouchableOpacity onPress={() => navigation.navigate('RewardsShop', { familyId })}>
                  <Text style={styles.sectionLink}>View all</Text>
                </TouchableOpacity>
              </View>
              {shopPreview.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardEmoji}>🎁</Text>
                  <Text style={styles.emptyCardTitle}>The shop is empty</Text>
                  <Text style={styles.emptyCardSubtitle}>
                    {canManage ? 'Add rewards for the family to redeem.' : 'Check back soon for rewards.'}
                  </Text>
                  {canManage ? (
                    <TouchableOpacity
                      style={styles.emptyCardCta}
                      onPress={() => navigation.navigate('RewardsShop', { familyId })}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyCardCtaText}>Add a reward</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={styles.shopRow}>
                  {shopPreview.map((reward) => (
                    <RewardCard
                      key={reward.id}
                      reward={reward}
                      balance={myStats.balance || 0}
                      loading={redeemingId === reward.id}
                      onRedeem={handleRedeem}
                    />
                  ))}
                </View>
              )}
            </View>
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
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerDot: {
      position: 'absolute',
      top: 6,
      right: 6,
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: ACCENT.streak,
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
    menuOverlay: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 10,
    },
    menu: {
      position: 'absolute',
      top: 52,
      right: spacing.lg,
      borderRadius: 14,
      borderWidth: 1,
      paddingVertical: 4,
      minWidth: 220,
      zIndex: 20,
      ...shadow,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 12,
      paddingHorizontal: spacing.md,
    },
    menuItemText: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    menuBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.streak,
    },
    menuBadgeText: {
      fontSize: 11,
      fontWeight: '700',
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
      paddingTop: spacing.sm,
    },
    heroCard: {
      backgroundColor: theme.card,
      borderRadius: radius.lg + 4,
      padding: spacing.lg,
      gap: spacing.md,
      marginBottom: spacing.lg,
      ...shadow,
    },
    heroTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    heroEyebrow: {
      fontSize: 10,
      fontWeight: '700',
      color: theme.secondaryText,
      letterSpacing: 1.5,
      marginBottom: 6,
    },
    heroLevelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    heroLevelIcon: {
      fontSize: 28,
    },
    heroLevelTitle: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.3,
    },
    heroBalance: {
      alignItems: 'flex-end',
    },
    heroBalanceValue: {
      fontSize: 28,
      fontWeight: '800',
      color: ACCENT.points,
      letterSpacing: -0.5,
    },
    heroBalanceLabel: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 2,
    },
    heroProgressWrap: {
      gap: 6,
    },
    heroProgressLabel: {
      fontSize: 12,
      color: theme.secondaryText,
    },
    heroStatsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    heroStatChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
      backgroundColor: ACCENT.levelBg,
    },
    heroStatChipText: {
      fontSize: 12,
      fontWeight: '700',
      color: ACCENT.level,
    },
    verifyBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.md,
      marginBottom: spacing.lg,
      borderWidth: 1.5,
      borderColor: ACCENT.pointsBg,
      ...shadow,
    },
    verifyIconCircle: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.pointsBg,
    },
    verifyBody: {
      flex: 1,
    },
    verifyTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    verifySubtitle: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 1,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
    },
    sectionMeta: {
      fontSize: 12,
      color: theme.secondaryText,
      fontWeight: '600',
    },
    sectionLink: {
      fontSize: 12,
      fontWeight: '700',
      color: ACCENT.level,
    },
    previewCard: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.sm,
      ...shadow,
    },
    emptyText: {
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    emptyCard: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      alignItems: 'center',
      ...shadow,
    },
    emptyCardEmoji: {
      fontSize: 32,
      marginBottom: 6,
    },
    emptyCardTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.text,
    },
    emptyCardSubtitle: {
      fontSize: 12,
      color: theme.secondaryText,
      textAlign: 'center',
      marginTop: 4,
    },
    emptyCardCta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: spacing.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 10,
      borderRadius: 999,
      backgroundColor: ACCENT.level,
    },
    emptyCardCtaText: {
      fontSize: 13,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    shopRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
  })
);
