import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import { getEmptyStats, subscribeUserStats } from '../services/rewardsService';
import { getLevelInfo } from '../utils/rewardsLevels';
import PointsPill from '../src/components/rewards/PointsPill';
import LevelBadge from '../src/components/rewards/LevelBadge';
import StreakBadge from '../src/components/rewards/StreakBadge';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function ProfileScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);
  const [userStats, setUserStats] = useState([]);

  const user = auth.currentUser;
  const familyId = familyIdProp ?? profile?.familyId ?? route?.params?.familyId;

  const contentFade = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);

  useEffect(() => {
    if (!loading && !hasAnimated.current) {
      hasAnimated.current = true;
      Animated.timing(contentFade, { toValue: 1, duration: 280, useNativeDriver: true }).start();
    }
  }, [loading, contentFade]);

  useEffect(() => {
    if (!user) {
      const rootNavigator = navigation.getParent();
      if (rootNavigator) {
        rootNavigator.replace('Login');
      } else {
        navigation.replace('Login');
      }
      return;
    }

    let isMounted = true;
    const fetchProfile = async () => {
      try {
        setLoading(true);
        const docRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists() && isMounted) {
          setProfile(snapshot.data());
        }
      } catch (err) {
        console.error('[ProfileScreen] Failed to load profile', getFirebaseErrorMessage(err));
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProfile();
    return () => {
      isMounted = false;
    };
  }, [user, navigation]);

  useEffect(() => {
    if (!familyId) {
      setFamilyMembers([]);
      setMembersLoading(false);
      return () => {};
    }

    setMembersLoading(true);
    const q = query(collection(db, 'users'), where('familyId', '==', familyId));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const members = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }));
        setFamilyMembers(members);
        setMembersLoading(false);
      },
      (err) => {
        console.error('Error fetching family members', err);
        setMembersLoading(false);
      }
    );
    return unsubscribe;
  }, [familyId]);

  useEffect(() => {
    if (!familyId) { setUserStats([]); return; }
    return subscribeUserStats(familyId, setUserStats, () => setUserStats([]));
  }, [familyId]);

  if (!user) return null;

  const handleCopy = async () => {
    if (!familyId) return;
    try {
      await Clipboard.setStringAsync(familyId);
    } catch (err) {
      Alert.alert('Error', 'Unable to copy code right now.');
    }
  };

  const handleShare = async () => {
    if (!familyId) return;
    try {
      await Share.share({ message: `Join my family on JA HOMEHUB: ${familyId}` });
    } catch (err) {
      Alert.alert('Error', 'Unable to share code right now.');
    }
  };

  const myStats = userStats.find((s) => s.id === user.uid) || getEmptyStats(user.uid);
  const levelInfo = getLevelInfo(myStats.lifetimePoints);

  const displayNameValue = profile?.displayName?.trim() || '';
  const avatarLetter =
    displayNameValue?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const shortFamilyId =
    familyId && familyId.length > 16 ? `${familyId.slice(0, 16)}…` : familyId;

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <Animated.View style={[styles.flex, { opacity: contentFade }]} pointerEvents="auto">
        <ScrollView
          contentContainerStyle={[styles.container, { paddingBottom: spacing.xxl + spacing.xl + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {/* ── SECTION 1: PROFILE HEADER ───────────────────── */}
          <View style={styles.headerRow}>
            <View style={styles.headerSpacer} />
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => navigation.navigate('Settings', { familyId })}
              accessibilityLabel="Open settings"
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="settings-outline" size={22} color={theme.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.header}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <>
                <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                </View>
                <Text style={styles.headerName}>{displayNameValue || 'Add your name'}</Text>
                <Text style={styles.headerEmail}>{user.email}</Text>

                {familyId ? (
                  <>
                    <View style={styles.statsRow}>
                      <PointsPill points={myStats.balance || 0} />
                      <LevelBadge level={levelInfo.level} icon={levelInfo.icon} />
                      <StreakBadge streak={myStats.streak || 0} size="sm" />
                    </View>

                    <View style={styles.familyCodeRow}>
                      <Text style={styles.familyCodeMeta}>Family · </Text>
                      <Text style={styles.familyCodeValue}>{shortFamilyId}</Text>
                      <Text style={styles.familyCodeMeta}> · </Text>
                      <TouchableOpacity onPress={handleCopy} activeOpacity={0.6}>
                        <Text style={[styles.familyCodeAction, { color: theme.primary }]}>Copy</Text>
                      </TouchableOpacity>
                      <Text style={styles.familyCodeMeta}> · </Text>
                      <TouchableOpacity onPress={handleShare} activeOpacity={0.6}>
                        <Text style={[styles.familyCodeAction, { color: theme.primary }]}>Share</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                ) : null}
              </>
            )}
          </View>

          {/* ── SECTION 2: FAMILY ───────────────────────────── */}
          <Text style={styles.sectionTitle}>Family</Text>
          <View style={styles.card}>
            {!familyId || (!membersLoading && familyMembers.length === 0) ? (
              <Text style={styles.emptyText}>Your family will appear here.</Text>
            ) : membersLoading ? (
              <View style={styles.cardPad}>
                <ActivityIndicator color={theme.primary} />
              </View>
            ) : (
              familyMembers.map((member, index) => {
                const isYou = member.id === user.uid;
                const name = (member.displayName || '').trim();
                const label = name || member.email || '—';
                const initial = label[0]?.toUpperCase() || '?';
                const isLast = index === familyMembers.length - 1;
                return (
                  <View
                    key={member.id}
                    style={[styles.memberRow, !isLast && styles.memberRowDivider]}
                  >
                    <View style={[styles.memberBadge, { backgroundColor: `${theme.primary}20` }]}>
                      <Text style={[styles.memberBadgeLetter, { color: theme.primary }]}>
                        {initial}
                      </Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{label}</Text>
                      {name && member.email ? (
                        <Text style={styles.memberSub}>{member.email}</Text>
                      ) : null}
                    </View>
                    {isYou ? (
                      <View style={[styles.youPill, { backgroundColor: `${theme.primary}18` }]}>
                        <Text style={[styles.youPillText, { color: theme.primary }]}>You</Text>
                      </View>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    flex: { flex: 1 },
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.xxl + spacing.xl,
      backgroundColor: theme.background,
    },

    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
    },
    headerSpacer: { flex: 1 },
    settingsBtn: {
      width: 40,
      height: 40,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Header
    header: {
      alignItems: 'center',
      paddingBottom: spacing.xl,
    },
    avatarCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    avatarLetter: {
      fontSize: 28,
      fontWeight: '700',
      color: '#fff',
      lineHeight: 32,
    },
    headerName: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    headerEmail: {
      marginTop: spacing.xs,
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      textAlign: 'center',
    },
    statsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.md,
    },
    familyCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.md,
      flexWrap: 'wrap',
      justifyContent: 'center',
    },
    familyCodeMeta: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    familyCodeValue: {
      fontSize: typography.small.fontSize,
      fontWeight: '600',
      color: theme.secondaryText,
    },
    familyCodeAction: {
      fontSize: typography.small.fontSize,
      fontWeight: '600',
    },

    // Section label
    sectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.secondaryText,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },

    // Card shell
    card: {
      borderRadius: radius.lg,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      ...shadow,
    },
    cardPad: {
      paddingVertical: spacing.lg,
      alignItems: 'center',
    },

    // Member rows
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    memberRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    memberBadge: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    memberBadgeLetter: {
      fontSize: 14,
      fontWeight: '700',
      lineHeight: 16,
    },
    memberInfo: { flex: 1 },
    memberName: {
      fontSize: typography.body.fontSize + 1,
      fontWeight: '600',
      color: theme.text,
    },
    memberSub: {
      marginTop: 2,
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    youPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    youPillText: {
      fontSize: 11,
      fontWeight: '700',
    },

    emptyText: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      textAlign: 'center',
    },
  })
);
