import { useCallback, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { addDoc, collection } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

export default function CreateAlbumScreen({ navigation, route, familyId: familyIdProp }) {
  const [albumName, setAlbumName] = useState('');
  const [saving, setSaving] = useState(false);

  const user = auth.currentUser;
  const familyId = familyIdProp ?? route?.params?.familyId;

  const handleSave = useCallback(async () => {
    if (!familyId) {
      Alert.alert('Family not set', 'Join or create a family to add albums.');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create albums.');
      return;
    }
    if (!albumName.trim()) {
      Alert.alert('Missing info', 'Please enter an album name.');
      return;
    }

    try {
      setSaving(true);
      await addDoc(collection(db, 'families', familyId, 'albums'), {
        name: albumName.trim(),
        createdBy: user.uid,
        createdAt: new Date(),
      });
      navigation.goBack();
    } catch (error) {
      Alert.alert('Error', error.message);
    } finally {
      setSaving(false);
    }
  }, [albumName, familyId, navigation, user]);

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to create albums.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.header}>Create Album</Text>
          <View style={styles.field}>
            <Text style={styles.label}>Album Name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter album name"
              value={albumName}
              onChangeText={setAlbumName}
              autoFocus
            />
          </View>
        </ScrollView>
        <View style={styles.footer}>
          <TouchableOpacity
            style={[styles.saveButton, (!albumName.trim() || saving) && styles.disabled]}
            onPress={handleSave}
            disabled={!albumName.trim() || saving}
            accessibilityRole="button"
            accessibilityLabel="Save album"
          >
            <Text style={styles.saveText}>{saving ? 'Saving…' : 'Save'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 20,
  },
  header: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
    color: '#111',
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 15,
    color: '#555',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  disabled: {
    opacity: 0.5,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  infoText: {
    fontSize: 16,
    color: '#777',
    textAlign: 'center',
  },
});
