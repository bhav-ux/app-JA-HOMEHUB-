import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Share } from 'react-native';
import { collection, doc, getDoc, onSnapshot, query, updateDoc, where } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { colors, radius, shadow, spacing, typography } from '../src/theme';

export default function ProfileScreen({ navigation, route, familyId: familyIdProp }) {
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
        } else {
          if (isMounted) setError('Profile not found.');
        }
      } catch (err) {
        if (isMounted) setError(err.message);
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
        const members = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
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

  const createdAtText = useMemo(() => {
    if (!profile?.createdAt) return '—';
    const value = profile.createdAt;

    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value).toLocaleString();
    }

    if (value?.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }

    return '—';
  }, [profile]);

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
      Alert.alert('Error', err.message);
    }
  }, [navigation]);

  const handleViewAlbums = useCallback(() => {
    if (!familyId) {
      Alert.alert('Family not set', 'Join or create a family to view albums.');
      return;
    }
    navigation.navigate('Albums', { familyId });
  }, [familyId, navigation]);

  if (!user) {
    return null;
  }

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
      await Share.share({
        message: `Join my family on JA HOMEHUB: ${familyId}`,
      });
    } catch (err) {
      Alert.alert('Error', 'Unable to share code right now.');
    }
  };

  const handleEditName = () => {
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setNameInput(profile?.displayName || '');
    setIsEditingName(false);
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
      await updateDoc(doc(db, 'users', user.uid), {
        displayName: trimmedName,
      });
      setProfile((prev) => (prev ? { ...prev, displayName: trimmedName } : prev));
      setIsEditingName(false);
    } catch (err) {
      Alert.alert('Error', err.message || 'Unable to update name right now.');
    } finally {
      setSavingName(false);
    }
  };

  const displayNameValue = profile?.displayName?.trim() || '—';
  const isSaveDisabled =
    savingName ||
    !nameInput.trim() ||
    nameInput.trim() === (profile?.displayName || '').trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.email}>{user.email}</Text>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Display Name</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : isEditingName ? (
            <>
              <TextInput
                style={styles.nameInput}
                value={nameInput}
                onChangeText={setNameInput}
                placeholder="Enter display name"
                autoCapitalize="words"
                autoCorrect={false}
                editable={!savingName}
              />
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  style={[styles.primaryButton, isSaveDisabled && styles.buttonDisabled]}
                  onPress={handleSaveName}
                  disabled={isSaveDisabled}
                >
                  {savingName ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Save</Text>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={handleCancelEdit}
                  disabled={savingName}
                >
                  <Text style={styles.secondaryButtonText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionValue}>{displayNameValue}</Text>
              <TouchableOpacity style={styles.linkButton} onPress={handleEditName}>
                <Text style={styles.linkButtonText}>Edit Name</Text>
              </TouchableOpacity>
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Created</Text>
          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <Text style={styles.sectionValue}>{createdAtText}</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Family Members</Text>
          {!familyId ? (
            <Text style={styles.emptyText}>No family found for your account.</Text>
          ) : membersLoading ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.memberList}>
              {familyMembers.map((member) => {
                const isYou = member.id === user.uid;
                const displayName = (member.displayName || '').trim();
                const primaryLabel = displayName || member.email || '—';
                return (
                  <View key={member.id} style={styles.memberRow}>
                    <Text style={styles.memberName}>
                      {primaryLabel}
                      {isYou ? ' (You)' : ''}
                    </Text>
                    {member.email ? <Text style={styles.memberEmail}>{member.email}</Text> : null}
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {familyId ? (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Family Code</Text>
            <View style={styles.codeBox}>
              <Text style={styles.codeText}>{familyId}</Text>
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.primaryButton} onPress={handleCopy}>
                <Text style={styles.primaryButtonText}>Copy Code</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondaryButton} onPress={handleShare}>
                <Text style={styles.secondaryButtonText}>Share Code</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.linkButton} onPress={handleViewAlbums}>
              <Text style={styles.linkButtonText}>Go to Albums</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.xl,
    justifyContent: 'space-between',
    backgroundColor: colors.background,
  },
  email: {
    ...typography.title,
    textAlign: 'center',
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  card: {
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    ...shadow,
    marginBottom: spacing.lg,
  },
  sectionLabel: {
    ...typography.small,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  sectionValue: {
    fontSize: typography.heading.fontSize,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: typography.body.fontSize + 1,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  codeBox: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  codeText: {
    fontSize: typography.body.fontSize + 2,
    fontWeight: '600',
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    ...shadow,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginLeft: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.primary,
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
  },
  linkButton: {
    marginTop: spacing.md,
    alignItems: 'center',
  },
  linkButtonText: {
    color: colors.primary,
    fontSize: typography.body.fontSize + 1,
    fontWeight: '700',
  },
  memberList: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  memberRow: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.background,
  },
  memberName: {
    fontSize: typography.body.fontSize + 1,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  memberEmail: {
    marginTop: spacing.xs,
    fontSize: typography.small.fontSize,
    color: colors.textSecondary,
  },
  emptyText: {
    marginTop: spacing.sm,
    fontSize: typography.body.fontSize,
    color: colors.textSecondary,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  error: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontSize: typography.body.fontSize,
  },
  logoutButton: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  logoutText: {
    color: colors.textPrimary,
    fontSize: typography.body.fontSize + 2,
    fontWeight: '700',
  },
});
