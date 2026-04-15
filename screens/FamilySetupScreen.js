import { useState } from 'react';
import { SafeAreaView, StyleSheet, Text, View, Alert } from 'react-native';
import { arrayUnion, collection, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import Button from '../src/components/Button';
import Input from '../src/components/Input';
import { createThemedStyles, spacing, typography } from '../src/theme';

export default function FamilySetupScreen({ navigation }) {
  const styles = useStyles();
  const [familyCode, setFamilyCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const user = auth.currentUser;

  const handleCreateFamily = async () => {
    if (!user) return;
    setLoading(true);
    setError('');
    try {
      const familyRef = doc(collection(db, 'families'));
      const familyId = familyRef.id;
      await setDoc(familyRef, {
        createdAt: new Date(),
        members: [user.uid],
      });
      await setDoc(
        doc(db, 'users', user.uid),
        {
          familyId,
          email: user.email || '',
        },
        { merge: true }
      );
      navigation.replace('MainTabs', { familyId });
    } catch (err) {
      setError(err.message || 'Failed to create family.');
    } finally {
      setLoading(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!user) return;
    const code = familyCode.trim();
    if (!code) {
      setError('Please enter a family code.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const familyRef = doc(db, 'families', code);
      const snap = await getDoc(familyRef);
      if (!snap.exists()) {
        Alert.alert('Invalid code', 'Please check the family code and try again.');
        setLoading(false);
        return;
      }

      await updateDoc(familyRef, {
        members: arrayUnion(user.uid),
      });
      await setDoc(
        doc(db, 'users', user.uid),
        {
          familyId: code,
          email: user.email || '',
        },
        { merge: true }
      );
      navigation.replace('MainTabs', { familyId: code });
    } catch (err) {
      setError(err.message || 'Failed to join family.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to continue.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Join or Create a Family</Text>
        <View style={styles.card}>
          <Input
            label="Family Code"
            placeholder="Enter family code"
            value={familyCode}
            onChangeText={setFamilyCode}
            autoCapitalize="none"
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <Button label="Join Family" onPress={handleJoinFamily} loading={loading} disabled={loading} />
          <Button label="Create New Family" onPress={handleCreateFamily} disabled={loading} variant="secondary" />
        </View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: theme.background,
    },
    container: {
      flex: 1,
      padding: spacing.lg,
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    title: {
      ...typography.title,
      textAlign: 'center',
      marginBottom: spacing.lg,
      color: theme.text,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.lg,
      gap: spacing.md,
      ...shadow,
    },
    error: {
      color: theme.error,
      fontSize: typography.small.fontSize,
    },
    centerContent: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.lg,
      backgroundColor: theme.background,
    },
    infoText: {
      fontSize: typography.body.fontSize + 1,
      color: theme.secondaryText,
      textAlign: 'center',
    },
  })
);
