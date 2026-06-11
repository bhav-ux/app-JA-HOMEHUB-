import { useEffect, useState } from 'react';
import {
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
import { REWARD_ICONS, addReward, deleteReward, updateReward } from '../../../services/rewardsService';
import { ACCENT } from './rewardsTheme';

export default function RewardFormSheet({ visible, onClose, familyId, reward, uid, onSaved }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const isEditing = !!reward;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(REWARD_ICONS[0]);
  const [cost, setCost] = useState('50');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setTitle(reward?.title || '');
    setDescription(reward?.description || '');
    setIcon(reward?.icon || REWARD_ICONS[0]);
    setCost(reward ? String(reward.cost) : '50');
    setActive(reward?.active !== false);
    setSaving(false);
  }, [visible, reward]);

  const canSubmit = title.trim().length > 0 && Number(cost) > 0;

  const handleSave = async () => {
    if (!familyId || !uid || saving) return;
    if (!canSubmit) {
      showAlert('Missing info', 'Give the reward a title and a point cost.');
      return;
    }

    setSaving(true);
    try {
      const payload = { title, description, icon, cost: Number(cost) };
      if (isEditing) {
        await updateReward(familyId, reward.id, { ...payload, active });
      } else {
        await addReward(familyId, payload, uid);
      }
      onSaved?.();
      onClose?.();
    } catch (error) {
      console.error('[RewardFormSheet] Failed to save reward', error);
      showAlert('Error', 'Could not save this reward. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!isEditing) return;
    showConfirm('Delete reward?', `"${reward.title}" will be removed from the shop.`, {
      confirmText: 'Delete',
      onConfirm: async () => {
        try {
          await deleteReward(familyId, reward.id);
          onSaved?.();
          onClose?.();
        } catch (error) {
          console.error('[RewardFormSheet] Failed to delete reward', error);
          showAlert('Error', 'Could not delete this reward. Please try again.');
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
            <Text style={styles.title}>{isEditing ? 'Edit Reward' : 'New Reward'}</Text>
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
              <Input label="Title" value={title} onChangeText={setTitle} placeholder="e.g. Movie night pick" />
              <Input
                label="Description (optional)"
                value={description}
                onChangeText={setDescription}
                placeholder="Add any extra details"
              />
              <Input
                label="Cost (points)"
                value={cost}
                onChangeText={(v) => setCost(v.replace(/[^0-9]/g, ''))}
                placeholder="50"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.fieldLabel}>Icon</Text>
              <View style={styles.iconGrid}>
                {REWARD_ICONS.map((iconName) => {
                  const selected = icon === iconName;
                  return (
                    <TouchableOpacity
                      key={iconName}
                      style={[styles.iconOption, selected && styles.iconOptionActive]}
                      onPress={() => setIcon(iconName)}
                    >
                      <Ionicons name={iconName} size={20} color={selected ? '#FFFFFF' : ACCENT.streak} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {isEditing ? (
              <View style={[styles.formGroup, styles.toggleRow]}>
                <View>
                  <Text style={styles.fieldLabel}>Active</Text>
                  <Text style={styles.hintText}>Inactive rewards are hidden from the shop.</Text>
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
              label={isEditing ? 'Save Changes' : 'Create Reward'}
              onPress={handleSave}
              loading={saving}
              disabled={!canSubmit || saving}
              style={styles.submitBtn}
            />

            {isEditing ? (
              <Button label="Delete Reward" onPress={handleDelete} variant="danger" style={styles.deleteBtn} />
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
      backgroundColor: ACCENT.streakBg,
    },
    iconOptionActive: {
      backgroundColor: ACCENT.streak,
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
