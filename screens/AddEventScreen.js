import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Platform,
} from "react-native";
import RNDateTimePicker from "@react-native-community/datetimepicker";
import { addDoc, collection, doc, getDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebaseConfig";
import { colors, radius, shadow, spacing, typography } from "../src/theme";

export default function AddEventScreen({ navigation }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date());
  const [showPicker, setShowPicker] = useState(false);
  const [familyId, setFamilyId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const user = auth.currentUser;

  useEffect(() => {
    const fetchFamily = async () => {
      if (!user) {
        // Bug fix: ensure the screen doesn't stay stuck in loading when signed out.
        setLoading(false);
        return;
      }
      try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setFamilyId(userSnap.data().familyId || null);
        }
        console.log("[AddEvent] Family loaded:", userSnap.exists() ? userSnap.data().familyId || null : null);
      } catch (error) {
        console.error("Error fetching family", error);
      } finally {
        setLoading(false);
      }
    };

    fetchFamily();
  }, [user]);

  const onChangeDate = (event, selectedDate) => {
    if (event.type === "set" && selectedDate) {
      setDate(selectedDate);
    }
    if (Platform.OS !== "ios") {
      setShowPicker(false);
    }
  };

  const createEvent = async () => {
    if (!user) {
      Alert.alert("Not signed in", "You need to be signed in to create events.");
      return;
    }
    if (!familyId) {
      Alert.alert("No family found", "Please complete family setup first.");
      return;
    }
    if (!title.trim()) {
      return Alert.alert("Error", "Event title is required");
    }
    try {
      setSaving(true);
      const docRef = await addDoc(collection(db, "families", familyId, "events"), {
        title: title.trim(),
        description: description.trim(),
        date,
        createdBy: user.uid,
        createdByEmail: user.email,
        createdAt: serverTimestamp(),
      });

      console.log("[AddEvent] Event created:", docRef.id);
      navigation.goBack();
    } catch (err) {
      console.error("[AddEvent] Failed to save event", err);
      Alert.alert("Failed to save", err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!familyId) {
    return (
      <SafeAreaView style={styles.centerPage}>
        <Text style={styles.warning}>No family assigned</Text>
        <Text style={styles.secondaryText}>Please complete family setup</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Add Event</Text>

        <View style={styles.card}>
          <TextInput
            style={styles.input}
            placeholder="Event Title"
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description (optional)"
            value={description}
            onChangeText={setDescription}
            multiline
          />

          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowPicker(true)}
            accessibilityRole="button"
            accessibilityLabel="Select event date"
          >
            <Text style={styles.dateText}>{date.toLocaleDateString()}</Text>
          </TouchableOpacity>

          {showPicker && (
            <RNDateTimePicker
              mode="date"
              value={date}
              display="spinner"
              onChange={onChangeDate}
            />
          )}

          <TouchableOpacity
            style={[styles.addButton, saving && styles.addButtonDisabled]}
            onPress={createEvent}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save event"
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.addButtonText}>Save Event</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, padding: spacing.xl },
  title: {
    ...typography.title,
    textAlign: "center",
    marginBottom: spacing.lg,
    color: colors.textPrimary,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    fontSize: 16,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm,
  },
  textArea: { height: 96, textAlignVertical: "top" },
  dateButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
  },
  dateText: { color: colors.primary, fontSize: 16, fontWeight: "600" },
  addButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: "center",
  },
  addButtonDisabled: {
    opacity: 0.7,
  },
  addButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  centerPage: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  warning: { ...typography.heading, color: colors.textPrimary },
  secondaryText: { marginTop: spacing.xs + spacing.xs, color: colors.textSecondary },
});
