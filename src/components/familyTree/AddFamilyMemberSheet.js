import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RNDateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { auth, db } from '../../../firebaseConfig';
import Button from '../Button';
import Input from '../Input';
import {
  RELATIONSHIP_TYPES,
  addFamilyMember,
  addRelationship,
  relationshipLabel,
  updateFamilyMember,
  uploadMemberPhoto,
} from '../../../services/familyTreeService';
import { showAlert } from '../../../utils/dialogs';
import { createThemedStyles, spacing, useAppTheme } from '../../theme';

const AVATAR_PALETTE = [
  '#7B93C8', '#D4896A', '#76A895', '#9E7DC4',
  '#6BA4C4', '#C4956A', '#89B488', '#B07AB0',
];

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return AVATAR_PALETTE[0];
  return AVATAR_PALETTE[name.charCodeAt(0) % AVATAR_PALETTE.length];
}

function pad2(n) {
  return `${n}`.padStart(2, '0');
}

function formatDate(date) {
  if (!date) return null;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export default function AddFamilyMemberSheet({ visible, onClose, familyId, members, onAdded, presetRelativeId }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const user = auth.currentUser;

  const [mode, setMode] = useState('placeholder');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [birthDate, setBirthDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [existingUsers, setExistingUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [relationshipType, setRelationshipType] = useState(null);
  const [relativeId, setRelativeId] = useState(null);
  const [saving, setSaving] = useState(false);

  const hasMembers = (members?.length || 0) > 0;

  useEffect(() => {
    if (!visible) return;
    setMode('placeholder');
    setName('');
    setEmail('');
    setPhone('');
    setPhotoUri(null);
    setBirthDate(null);
    setShowDatePicker(false);
    setSelectedUser(null);
    setRelationshipType(null);
    setRelativeId(presetRelativeId || null);
    setSaving(false);
  }, [visible, presetRelativeId]);

  useEffect(() => {
    if (!visible || mode !== 'existing' || !familyId) return;
    let cancelled = false;
    setLoadingUsers(true);
    (async () => {
      try {
        const snap = await getDocs(query(collection(db, 'users'), where('familyId', '==', familyId)));
        const linkedUserIds = new Set((members || []).map((m) => m.userId).filter(Boolean));
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((u) => !linkedUserIds.has(u.id));
        if (!cancelled) setExistingUsers(list);
      } catch (error) {
        console.error('[AddFamilyMemberSheet] Failed to load family members', error);
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    })();
    return () => { cancelled = true; };
  }, [visible, mode, familyId, members]);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Allow photo library access to add a photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset?.uri) setPhotoUri(asset.uri);
  };

  const onChangeDateNative = (event, selected) => {
    if (Platform.OS !== 'ios') setShowDatePicker(false);
    if (event.type === 'set' && selected) setBirthDate(selected);
  };

  const onChangeWebDate = (event) => {
    const value = event?.target?.value;
    if (!value) return;
    const next = new Date(`${value}T00:00:00`);
    if (!Number.isNaN(next.getTime())) setBirthDate(next);
  };

  const canSubmit = mode === 'existing' ? !!selectedUser : !!name.trim();

  const handleSubmit = async () => {
    if (!familyId || !user?.uid || saving) return;
    if (!canSubmit) {
      showAlert('Missing info', mode === 'existing' ? 'Pick a family member to add.' : 'Enter a name.');
      return;
    }
    if (hasMembers && relationshipType && !relativeId) {
      showAlert('Missing info', 'Choose who this person is related to.');
      return;
    }

    setSaving(true);
    try {
      let payload;
      if (mode === 'existing') {
        payload = {
          userId: selectedUser.id,
          name: selectedUser.displayName?.trim() || selectedUser.email || 'Family Member',
          photoURL: selectedUser.photoURL || null,
          email: selectedUser.email || null,
          isPlaceholder: false,
        };
      } else {
        payload = {
          userId: null,
          name: name.trim(),
          photoURL: null,
          birthDate: formatDate(birthDate),
          email: email.trim() || null,
          phone: phone.trim() || null,
          isPlaceholder: true,
        };
      }

      const newId = await addFamilyMember(familyId, payload, user.uid);

      if (mode === 'placeholder' && photoUri) {
        const url = await uploadMemberPhoto(photoUri, familyId, newId);
        await updateFamilyMember(familyId, newId, { photoURL: url });
      }

      if (relationshipType && relativeId) {
        await addRelationship(
          familyId,
          { fromMemberId: newId, toMemberId: relativeId, type: relationshipType },
          user.uid
        );
      }

      onAdded?.();
      onClose?.();
    } catch (error) {
      console.error('[AddFamilyMemberSheet] Failed to add member', error);
      showAlert('Error', 'Could not add this family member. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const relativeName = members?.find((m) => m.id === relativeId)?.name;
  const presetRelativeName = members?.find((m) => m.id === presetRelativeId)?.name;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.title}>Add Family Member</Text>
              {presetRelativeName ? (
                <Text style={styles.subtitle}>Connecting to {presetRelativeName}</Text>
              ) : null}
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={24} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'placeholder' && styles.modeBtnActive]}
                onPress={() => setMode('placeholder')}
              >
                <Ionicons
                  name="person-add-outline"
                  size={16}
                  color={mode === 'placeholder' ? '#FFFFFF' : theme.text}
                />
                <Text style={[styles.modeBtnText, mode === 'placeholder' && styles.modeBtnTextActive]}>
                  Placeholder
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modeBtn, mode === 'existing' && styles.modeBtnActive]}
                onPress={() => setMode('existing')}
              >
                <Ionicons
                  name="person-circle-outline"
                  size={16}
                  color={mode === 'existing' ? '#FFFFFF' : theme.text}
                />
                <Text style={[styles.modeBtnText, mode === 'existing' && styles.modeBtnTextActive]}>
                  HomeHub User
                </Text>
              </TouchableOpacity>
            </View>

            {mode === 'existing' ? (
              loadingUsers ? (
                <ActivityIndicator color={theme.primary} style={styles.loader} />
              ) : existingUsers.length === 0 ? (
                <Text style={styles.emptyText}>Everyone in your family is already on the tree.</Text>
              ) : (
                <View style={styles.userList}>
                  {existingUsers.map((u) => {
                    const label = u.displayName?.trim() || u.email || 'Family member';
                    const selected = selectedUser?.id === u.id;
                    return (
                      <TouchableOpacity
                        key={u.id}
                        style={[styles.userRow, selected && { borderColor: theme.primary }]}
                        onPress={() => setSelectedUser(u)}
                      >
                        {u.photoURL ? (
                          <Image source={{ uri: u.photoURL }} style={styles.userAvatar} />
                        ) : (
                          <View style={[styles.userAvatar, styles.userAvatarFallback, { backgroundColor: getAvatarColor(label) }]}>
                            <Text style={styles.userAvatarText}>{getInitials(label)}</Text>
                          </View>
                        )}
                        <View style={styles.userInfo}>
                          <Text style={styles.userName} numberOfLines={1}>{label}</Text>
                          {u.email ? <Text style={styles.userEmail} numberOfLines={1}>{u.email}</Text> : null}
                        </View>
                        {selected && <Ionicons name="checkmark-circle" size={20} color={theme.primary} />}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )
            ) : (
              <View style={styles.formGroup}>
                <TouchableOpacity style={styles.photoPicker} onPress={handlePickPhoto}>
                  {photoUri ? (
                    <Image source={{ uri: photoUri }} style={styles.photoPreview} />
                  ) : (
                    <View style={[styles.photoPreview, styles.photoPlaceholder]}>
                      <Ionicons name="camera-outline" size={22} color={theme.secondaryText} />
                    </View>
                  )}
                  <Text style={styles.photoPickerLabel}>{photoUri ? 'Change photo' : 'Add photo (optional)'}</Text>
                </TouchableOpacity>

                <Input label="Name" value={name} onChangeText={setName} placeholder="e.g. BJ Jain" />

                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Birthday (optional)</Text>
                  {Platform.OS === 'web' ? (
                    <View style={styles.dateButton}>
                      <TouchableWithoutFeedback>
                        <input
                          type="date"
                          value={birthDate ? formatDate(birthDate) : ''}
                          onChange={onChangeWebDate}
                          style={styles.webDateInput}
                          aria-label="Birthday"
                        />
                      </TouchableWithoutFeedback>
                    </View>
                  ) : (
                    <TouchableOpacity style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                      <Text style={styles.dateText}>
                        {birthDate ? birthDate.toLocaleDateString() : 'Select a date'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color={theme.secondaryText} />
                    </TouchableOpacity>
                  )}
                  {showDatePicker && Platform.OS !== 'web' ? (
                    <RNDateTimePicker
                      mode="date"
                      value={birthDate || new Date(1980, 0, 1)}
                      maximumDate={new Date()}
                      display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                      onChange={onChangeDateNative}
                    />
                  ) : null}
                </View>

                <Input
                  label="Email (optional)"
                  value={email}
                  onChangeText={setEmail}
                  placeholder="name@email.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                <Input
                  label="Phone (optional)"
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="+1 555 123 4567"
                  keyboardType="phone-pad"
                />
              </View>
            )}

            {hasMembers && (
              <View style={styles.formGroup}>
                <Text style={styles.fieldLabel}>How are they related?</Text>
                <View style={styles.chipRow}>
                  {RELATIONSHIP_TYPES.map((rt) => {
                    const active = relationshipType === rt.value;
                    return (
                      <TouchableOpacity
                        key={rt.value}
                        style={[styles.chip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                        onPress={() => setRelationshipType(active ? null : rt.value)}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>{rt.label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {relationshipType && (
                  <>
                    <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Of</Text>
                    <View style={styles.chipRow}>
                      {(members || []).map((m) => {
                        const active = relativeId === m.id;
                        return (
                          <TouchableOpacity
                            key={m.id}
                            style={[styles.chip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                            onPress={() => setRelativeId(active ? null : m.id)}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>
                              {m.name}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {relativeId ? (
                      <Text style={styles.previewText}>
                        {relationshipLabel(relationshipType)} of {relativeName}
                      </Text>
                    ) : null}
                  </>
                )}
              </View>
            )}

            <Button
              label="Add to Family Tree"
              onPress={handleSubmit}
              loading={saving}
              disabled={!canSubmit || saving}
              style={styles.submitBtn}
            />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const useStyles = createThemedStyles(({ theme, radius, typography, shadow }) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: theme.overlay,
    },
    sheet: {
      maxHeight: '88%',
      backgroundColor: theme.card,
      borderTopLeftRadius: radius.lg + 4,
      borderTopRightRadius: radius.lg + 4,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      paddingBottom: spacing.lg,
      ...shadow,
    },
    handle: {
      alignSelf: 'center',
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      marginBottom: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    subtitle: {
      marginTop: 2,
      fontSize: typography.small.fontSize,
      color: theme.primary,
      fontWeight: '600',
    },
    modeRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    modeBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
    },
    modeBtnActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    modeBtnText: {
      fontSize: 13,
      fontWeight: '700',
      color: theme.text,
    },
    modeBtnTextActive: {
      color: '#FFFFFF',
    },
    loader: {
      marginVertical: spacing.xl,
    },
    emptyText: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    userList: {
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    userAvatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
    },
    userAvatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    userAvatarText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 13,
    },
    userInfo: {
      flex: 1,
      minWidth: 0,
    },
    userName: {
      fontSize: typography.body.fontSize,
      fontWeight: '600',
      color: theme.text,
    },
    userEmail: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
      marginTop: 1,
    },
    formGroup: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    fieldGroup: {
      gap: spacing.sm,
    },
    fieldLabel: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
    },
    fieldLabelSpaced: {
      marginTop: spacing.sm,
    },
    photoPicker: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    photoPreview: {
      width: 72,
      height: 72,
      borderRadius: 36,
    },
    photoPlaceholder: {
      backgroundColor: theme.inputBackground,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderStyle: 'dashed',
      alignItems: 'center',
      justifyContent: 'center',
    },
    photoPickerLabel: {
      fontSize: typography.small.fontSize,
      color: theme.primary,
      fontWeight: '600',
    },
    dateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      backgroundColor: theme.inputBackground,
    },
    dateText: {
      fontSize: typography.body.fontSize + 2,
      color: theme.text,
    },
    webDateInput: {
      flex: 1,
      border: 'none',
      backgroundColor: 'transparent',
      color: theme.text,
      fontSize: 15,
      fontFamily: 'inherit',
      outlineStyle: 'none',
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    previewText: {
      marginTop: spacing.sm,
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
      fontStyle: 'italic',
    },
    submitBtn: {
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
  })
);
