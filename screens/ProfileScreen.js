import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function ProfileScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme, isDark, toggleTheme } = useAppTheme();
  const styles = useStyles();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [familyMembers, setFamilyMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(true);

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
        setError('');
        const docRef = doc(db, 'users', user.uid);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          if (isMounted) setProfile(snapshot.data());
        } else if (isMounted) {
          setError('Profile not found.');
        }
      } catch (err) {
        if (isMounted) setError(getFirebaseErrorMessage(err, 'Unable to load your profile.'));
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
    if (!isEditingName) {
      setNameInput(profile?.displayName || '');
    }
  }, [profile?.displayName, isEditingName]);

  const handleLogout = useCallback(async () => {
    try {
      await signOut(auth);
      const rootNavigator = navigation.getParent();
      if (rootNavigator) {
        rootNavigator.replace('Login');
      } else {
        navigation.replace('Login');
      }
    } catch (err) {
      Alert.alert('Error', getFirebaseErrorMessage(err, 'Unable to log out right now.'));
    }
  }, [navigation]);

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

  const handleSaveName = async () => {
    if (!user?.uid) return;
    const trimmedName = nameInput.trim();
    if (!trimmedName) {
      Alert.alert('Missing name', 'Please enter a display name.');
      return;
    }
    setSavingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: trimmedName });
      setProfile((prev) => (prev ? { ...prev, displayName: trimmedName } : prev));
      setIsEditingName(false);
    } catch (err) {
      Alert.alert('Error', getFirebaseErrorMessage(err, 'Unable to update name right now.'));
    } finally {
      setSavingName(false);
    }
  };

  const displayNameValue = profile?.displayName?.trim() || '';
  const avatarLetter =
    displayNameValue?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';
  const isSaveDisabled =
    savingName ||
    !nameInput.trim() ||
    nameInput.trim() === (profile?.displayName || '').trim();
  const shortFamilyId =
    familyId && familyId.length > 16 ? `${familyId.slice(0, 16)}…` : familyId;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Animated.View style={[styles.flex, { opacity: contentFade }]}>
        <ScrollView
          contentContainerStyle={styles.container}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── SECTION 1: PROFILE HEADER ───────────────────── */}
          <View style={styles.header}>
            {loading ? (
              <ActivityIndicator size="large" color={theme.primary} />
            ) : (
              <>
                <View style={[styles.avatarCircle, { backgroundColor: theme.primary }]}>
                  <Text style={styles.avatarLetter}>{avatarLetter}</Text>
                </View>
                <Text style={styles.headerName}>{displayNameValue || 'No name set'}</Text>
                <Text style={styles.headerEmail}>{user.email}</Text>
                {familyId ? (
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
                ) : null}
              </>
            )}
          </View>

          {/* ── SECTION 2: FAMILY ───────────────────────────── */}
          <Text style={styles.sectionTitle}>Family</Text>
          <View style={styles.card}>
            {!familyId || (!membersLoading && familyMembers.length === 0) ? (
              <Text style={styles.emptyText}>No family members found.</Text>
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

          {/* ── SECTION 3: PREFERENCES ──────────────────────── */}
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.card}>
            <View style={styles.settingRow}>
              <Text style={styles.settingLabel}>Dark Mode</Text>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>

          {/* ── SECTION 4: ACCOUNT ──────────────────────────── */}
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.card}>
            {isEditingName ? (
              <View style={styles.editBlock}>
                <Text style={styles.settingLabel}>Display Name</Text>
                <Input
                  value={nameInput}
                  onChangeText={setNameInput}
                  placeholder="Enter display name"
                />
                <View style={styles.editActions}>
                  <Button
                    label="Save"
                    onPress={handleSaveName}
                    loading={savingName}
                    disabled={isSaveDisabled}
                    style={styles.flexButton}
                  />
                  <Button
                    label="Cancel"
                    onPress={() => setIsEditingName(false)}
                    variant="secondary"
                    style={styles.flexButton}
                  />
                </View>
                {error ? <Text style={styles.error}>{error}</Text> : null}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.settingRow}
                onPress={() => setIsEditingName(true)}
                activeOpacity={0.7}
              >
                <View style={styles.settingRowContent}>
                  <Text style={styles.settingLabel}>Display Name</Text>
                  <Text style={styles.settingSubValue}>
                    {displayNameValue || 'Tap to set'}
                  </Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* ── LOGOUT ──────────────────────────────────────── */}
          <View style={styles.logoutSection}>
            <Button label="Log Out" onPress={handleLogout} variant="secondary" />
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

    // Header
    header: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
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
    familyCodeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.sm,
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
      marginTop: spacing.lg,
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

    // Setting rows
    settingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md + 2,
      paddingHorizontal: spacing.lg,
    },
    settingRowContent: { flex: 1 },
    settingLabel: {
      fontSize: typography.body.fontSize + 1,
      fontWeight: '500',
      color: theme.text,
    },
    settingSubValue: {
      marginTop: 2,
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    chevron: {
      fontSize: 20,
      color: theme.secondaryText,
      marginLeft: spacing.sm,
    },

    // Edit name block
    editBlock: {
      padding: spacing.lg,
      gap: spacing.sm,
    },
    editActions: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    flexButton: { flex: 1 },

    // Logout
    logoutSection: { marginTop: spacing.xl },

    emptyText: {
      paddingVertical: spacing.lg,
      paddingHorizontal: spacing.lg,
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      textAlign: 'center',
    },
    error: {
      color: theme.error,
      fontSize: typography.body.fontSize,
    },
  })
);
