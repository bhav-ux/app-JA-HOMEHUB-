import { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function LoginScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = useCallback(async () => {
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      await signInWithEmailAndPassword(auth, email.trim(), password);
      const uid = auth.currentUser?.uid;
      let target = 'MainTabs';
      let params;
      if (uid) {
        const snap = await getDoc(doc(db, 'users', uid));
        const familyId = snap.exists() ? snap.data()?.familyId : null;
        if (!familyId) {
          // Bug fix: new users were sent to MainTabs without a family setup.
          target = 'FamilySetup';
        } else {
          params = { familyId };
        }
      }
      const rootNavigator = navigation.getParent();
      if (rootNavigator) {
        rootNavigator.replace(target, params);
      } else {
        navigation.replace(target, params);
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>JA HOMEHUB</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Log in</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              placeholder="name@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
          </View>
          <View style={styles.field}>
            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.button}>
            <Button
              color="#007AFF"
              title={loading ? 'Logging in…' : 'Continue'}
              onPress={handleLogin}
              disabled={loading}
            />
          </View>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.navigate('Signup')}>
            <Text style={styles.linkText}>Need an account? Sign up</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
    paddingHorizontal: 24,
    paddingVertical: 30,
    justifyContent: 'center',
  },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 24,
    color: '#111',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 16,
    elevation: 3,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#555',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  button: {
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  error: {
    color: '#d00',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  linkRow: {
    marginTop: 8,
    alignItems: 'center',
  },
  linkText: {
    color: '#007AFF',
    fontSize: 15,
  },
});
