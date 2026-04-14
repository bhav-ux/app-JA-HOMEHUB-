import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import { signOut } from 'firebase/auth';
import { auth } from '../firebaseConfig';

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
      <Button title="View profile" onPress={() => navigation.navigate('Profile')} />
      <Button title="Log out" color="#ff3b30" onPress={handleLogout} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    textAlign: 'center',
    color: '#333',
  },
});

