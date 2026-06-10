import { useEffect, useMemo, useState } from 'react';
import {
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
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../firebaseConfig';
import Button from '../Button';
import Input from '../Input';
import {
  RELATIONSHIP_TYPES,
  addRelationship,
  deleteFamilyMember,
  deleteRelationship,
  relationshipLabel,
  updateFamilyMember,
  uploadMemberPhoto,
} from '../../../services/familyTreeService';
import { createOrGetDM } from '../../../services/chatService';
import { showAlert, showConfirm } from '../../../utils/dialogs';
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

function describeRelationship(rel, memberId, membersById) {
  const otherId = rel.fromMemberId === memberId ? rel.toMemberId : rel.fromMemberId;
  const other = membersById.get(otherId);
  if (!other) return null;
  if (rel.fromMemberId === memberId) {
    return `${relationshipLabel(rel.type)} of ${other.name}`;
  }
  return `${relationshipLabel(rel.type)}: ${other.name}`;
}

export default function FamilyMemberSheet({
  visible,
  onClose,
  member,
  members,
  relationships,
  relationshipCaption,
  familyId,
  navigation,
}) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const currentUser = auth.currentUser;

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [liveUser, setLiveUser] = useState(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [photoUri, setPhotoUri] = useState(null);
  const [birthDate, setBirthDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  const [addingRelation, setAddingRelation] = useState(false);
  const [newRelType, setNewRelType] = useState(null);
  const [newRelTarget, setNewRelTarget] = useState(null);

  const membersById = useMemo(() => new Map((members || []).map((m) => [m.id, m])), [members]);

  useEffect(() => {
    if (!visible || !member) return;
    setEditing(false);
    setSaving(false);
    setName(member.name || '');
    setEmail(member.email || '');
    setPhone(member.phone || '');
    setPhotoUri(null);
    setBirthDate(member.birthDate ? new Date(`${member.birthDate}T00:00:00`) : null);
    setShowDatePicker(false);
    setAddingRelation(false);
    setNewRelType(null);
    setNewRelTarget(null);
    setLiveUser(null);

    if (member.userId) {
      getDoc(doc(db, 'users', member.userId))
        .then((snap) => {
          if (snap.exists()) setLiveUser(snap.data());
        })
        .catch((error) => console.error('[FamilyMemberSheet] Failed to load user profile', error));
    }
  }, [visible, member?.id]);

  if (!member) return null;

  const isPlaceholder = !!member.isPlaceholder;
  const isSelf = member.userId && member.userId === currentUser?.uid;
  const displayName = (isPlaceholder ? member.name : liveUser?.displayName || member.name) || 'Family Member';
  const displayPhoto = isPlaceholder ? member.photoURL : liveUser?.photoURL || member.photoURL;
  const displayEmail = isPlaceholder ? member.email : liveUser?.email || member.email;
  const displayPhone = member.phone;

  const memberRelationships = (relationships || []).filter(
    (rel) => rel.fromMemberId === member.id || rel.toMemberId === member.id
  );

  const otherMembers = (members || []).filter((m) => m.id !== member.id);

  const handlePickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission needed', 'Allow photo library access to change the photo.');
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

  const handleSaveDetails = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const updates = {
        name: name.trim() || member.name,
        birthDate: formatDate(birthDate),
        email: email.trim() || null,
        phone: phone.trim() || null,
      };

      if (photoUri) {
        updates.photoURL = await uploadMemberPhoto(photoUri, familyId, member.id);
      }

      await updateFamilyMember(familyId, member.id, updates);
      setEditing(false);
    } catch (error) {
      console.error('[FamilyMemberSheet] Failed to save member', error);
      showAlert('Error', 'Could not save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRelationship = async () => {
    if (!newRelType || !newRelTarget) return;
    setSaving(true);
    try {
      await addRelationship(
        familyId,
        { fromMemberId: member.id, toMemberId: newRelTarget, type: newRelType },
        currentUser.uid
      );
      setAddingRelation(false);
      setNewRelType(null);
      setNewRelTarget(null);
    } catch (error) {
      console.error('[FamilyMemberSheet] Failed to add relationship', error);
      showAlert('Error', 'Could not add this relationship.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMember = () => {
    showConfirm(
      'Remove from Family Tree',
      `${displayName} and all of their connections will be permanently removed. This can't be undone.`,
      {
        confirmText: 'Remove',
        onConfirm: async () => {
          try {
            await deleteFamilyMember(familyId, member.id, relationships);
            onClose?.();
          } catch (error) {
            console.error('[FamilyMemberSheet] Failed to delete member', error);
            showAlert('Error', 'Could not remove this family member.');
          }
        },
      }
    );
  };

  const handleDeleteRelationship = (rel) => {
    showConfirm('Remove Relationship', 'Remove this connection from the family tree?', {
      confirmText: 'Remove',
      onConfirm: async () => {
        try {
          await deleteRelationship(familyId, rel.id);
        } catch (error) {
          console.error('[FamilyMemberSheet] Failed to delete relationship', error);
          showAlert('Error', 'Could not remove this relationship.');
        }
      },
    });
  };

  const handleMessage = async () => {
    if (!member.userId || !familyId || !currentUser?.uid) return;
    try {
      const chatId = await createOrGetDM(familyId, currentUser.uid, member.userId);
      onClose?.();
      navigation.navigate('Conversation', {
        chat: {
          type: 'dm',
          familyId,
          chatId,
          name: displayName,
          members: [currentUser.uid, member.userId].sort(),
        },
      });
    } catch (error) {
      console.error('[FamilyMemberSheet] Failed to open conversation', error);
      showAlert('Error', 'Could not open conversation.');
    }
  };

  const handleViewEvents = () => {
    onClose?.();
    navigation.navigate('Events');
  };

  const handleViewAlbums = () => {
    onClose?.();
    navigation.navigate('MainTabs', { screen: 'Albums' });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{editing ? 'Edit Member' : 'Family Member'}</Text>
            <View style={styles.headerActions}>
              {!isSelf || isPlaceholder ? (
                <TouchableOpacity
                  onPress={() => setEditing((e) => !e)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  style={styles.headerIconBtn}
                >
                  <Ionicons name={editing ? 'close-outline' : 'pencil-outline'} size={20} color={theme.primary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={theme.secondaryText} />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {/* ── Profile header ── */}
            <View style={styles.profileHeader}>
              {editing && isPlaceholder ? (
                <TouchableOpacity onPress={handlePickPhoto}>
                  {(photoUri || displayPhoto) ? (
                    <Image source={{ uri: photoUri || displayPhoto }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: getAvatarColor(displayName) }]}>
                      <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
                    </View>
                  )}
                  <View style={[styles.avatarEditBadge, { backgroundColor: theme.primary }]}>
                    <Ionicons name="camera" size={12} color="#FFFFFF" />
                  </View>
                </TouchableOpacity>
              ) : displayPhoto ? (
                <Image source={{ uri: displayPhoto }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: getAvatarColor(displayName) }]}>
                  <Text style={styles.avatarText}>{getInitials(displayName)}</Text>
                </View>
              )}

              {editing ? (
                <Input value={name} onChangeText={setName} style={styles.nameInput} placeholder="Name" />
              ) : (
                <Text style={styles.name}>{displayName}</Text>
              )}

              {relationshipCaption ? <Text style={styles.relationshipCaption}>{relationshipCaption}</Text> : null}
              {isPlaceholder && !editing ? (
                <View style={[styles.placeholderPill, { backgroundColor: theme.inputBackground, borderColor: theme.border }]}>
                  <Ionicons name="person-add-outline" size={12} color={theme.secondaryText} />
                  <Text style={styles.placeholderPillText}>Placeholder profile</Text>
                </View>
              ) : null}
            </View>

            {/* ── Details ── */}
            {editing ? (
              <View style={styles.formGroup}>
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldLabel}>Birthday</Text>
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
                      <Text style={styles.dateText}>{birthDate ? birthDate.toLocaleDateString() : 'Select a date'}</Text>
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

                <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

                <Button label="Save Changes" onPress={handleSaveDetails} loading={saving} style={styles.saveBtn} />

                {!isSelf ? (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteMember}>
                    <Ionicons name="trash-outline" size={16} color={theme.error} />
                    <Text style={[styles.deleteBtnText, { color: theme.error }]}>Remove from Family Tree</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : (
              <View style={styles.infoList}>
                {member.birthDate ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="gift-outline" size={18} color={theme.secondaryText} />
                    <Text style={styles.infoText}>{new Date(`${member.birthDate}T00:00:00`).toLocaleDateString()}</Text>
                  </View>
                ) : null}
                {displayEmail ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="mail-outline" size={18} color={theme.secondaryText} />
                    <Text style={styles.infoText}>{displayEmail}</Text>
                  </View>
                ) : null}
                {displayPhone ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="call-outline" size={18} color={theme.secondaryText} />
                    <Text style={styles.infoText}>{displayPhone}</Text>
                  </View>
                ) : null}
              </View>
            )}

            {/* ── Relationships ── */}
            <View style={styles.formGroup}>
              <Text style={styles.sectionLabel}>Family Connections</Text>
              {memberRelationships.length === 0 ? (
                <Text style={styles.emptyText}>No connections yet.</Text>
              ) : (
                <View style={styles.relList}>
                  {memberRelationships.map((rel) => {
                    const description = describeRelationship(rel, member.id, membersById);
                    if (!description) return null;
                    return (
                      <View key={rel.id} style={styles.relRow}>
                        <Text style={styles.relText} numberOfLines={1}>{description}</Text>
                        {editing ? (
                          <TouchableOpacity onPress={() => handleDeleteRelationship(rel)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
                            <Ionicons name="trash-outline" size={17} color={theme.error} />
                          </TouchableOpacity>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}

              {editing && (
                addingRelation ? (
                  <View style={styles.addRelBox}>
                    <Text style={styles.fieldLabel}>This person is the...</Text>
                    <View style={styles.chipRow}>
                      {RELATIONSHIP_TYPES.map((rt) => {
                        const active = newRelType === rt.value;
                        return (
                          <TouchableOpacity
                            key={rt.value}
                            style={[styles.chip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                            onPress={() => setNewRelType(active ? null : rt.value)}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>{rt.label}</Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                    {newRelType ? (
                      <>
                        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced]}>Of</Text>
                        <View style={styles.chipRow}>
                          {otherMembers.map((m) => {
                            const active = newRelTarget === m.id;
                            return (
                              <TouchableOpacity
                                key={m.id}
                                style={[styles.chip, active && { backgroundColor: theme.primary, borderColor: theme.primary }]}
                                onPress={() => setNewRelTarget(active ? null : m.id)}
                              >
                                <Text style={[styles.chipText, active && styles.chipTextActive]} numberOfLines={1}>{m.name}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    ) : null}
                    <View style={styles.addRelActions}>
                      <TouchableOpacity onPress={() => { setAddingRelation(false); setNewRelType(null); setNewRelTarget(null); }} style={styles.cancelBtn}>
                        <Text style={styles.cancelBtnText}>Cancel</Text>
                      </TouchableOpacity>
                      <Button
                        label="Add"
                        onPress={handleAddRelationship}
                        disabled={!newRelType || !newRelTarget || saving}
                        loading={saving}
                        style={styles.addRelConfirm}
                      />
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.addRelBtn} onPress={() => setAddingRelation(true)}>
                    <Ionicons name="add-circle-outline" size={18} color={theme.primary} />
                    <Text style={[styles.addRelBtnText, { color: theme.primary }]}>Add relationship</Text>
                  </TouchableOpacity>
                )
              )}
            </View>

            {/* ── Quick links ── */}
            {!editing && (
              <View style={styles.formGroup}>
                <TouchableOpacity style={styles.linkRow} onPress={handleViewEvents}>
                  <Ionicons name="calendar-outline" size={20} color={theme.text} />
                  <Text style={styles.linkText}>Family Events</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.secondaryText} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.linkRow} onPress={handleViewAlbums}>
                  <Ionicons name="images-outline" size={20} color={theme.text} />
                  <Text style={styles.linkText}>Shared Albums</Text>
                  <Ionicons name="chevron-forward" size={18} color={theme.secondaryText} />
                </TouchableOpacity>
              </View>
            )}

            {/* ── Actions ── */}
            {!editing && member.userId && !isSelf ? (
              <Button label="Message" onPress={handleMessage} style={styles.messageBtn} />
            ) : null}
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
      maxHeight: '90%',
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
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
    },
    headerActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    headerIconBtn: {
      padding: 2,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    profileHeader: {
      alignItems: 'center',
      paddingVertical: spacing.lg,
      gap: 6,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
    },
    avatarFallback: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: '#FFFFFF',
      fontWeight: '700',
      fontSize: 28,
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 26,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: theme.card,
    },
    nameInput: {
      width: '100%',
      marginTop: spacing.sm,
    },
    name: {
      fontSize: 20,
      fontWeight: '700',
      color: theme.text,
      marginTop: spacing.sm,
      textAlign: 'center',
    },
    relationshipCaption: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      textAlign: 'center',
    },
    placeholderPill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      marginTop: spacing.xs,
      paddingHorizontal: spacing.sm,
      paddingVertical: 4,
      borderRadius: radius.lg,
      borderWidth: 1,
    },
    placeholderPillText: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    infoList: {
      gap: spacing.sm,
      marginBottom: spacing.lg,
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    infoText: {
      fontSize: typography.body.fontSize,
      color: theme.text,
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
    saveBtn: {
      marginTop: spacing.sm,
    },
    deleteBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingVertical: spacing.sm,
    },
    deleteBtnText: {
      fontSize: typography.body.fontSize,
      fontWeight: '700',
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.secondaryText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    emptyText: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    relList: {
      gap: spacing.xs,
    },
    relRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: theme.inputBackground,
      gap: spacing.sm,
    },
    relText: {
      flex: 1,
      fontSize: typography.body.fontSize,
      color: theme.text,
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
    addRelBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      paddingVertical: spacing.sm,
    },
    addRelBtnText: {
      fontSize: typography.body.fontSize,
      fontWeight: '600',
    },
    addRelBox: {
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addRelActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    cancelBtn: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
    },
    cancelBtnText: {
      fontSize: 15,
      fontWeight: '700',
      color: theme.secondaryText,
    },
    addRelConfirm: {
      flex: 1,
      minHeight: 44,
    },
    linkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: theme.inputBackground,
      marginBottom: spacing.xs,
    },
    linkText: {
      flex: 1,
      fontSize: typography.body.fontSize,
      fontWeight: '600',
      color: theme.text,
    },
    messageBtn: {
      marginBottom: spacing.xl,
    },
  })
);
