import { useEffect, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Button from '../Button';
import Input from '../Input';
import { createThemedStyles, spacing, useAppTheme } from '../../theme';
import { hapticLight } from '../../../utils/haptics';
import { showAlert, showConfirm } from '../../../utils/dialogs';
import {
  CHORE_FREQUENCIES,
  CHORE_ICONS,
  VERIFICATION_TYPES,
  addChore,
  deleteChore,
  updateChore,
} from '../../../services/rewardsService';
import { ACCENT } from './rewardsTheme';

export default function ChoreFormSheet({ visible, onClose, familyId, chore, members, uid, onSaved }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const isEditing = !!chore;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(CHORE_ICONS[0]);
  const [points, setPoints] = useState('10');
  const [frequency, setFrequency] = useState('daily');
  const [verification, setVerification] = useState('parent');
  const [assignedTo, setAssignedTo] = useState([]);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(chore?.title || '');
    setDescription(chore?.description || '');
    setIcon(chore?.icon || CHORE_ICONS[0]);
    setPoints(chore ? String(chore.points) : '10');
    setFrequency(chore?.frequency || 'daily');
    setVerification(chore?.verification || 'parent');
    setAssignedTo(chore?.assignedTo || []);
    setActive(chore?.active !== false);
    setSaving(false);
  }, [visible, chore]);

  const toggleAssignee = (memberUid) => {
    hapticLight();
    setAssignedTo((prev) =>
      prev.includes(memberUid) ? prev.filter((id) => id !== memberUid) : [...prev, memberUid]
    );
  };

  const canSubmit = title.trim().length > 0 && Number(points) > 0;

  const handleSave = async () => {
    if (!familyId || !uid || saving) return;
    if (!canSubmit) {
      showAlert('Missing info', 'Give the chore a title and a point value.');
      return;
    }

    setSaving(true);
    try {
      const payload = { title, description, icon, points: Number(points), frequency, verification, assignedTo };
      if (isEditing) {
        await updateChore(familyId, chore.id, { ...payload, active });
      } else {
        await addChore(familyId, payload, uid);
      }
      onSaved?.();
      onClose?.();
    } catch (error) {
      console.error('[ChoreFormSheet] Failed to save chore', error);
      showAlert('Error', 'Could not save this chore. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!isEditing) return;
    showConfirm('Delete chore?', `"${chore.title}" will be removed for everyone.`, {
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteChore(familyId, chore.id);
          onSaved?.();
          onClose?.();
        } catch (error) {
          console.error('[ChoreFormSheet] Failed to delete chore', error);
          showAlert('Error', 'Could not delete this chore. Please try again.');
        }
      },
    });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior="padding">
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headerRow}>
            <Text style={styles.title}>{isEditing ? 'Edit Chore' : 'New Chore'}</Text>
            <TouchableOpacity
              onPress={() => {
                hapticLight();
                onClose?.();
              }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="close" size={24} color={theme.secondaryText} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={styles.formGroup}>
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Make your bed" />
              <Input
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="Add any extra instructions"
              />
              <Input
                label="Points"
                value={points}
                onChangeText={(v) => setPoints(v.replace(/[^0-9]/g, ''))}
                placeholder="10"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {CHORE_ICONS.map((iconName) => {
                  const selected = icon === iconName;
                  return (
                    <TouchableOpacity
                      key={iconName}
                      style={[styles.iconOption, selected && styles.iconOptionActive]}
                      onPress={() => setIcon(iconName)}
                    >
                      <Ionicons name={iconName} size={20} color={selected ? '#FFFFFF' : ACCENT.level} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>How often?</Text>
              <View style={styles.chipRow}>
                {CHORE_FREQUENCIES.map((f) => {
                  const selected = frequency === f.value;
                  return (
                    <TouchableOpacity
                      key={f.value}
                      style={[styles.chip, selected && styles.chipActive]}
                      onPress={() => setFrequency(f.value)}
                    >
                      <Text style={[styles.chipText, selected && styles.chipTextActive]}>{f.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Verification</Text>
              <View style={styles.verificationList}>
                {VERIFICATION_TYPES.map((v) => {
                  const selected = verification === v.value;
                  return (
                    <TouchableOpacity
                      key={v.value}
                      style={[styles.verificationOption, selected && styles.verificationOptionActive]}
                      onPress={() => setVerification(v.value)}
                    >
                      <View style={styles.verificationInfo}>
                        <Text style={[styles.verificationLabel, selected && styles.verificationLabelActive]}>
                          {v.label}
                        </Text>
                        <Text style={styles.verificationDescription}>{v.description}</Text>
                      </View>
                      {selected ? (
                        <Ionicons name="checkmark-circle" size={20} color={ACCENT.level} />
                      ) : (
                        <View style={styles.radioCircle} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Assign to</Text>
              <View style={styles.assigneeList}>
                {(members || []).map((member) => {
                  const selected = assignedTo.includes(member.uid);
                  return (
                    <TouchableOpacity
                      key={member.uid}
                      style={[styles.assigneeRow, selected && styles.assigneeRowActive]}
                      onPress={() => toggleAssignee(member.uid)}
                    >
                      {member.photoURL ? (
                        <Image source={{ uri: member.photoURL }} style={styles.assigneeAvatar} />
                      ) : (
                        <View style={[styles.assigneeAvatar, styles.assigneeAvatarFallback]}>
                          <Ionicons name="person" size={16} color={theme.secondaryText} />
                        </View>
                      )}
                      <Text style={styles.assigneeName} numberOfLines={1}>{member.name}</Text>
                      {selected ? <Ionicons name="checkmark-circle" size={18} color={ACCENT.level} /> : null}
                    </TouchableOpacity>
                  );
                })}
              </View>
              {(members || []).length === 0 ? (
                <Text style={styles.emptyText}>No family members yet.</Text>
              ) : null}
              <Text style={styles.hintText}>Leave empty to assign to everyone in the family.</Text>
            </View>

            {isEditing ? (
              <View style={[styles.formGroup, styles.toggleRow]}>
                <View>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Text style={styles.hintText}>Inactive chores are hidden from members.</Text>
                </View>
                <Switch
                  value={active}
                  onValueChange={setActive}
                  trackColor={{ true: ACCENT.level, false: theme.border }}
                  thumbColor="#FFFFFF"
                />
              </View>
            ) : null}

            <Button
              label={isEditing ? 'Save Changes' : 'Create Chore'}
              onPress={handleSave}
              loading={saving}
              disabled={!canSubmit || saving}
              style={styles.submitBtn}
            />

            {isEditing ? (
              <Button label="Delete Chore" onPress={handleDelete} variant="danger" style={styles.deleteBtn} />
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
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    formGroup: {
      gap: spacing.md,
      marginBottom: spacing.lg,
    },
    fieldLabel: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
    },
    iconGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    iconOption: {
      width: 42,
      height: 42,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: ACCENT.levelBg,
    },
    iconOptionActive: {
      backgroundColor: ACCENT.level,
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
    chipActive: {
      backgroundColor: ACCENT.level,
      borderColor: ACCENT.level,
    },
    chipText: {
      fontSize: 13,
      fontWeight: '600',
      color: theme.text,
    },
    chipTextActive: {
      color: '#FFFFFF',
    },
    verificationList: {
      gap: spacing.sm,
    },
    verificationOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
      backgroundColor: theme.inputBackground,
    },
    verificationOptionActive: {
      borderColor: ACCENT.level,
      backgroundColor: ACCENT.levelBg,
    },
    verificationInfo: {
      flex: 1,
      gap: 2,
    },
    verificationLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: theme.text,
    },
    verificationLabelActive: {
      color: ACCENT.level,
    },
    verificationDescription: {
      fontSize: 12,
      color: theme.secondaryText,
    },
    radioCircle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    assigneeList: {
      gap: spacing.xs,
    },
    assigneeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      padding: spacing.sm,
      borderRadius: radius.md,
      borderWidth: 1.5,
      borderColor: theme.border,
    },
    assigneeRowActive: {
      borderColor: ACCENT.level,
      backgroundColor: ACCENT.levelBg,
    },
    assigneeAvatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
    },
    assigneeAvatarFallback: {
      backgroundColor: theme.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },
    assigneeName: {
      flex: 1,
      fontSize: 14,
      fontWeight: '600',
      color: theme.text,
    },
    emptyText: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    hintText: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
      marginTop: 2,
    },
    toggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    submitBtn: {
      marginTop: spacing.sm,
    },
    deleteBtn: {
      marginTop: spacing.sm,
      marginBottom: spacing.xl,
    },
  })
);
