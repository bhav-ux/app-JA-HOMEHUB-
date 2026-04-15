import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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
  arrayRemove,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
} from 'firebase/firestore';
import { deleteUser, signOut } from 'firebase/auth';
import { deleteObject, ref } from 'firebase/storage';
import { auth, db, storage } from '../firebaseConfig';
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
  const [deletingAccount, setDeletingAccount] = useState(false);

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
        } else if (isMounted) {
          setError('Profile not found.');
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
    if (typeof value === 'string' || typeof value === 'number') return new Date(value).toLocaleString();
    if (value?.seconds) return new Date(value.seconds * 1000).toLocaleString();
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
      Alert.alert('Error', err.message || 'Unable to update name right now.');
    } finally {
      setSavingName(false);
    }
  };

  const displayNameValue = profile?.displayName?.trim() || '—';
  const isSaveDisabled = savingName || !nameInput.trim() || nameInput.trim() === (profile?.displayName || '').trim();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.email}>{user.email}</Text>

        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View>
              <Text style={styles.sectionLabel}>Dark Mode</Text>
              <Text style={styles.settingHint}>Switch the app between light and dark themes.</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Display Name</Text>
          {loading ? (
            <ActivityIndicator color={theme.primary} />
          ) : isEditingName ? (
            <>
              <Input value={nameInput} onChangeText={setNameInput} placeholder="Enter display name" />
              <View style={styles.actionsRow}>
                <Button label="Save" onPress={handleSaveName} loading={savingName} disabled={isSaveDisabled} style={styles.flexButton} />
                <Button label="Cancel" onPress={() => setIsEditingName(false)} variant="secondary" style={styles.flexButton} />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.sectionValue}>{displayNameValue}</Text>
              <TouchableOpacity style={styles.linkButton} onPress={() => setIsEditingName(true)}>
                <Text style={styles.linkButtonText}>Edit Name</Text>
              </TouchableOpacity>
            </>
          )}
          {error ? <Text style={styles.error}>{error}</Text> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Created</Text>
          {loading ? <ActivityIndicator color={theme.primary} /> : <Text style={styles.sectionValue}>{createdAtText}</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Family Members</Text>
          {!familyId ? (
            <Text style={styles.emptyText}>No family found for your account.</Text>
          ) : membersLoading ? (
            <ActivityIndicator color={theme.primary} />
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
              <Button label="Copy Code" onPress={handleCopy} style={styles.flexButton} />
              <Button label="Share Code" onPress={handleShare} variant="secondary" style={styles.flexButton} />
            </View>
            <TouchableOpacity style={styles.linkButton} onPress={handleViewAlbums}>
              <Text style={styles.linkButtonText}>Go to Albums</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <Button label="Log Out" onPress={handleLogout} variant="secondary" />
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.xl,
      backgroundColor: theme.background,
      gap: spacing.md,
      paddingBottom: spacing.xxl,
    },
    email: {
      ...typography.title,
      textAlign: 'center',
      color: theme.text,
    },
    card: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    sectionLabel: { ...typography.small, color: theme.secondaryText, marginBottom: spacing.xs },
    settingHint: { color: theme.secondaryText, fontSize: typography.small.fontSize },
    settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
    sectionValue: { fontSize: typography.heading.fontSize, fontWeight: '600', color: theme.text },
    codeBox: {
      marginTop: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
    },
    codeText: { fontSize: typography.body.fontSize + 2, fontWeight: '600', color: theme.text, letterSpacing: 0.5 },
    actionsRow: { flexDirection: 'row', marginTop: spacing.md, gap: spacing.sm },
    flexButton: { flex: 1 },
    linkButton: { marginTop: spacing.md, alignItems: 'center' },
    linkButtonText: { color: theme.primary, fontSize: typography.body.fontSize + 1, fontWeight: '700' },
    memberList: { marginTop: spacing.sm, gap: spacing.sm },
    memberRow: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: theme.inputBackground,
    },
    memberName: { fontSize: typography.body.fontSize + 1, fontWeight: '600', color: theme.text },
    memberEmail: { marginTop: spacing.xs, fontSize: typography.small.fontSize, color: theme.secondaryText },
    emptyText: { marginTop: spacing.sm, fontSize: typography.body.fontSize, color: theme.secondaryText },
    error: { marginTop: spacing.sm, color: theme.error, fontSize: typography.body.fontSize },
  })
);
