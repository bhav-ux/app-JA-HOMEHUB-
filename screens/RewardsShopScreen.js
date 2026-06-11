import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { auth } from '../firebaseConfig';
import AnimatedCard from '../src/components/AnimatedCard';
import RewardCard from '../src/components/rewards/RewardCard';
import RewardFormSheet from '../src/components/rewards/RewardFormSheet';
import PointsPill from '../src/components/rewards/PointsPill';
import { ACCENT } from '../src/components/rewards/rewardsTheme';
import {
  fulfillRedemption,
  getEmptyStats,
  redeemReward,
  subscribeRedemptions,
  subscribeRewards,
  subscribeUserStats,
} from '../services/rewardsService';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import { useFamilyRole, isApproverRole } from '../hooks/useFamilyRole';
import { hapticLight, hapticMedium } from '../utils/haptics';
import { showAlert } from '../utils/dialogs';
import { toJsDate } from '../utils/dateKeys';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

function formatDate(value) {
  const date = toJsDate(value);
  if (!date) return '';
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  const time = date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (sameDay) return `Today, ${time}`;
  return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${time}`;
}

export default function RewardsShopScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const uid = auth.currentUser?.uid;

  const role = useFamilyRole(familyId, uid);
  const canManage = isApproverRole(role);
  const members = useFamilyMemberProfiles(familyId);
  const membersById = useMemo(() => new Map(members.map((m) => [m.uid, m])), [members]);

  const [rewards, setRewards] = useState([]);
  const [redemptions, setRedemptions] = useState([]);
  const [userStats, setUserStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState(null);
  const [fulfillingId, setFulfillingId] = useState(null);
  const [formVisible, setFormVisible] = useState(false);
  const [editingReward, setEditingReward] = useState(null);

  useEffect(() => {
    if (!familyId) { setRewards([]); setLoading(false); return; }
    setLoading(true);
    return subscribeRewards(familyId, (data) => { setRewards(data); setLoading(false); }, () => setLoading(false));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setRedemptions([]); return; }
    return subscribeRedemptions(familyId, setRedemptions, () => setRedemptions([]));
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setUserStats([]); return; }
    return subscribeUserStats(familyId, setUserStats, () => setUserStats([]));
  }, [familyId]);

  const myStats = useMemo(() => userStats.find((s) => s.id === uid) || getEmptyStats(uid), [userStats, uid]);

  const visibleRewards = useMemo(() => {
    const list = canManage ? rewards : rewards.filter((r) => r.active !== false);
    return [...list].sort((a, b) => a.cost - b.cost);
  }, [rewards, canManage]);

  const myRedemptions = useMemo(() => {
    return redemptions
      .filter((r) => r.userId === uid)
      .sort((a, b) => (toJsDate(b.redeemedAt)?.getTime() || 0) - (toJsDate(a.redeemedAt)?.getTime() || 0))
      .slice(0, 10);
  }, [redemptions, uid]);

  const pendingRedemptions = useMemo(() => {
    return redemptions
      .filter((r) => r.status === 'pending')
      .sort((a, b) => (toJsDate(a.redeemedAt)?.getTime() || 0) - (toJsDate(b.redeemedAt)?.getTime() || 0));
  }, [redemptions]);

  const handleRedeem = async (reward) => {
    if (!familyId || !uid || redeemingId) return;
    hapticLight();
    setRedeemingId(reward.id);
    try {
      await redeemReward(familyId, reward, uid);
      hapticMedium();
      showAlert('Redeemed!', `${reward.title} is on its way. A parent will follow up.`);
    } catch (error) {
      console.error('[RewardsShopScreen] Failed to redeem reward', error);
      showAlert('Error', error.message || 'Could not redeem this reward. Please try again.');
    } finally {
      setRedeemingId(null);
    }
  };

  const handleFulfill = async (redemption) => {
    if (!familyId || !uid || fulfillingId) return;
    hapticLight();
    setFulfillingId(redemption.id);
    try {
      await fulfillRedemption(familyId, redemption.id, uid);
      hapticMedium();
    } catch (error) {
      console.error('[RewardsShopScreen] Failed to fulfill redemption', error);
      showAlert('Error', 'Could not update this redemption. Please try again.');
    } finally {
      setFulfillingId(null);
    }
  };

  const gradientColors = isDark
    ? [theme.background, '#1E2620']
    : ['#FBF6EC', '#F2F8EE'];

  return (
    <View style={styles.flex}>
      <LinearGradient colors={gradientColors} style={StyleSheet.absoluteFill} />
      <View style={[styles.blob, styles.blobTop, { backgroundColor: ACCENT.streak }]} />

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
            <Text style={styles.headerTitle}>🎁 Reward Shop</Text>
            <Text style={styles.headerSubtitle}>Redeem points for fun rewards</Text>
          </View>
          {canManage ? (
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                setEditingReward(null);
                setFormVisible(true);
              }}
              style={styles.headerBtn}
              accessibilityLabel="Add reward"
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
            <Ionicons name="gift-outline" size={40} color={theme.secondaryText} />
            <Text style={styles.emptyTitle}>No family yet</Text>
            <Text style={styles.emptySubtitle}>Join or create a family to open the reward shop.</Text>
          </View>
        ) : loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={ACCENT.streak} />
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: Math.max(insets.bottom, spacing.lg) + spacing.lg }]}
          >
            <View style={styles.balanceCard}>
              <View>
                <Text style={styles.balanceLabel}>Your balance</Text>
                <Text style={styles.balanceValue}>{myStats.balance || 0} pts</Text>
              </View>
              <PointsPill points={myStats.balance || 0} />
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Available Rewards</Text>
              {visibleRewards.length === 0 ? (
                <View style={styles.emptyCard}>
                  <Text style={styles.emptyCardEmoji}>🎁</Text>
                  <Text style={styles.emptyCardTitle}>The shop is empty</Text>
                  <Text style={styles.emptyCardSubtitle}>
                    {canManage ? 'Add a reward to get started.' : 'Check back soon for rewards.'}
                  </Text>
                  {canManage ? (
                    <TouchableOpacity
                      style={styles.emptyCardCta}
                      onPress={() => { setEditingReward(null); setFormVisible(true); }}
                    >
                      <Ionicons name="add" size={16} color="#FFFFFF" />
                      <Text style={styles.emptyCardCtaText}>Add a reward</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : (
                <View style={styles.grid}>
                  {visibleRewards.map((reward) => (
                    <View key={reward.id} style={styles.gridItem}>
                      <RewardCard
                        reward={reward}
                        balance={myStats.balance || 0}
                        loading={redeemingId === reward.id}
                        onRedeem={handleRedeem}
                        isManager={canManage}
                        onEdit={(r) => { setEditingReward(r); setFormVisible(true); }}
                      />
                    </View>
                  ))}
                </View>
              )}
            </View>

            {canManage && pendingRedemptions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pending Fulfillment</Text>
                <View style={styles.listCard}>
                  {pendingRedemptions.map((redemption, index) => {
                    const member = membersById.get(redemption.userId);
                    return (
                      <View
                        key={redemption.id}
                        style={[styles.redemptionRow, index < pendingRedemptions.length - 1 && styles.rowDivider]}
                      >
                        <View style={styles.redemptionIconCircle}>
                          <Ionicons name={redemption.rewardIcon || 'gift-outline'} size={18} color={ACCENT.streak} />
                        </View>
                        <View style={styles.redemptionInfo}>
                          <Text style={styles.redemptionTitle} numberOfLines={1}>{redemption.rewardTitle}</Text>
                          <Text style={styles.redemptionMeta}>
                            {member?.name || 'Member'} · {formatDate(redemption.redeemedAt)}
                          </Text>
                        </View>
                        <AnimatedCard
                          onPress={fulfillingId ? undefined : () => handleFulfill(redemption)}
                          disabled={!!fulfillingId}
                          accessibilityLabel={`Mark ${redemption.rewardTitle} as fulfilled`}
                        >
                          <View style={styles.fulfillButton}>
                            {fulfillingId === redemption.id ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={styles.fulfillButtonText}>Fulfill</Text>
                            )}
                          </View>
                        </AnimatedCard>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>My Redemptions</Text>
              {myRedemptions.length === 0 ? (
                <Text style={styles.emptyText}>You haven't redeemed anything yet.</Text>
              ) : (
                <View style={styles.listCard}>
                  {myRedemptions.map((redemption, index) => (
                    <View
                      key={redemption.id}
                      style={[styles.redemptionRow, index < myRedemptions.length - 1 && styles.rowDivider]}
                    >
                      <View style={styles.redemptionIconCircle}>
                        <Ionicons name={redemption.rewardIcon || 'gift-outline'} size={18} color={ACCENT.streak} />
                      </View>
                      <View style={styles.redemptionInfo}>
                        <Text style={styles.redemptionTitle} numberOfLines={1}>{redemption.rewardTitle}</Text>
                        <Text style={styles.redemptionMeta}>{formatDate(redemption.redeemedAt)}</Text>
                      </View>
                      <View style={[styles.statusPill, redemption.status === 'fulfilled' ? styles.statusFulfilled : styles.statusPending]}>
                        <Text style={[styles.statusText, redemption.status === 'fulfilled' ? styles.statusTextFulfilled : styles.statusTextPending]}>
                          {redemption.status === 'fulfilled' ? 'Fulfilled' : 'Pending'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>

      <RewardFormSheet
        visible={formVisible}
        onClose={() => setFormVisible(false)}
        familyId={familyId}
        reward={editingReward}
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
    balanceCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.card,
      borderRadius: radius.lg + 4,
      padding: spacing.lg,
      marginBottom: spacing.lg,
      ...shadow,
    },
    balanceLabel: {
      fontSize: 12,
      color: theme.secondaryText,
      marginBottom: 4,
    },
    balanceValue: {
      fontSize: 24,
      fontWeight: '800',
      color: ACCENT.points,
      letterSpacing: -0.4,
    },
    section: {
      marginBottom: spacing.lg,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: -0.2,
      marginBottom: spacing.sm,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    gridItem: {
      width: '47%',
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
    emptyText: {
      fontSize: 13,
      color: theme.secondaryText,
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
    redemptionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.xs,
    },
    redemptionIconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.streakBg,
    },
    redemptionInfo: {
      flex: 1,
    },
    redemptionTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    redemptionMeta: {
      fontSize: 11,
      color: theme.secondaryText,
      marginTop: 1,
    },
    statusPill: {
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 999,
    },
    statusPending: {
      backgroundColor: ACCENT.pointsBg,
    },
    statusFulfilled: {
      backgroundColor: ACCENT.levelBg,
    },
    statusText: {
      fontSize: 11,
      fontWeight: '700',
    },
    statusTextPending: {
      color: ACCENT.points,
    },
    statusTextFulfilled: {
      color: ACCENT.level,
    },
    fulfillButton: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: ACCENT.level,
      minWidth: 70,
      alignItems: 'center',
    },
    fulfillButtonText: {
      fontSize: 12,
      fontWeight: '700',
      color: '#FFFFFF',
    },
  })
);
