import { View, Text, StyleSheet, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import ActionButton from '../src/components/ActionButton';
import { colors, spacing, typography } from '../src/theme';

export default function HomeScreen({ navigation }) {
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Logout failed', error.message);
    } finally {
      navigation.replace('Login');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>You made it home 🎉</Text>
      <Text style={styles.body}>
        This is where you can continue building your app experience.
      </Text>
      <ActionButton
        label="View profile"
        onPress={() => navigation.navigate('Profile')}
        accessibilityHint="Go to your profile"
      />
      <ActionButton
        label="Log out"
        onPress={handleLogout}
        variant="danger"
        accessibilityHint="Sign out of your account"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.xl,
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
    color: colors.textPrimary,
  },
  body: {
    fontSize: typography.body.fontSize + 1,
    textAlign: 'center',
    color: colors.textSecondary,
  },
});
