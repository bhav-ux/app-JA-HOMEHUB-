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
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function SignupScreen({ navigation }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSignup = useCallback(async () => {
    if (!name.trim() || !email || !password) {
      setError('Please enter your full name, email, and password.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const uid = credential.user?.uid;

      await setDoc(doc(db, 'users', uid), {
        email: email.trim(),
        displayName: name.trim(),
        familyId: null,
        createdAt: new Date(),
      });

      const rootNavigator = navigation.getParent();
      if (rootNavigator) {
        rootNavigator.replace('FamilySetup');
      } else {
        navigation.replace('FamilySetup');
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  }, [email, password, name, navigation]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.brand}>JA HOMEHUB</Text>
        <View style={styles.card}>
          <Text style={styles.title}>Create account</Text>
          <View style={styles.field}>
          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input}
            placeholder="Your full name"
            value={name}
            onChangeText={setName}
          />
          </View>
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
              placeholder="Create a password"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>
          {error ? <Text style={styles.error}>{error}</Text> : null}
          <View style={styles.button}>
            <Button
              color="#007AFF"
              title={loading ? 'Creating account…' : 'Sign up'}
              onPress={handleSignup}
              disabled={loading}
            />
          </View>
          <TouchableOpacity style={styles.linkRow} onPress={() => navigation.goBack()}>
            <Text style={styles.linkText}>Already have an account? Log in</Text>
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
