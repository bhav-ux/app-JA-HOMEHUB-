import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth, db } from '../firebaseConfig';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import { ROLES, getRole } from '../utils/familyRoles';
import { leaveFamily } from '../utils/delete';
import { showAlert, showConfirm } from '../utils/dialogs';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import HomeHubHeader from '../src/components/ui/HomeHubHeader';
import HomeHubListRow from '../src/components/ui/HomeHubListRow';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';

export default function SettingsScreen({ navigation, route }) {
  const { theme, isDark, toggleTheme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = route?.params?.familyId;
  const user = auth.currentUser;

  const [familyDoc, setFamilyDoc] = useState(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName || '');
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    if (!familyId) { setFamilyDoc(null); return; }
    return onSnapshot(
      doc(db, 'families', familyId),
      (snap) => setFamilyDoc(snap.exists() ? { id: snap.id, ...snap.data() } : null),
      () => setFamilyDoc(null)
    );
  }, [familyId]);

  const myRole = getRole(familyDoc, user?.uid);

  const handleSaveName = async () => {
    if (!user?.uid) return;
    const trimmed = nameInput.trim();
    if (!trimmed) {
      showAlert('Missing name', 'Please enter a display name.');
      return;
    }
    setSavingName(true);
    try {
      await updateDoc(doc(db, 'users', user.uid), { displayName: trimmed });
      setIsEditingName(false);
    } catch (err) {
      showAlert('Error', getFirebaseErrorMessage(err, 'Unable to update name right now.'));
    } finally {
      setSavingName(false);
    }
  };

  const handleResetPassword = () => {
    const email = user?.email;
    if (!email) return;
    showConfirm('Reset Password', `We'll send a reset link to ${email}.`, {
      confirmText: 'Send',
      onConfirm: async () => {
        try {
          await sendPasswordResetEmail(auth, email);
          showAlert('Email sent', `A password reset link has been sent to ${email}.`);
        } catch (err) {
          showAlert('Error', getFirebaseErrorMessage(err, 'Unable to send reset email right now.'));
        }
      },
    });
  };

  const handleLeaveFamily = () => {
    if (!user?.uid || !familyId) return;
    if (myRole === ROLES.OWNER) {
      showAlert('Transfer ownership first', 'You are the family owner. Transfer ownership to another member before leaving.');
      return;
    }
    showConfirm('Leave Family', "You'll lose access to this family's events, chats, and albums.", {
      confirmText: 'Leave',
      onConfirm: async () => {
        try {
          await leaveFamily({ uid: user.uid, familyId });
          const root = navigation.getParent?.() || navigation;
          root.replace('FamilySetup');
        } catch (err) {
          showAlert('Error', getFirebaseErrorMessage(err, 'Unable to leave family right now.'));
        }
      },
    });
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      const root = navigation.getParent?.() || navigation;
      root.replace('Login');
    } catch (err) {
      showAlert('Error', getFirebaseErrorMessage(err, 'Unable to log out right now.'));
    }
  };

  const appVersion = Constants.expoConfig?.version || '—';
  const appName = Constants.expoConfig?.name || 'HomeHub';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <HomeHubHeader title="Settings" onBack={() => navigation.goBack()} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Account */}
        <Text style={styles.sectionLabel}>Account</Text>
        <View style={styles.card}>
          {isEditingName ? (
            <View style={styles.editBlock}>
              <Input value={nameInput} onChangeText={setNameInput} placeholder="Your name" />
              <View style={styles.editActions}>
                <Button label="Save" onPress={handleSaveName} loading={savingName} style={styles.flexButton} />
                <Button label="Cancel" variant="secondary" onPress={() => setIsEditingName(false)} style={styles.flexButton} />
              </View>
            </View>
          ) : (
            <HomeHubListRow
              title="Display Name"
              subtitle={user?.displayName || 'Tap to set'}
              onPress={() => { setNameInput(user?.displayName || ''); setIsEditingName(true); }}
              leading={<Ionicons name="person-outline" size={20} color={theme.secondaryText} />}
            />
          )}
          <View style={styles.divider} />
          <HomeHubListRow
            title="Reset Password"
            subtitle={`Send a reset link to ${user?.email || ''}`}
            onPress={handleResetPassword}
            leading={<Ionicons name="key-outline" size={20} color={theme.secondaryText} />}
          />
        </View>

        {/* Family */}
        {familyId ? (
          <>
            <Text style={styles.sectionLabel}>Family</Text>
            <View style={styles.card}>
              {myRole === ROLES.OWNER || myRole === ROLES.ADMIN ? (
                <>
                  <HomeHubListRow
                    title="Manage Family"
                    subtitle="Roles, members, danger zone"
                    onPress={() => navigation.navigate('FamilyManagement', { familyId })}
                    leading={<Ionicons name="people-outline" size={20} color={theme.secondaryText} />}
                  />
                  <View style={styles.divider} />
                </>
              ) : null}
              <HomeHubListRow
                title="Leave Family"
                onPress={handleLeaveFamily}
                leading={<Ionicons name="exit-outline" size={20} color={theme.error} />}
                trailing={null}
              />
            </View>
          </>
        ) : null}

        {/* Appearance */}
        <Text style={styles.sectionLabel}>Appearance</Text>
        <View style={styles.card}>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelRow}>
              <Ionicons name="moon-outline" size={20} color={theme.secondaryText} />
              <Text style={styles.switchLabel}>Dark Mode</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* About */}
        <Text style={styles.sectionLabel}>About</Text>
        <View style={styles.card}>
          <HomeHubListRow
            title={appName}
            subtitle={`Version ${appVersion}`}
            leading={<Ionicons name="information-circle-outline" size={20} color={theme.secondaryText} />}
          />
        </View>

        {/* Sign out */}
        <View style={styles.logoutSection}>
          <Button label="Sign Out" onPress={handleLogout} variant="secondary" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    scrollContent: { paddingHorizontal: spacing.lg },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.secondaryText,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    card: {
      borderRadius: radius.lg,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      ...shadow,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: theme.border,
      marginLeft: spacing.lg + 20 + spacing.sm,
    },
    editBlock: { padding: spacing.lg, gap: spacing.sm },
    editActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
    flexButton: { flex: 1 },
    switchRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    switchLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
    switchLabel: { fontSize: 15, fontWeight: '500', color: theme.text },
    logoutSection: { marginTop: spacing.xl },
  })
);
