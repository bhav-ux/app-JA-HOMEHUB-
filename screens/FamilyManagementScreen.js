import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, doc, onSnapshot, query, where } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import {
  ROLES,
  canDemoteAdmin,
  canPromoteToAdmin,
  canRemoveMember,
  canTransferOwnership,
  deleteFamily,
  demoteToMember,
  getRole,
  getRoleBadge,
  promoteToAdmin,
  removeMember,
  transferOwnership,
} from '../utils/familyRoles';
import { showConfirm, showAlert } from '../utils/dialogs';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(member) {
  const name = (member.displayName || '').trim();
  return (name[0] || member.email?.[0] || '?').toUpperCase();
}

function getRolePillColors(role, theme) {
  switch (role) {
    case ROLES.OWNER: return { bg: `${theme.primary}22`, color: theme.primary };
    case ROLES.ADMIN: return { bg: `${theme.error}18`,   color: theme.error   };
    default:          return { bg: `${theme.secondaryText}15`, color: theme.secondaryText };
  }
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FamilyManagementScreen({ navigation, route }) {
  const familyId = route?.params?.familyId;
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const user = auth.currentUser;

  const [familyData,     setFamilyData]     = useState(null);
  const [members,        setMembers]         = useState([]);
  const [loading,        setLoading]         = useState(true);
  const [actionLoading,  setActionLoading]   = useState(null); // uid currently being actioned
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteInput,    setDeleteInput]     = useState('');
  const [deletingFamily, setDeletingFamily]  = useState(false);

  const myRole = familyData ? getRole(familyData, user?.uid) : ROLES.MEMBER;

  // Subscribe to family document (roles, name)
  useEffect(() => {
    if (!familyId) { setLoading(false); return; }
    const unsub = onSnapshot(
      doc(db, 'families', familyId),
      (snap) => {
        setFamilyData(snap.exists() ? { id: snap.id, ...snap.data() } : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [familyId]);

  // Subscribe to family members (realtime)
  useEffect(() => {
    if (!familyId) return;
    const q = query(collection(db, 'users'), where('familyId', '==', familyId));
    const unsub = onSnapshot(q, (snap) => {
      setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [familyId]);

  // ── Action handlers ────────────────────────────────────────────────────────

  const withLoading = useCallback(async (uid, fn) => {
    setActionLoading(uid);
    try {
      await fn();
    } catch (err) {
      showAlert('Error', getFirebaseErrorMessage(err, 'Action failed. Please try again.'));
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleRemove = useCallback((member) => {
    const name = member.displayName?.trim() || member.email || 'this member';
    showConfirm(
      'Remove Member',
      `Remove ${name} from the family? They will immediately lose access.`,
      {
        confirmText: 'Remove',
        onConfirm: () => withLoading(member.id, () => removeMember({ familyId, targetUid: member.id })),
      }
    );
  }, [familyId, withLoading]);

  const handlePromote = useCallback((member) => {
    const name = member.displayName?.trim() || member.email || 'this member';
    showConfirm(
      'Promote to Admin',
      `Make ${name} an admin? They'll be able to remove regular members.`,
      {
        confirmText: 'Promote',
        onConfirm: () => withLoading(member.id, () => promoteToAdmin({ familyId, targetUid: member.id })),
      }
    );
  }, [familyId, withLoading]);

  const handleDemote = useCallback((member) => {
    const name = member.displayName?.trim() || member.email || 'this member';
    showConfirm(
      'Remove Admin',
      `Remove ${name}'s admin privileges? They'll return to a regular member.`,
      {
        confirmText: 'Remove',
        onConfirm: () => withLoading(member.id, () => demoteToMember({ familyId, targetUid: member.id })),
      }
    );
  }, [familyId, withLoading]);

  const handleTransfer = useCallback((member) => {
    const name = member.displayName?.trim() || member.email || 'this member';
    showConfirm(
      'Transfer Ownership',
      `Make ${name} the family owner? You will become an admin. This cannot be undone without their cooperation.`,
      {
        confirmText: 'Transfer',
        onConfirm: () =>
          withLoading(member.id, () =>
            transferOwnership({ familyId, currentOwnerId: user.uid, newOwnerId: member.id })
          ),
      }
    );
  }, [familyId, user?.uid, withLoading]);

  const handleDeleteFamily = useCallback(async () => {
    if (deleteInput !== 'DELETE' || deletingFamily) return;
    setDeletingFamily(true);
    try {
      const memberIds = members.map((m) => m.id);
      await deleteFamily({ familyId, memberIds });
      const root = navigation.getParent?.() || navigation;
      root.replace('FamilySetup');
    } catch (err) {
      showAlert('Error', getFirebaseErrorMessage(err, 'Could not delete the family.'));
      setDeletingFamily(false);
      setShowDeleteModal(false);
      setDeleteInput('');
    }
  }, [deleteInput, deletingFamily, familyId, members, navigation]);

  // ── Loading / error states ─────────────────────────────────────────────────

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!familyData) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
        <View style={styles.centered}>
          <Text style={styles.emptyText}>Family not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Sort: owner first, then admins, then members
  const roleOrder = { [ROLES.OWNER]: 0, [ROLES.ADMIN]: 1, [ROLES.MEMBER]: 2 };
  const sortedMembers = [...members].sort((a, b) => {
    const ra = roleOrder[getRole(familyData, a.id)] ?? 2;
    const rb = roleOrder[getRole(familyData, b.id)] ?? 2;
    if (ra !== rb) return ra - rb;
    const nameA = (a.displayName || a.email || '').toLowerCase();
    const nameB = (b.displayName || b.email || '').toLowerCase();
    return nameA.localeCompare(nameB);
  });

  const familyName = familyData.name?.trim() || 'Family Group';
  const shortId    = familyId?.length > 14 ? `${familyId.slice(0, 14)}…` : familyId;
  const deleteReady = deleteInput === 'DELETE';

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: spacing.xxl + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── FAMILY HEADER ── */}
        <View style={styles.familyHeader}>
          <View style={[styles.familyIconBox, { backgroundColor: `${theme.primary}18` }]}>
            <Text style={styles.familyIconEmoji}>🏠</Text>
          </View>
          <Text style={styles.familyName}>{familyName}</Text>
          <Text style={styles.familyMeta}>
            {members.length} member{members.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.familyId}>ID: {shortId}</Text>
        </View>

        {/* ── MEMBERS ── */}
        <Text style={styles.sectionTitle}>Members</Text>
        <View style={styles.card}>
          {sortedMembers.map((member, index) => {
            const isMe       = member.id === user?.uid;
            const memberRole = getRole(familyData, member.id);
            const badge      = getRoleBadge(memberRole);
            const pillColors = getRolePillColors(memberRole, theme);
            const label      = member.displayName?.trim() || member.email || '—';
            const initial    = getInitial(member);
            const isLast     = index === sortedMembers.length - 1;
            const isLoading  = actionLoading === member.id;

            const showPromote  = !isMe && canPromoteToAdmin(myRole, memberRole);
            const showDemote   = !isMe && canDemoteAdmin(myRole, memberRole);
            const showTransfer = !isMe && canTransferOwnership(myRole) && memberRole !== ROLES.OWNER;
            const showRemove   = !isMe && canRemoveMember(myRole, memberRole);
            const hasActions   = showPromote || showDemote || showTransfer || showRemove;

            return (
              <View
                key={member.id}
                style={[styles.memberRow, !isLast && styles.memberRowDivider]}
              >
                {/* Avatar */}
                <View style={[styles.memberAvatar, { backgroundColor: `${theme.primary}20` }]}>
                  <Text style={[styles.memberAvatarText, { color: theme.primary }]}>
                    {initial}
                  </Text>
                </View>

                {/* Info */}
                <View style={styles.memberInfo}>
                  <View style={styles.memberNameRow}>
                    <Text style={styles.memberName} numberOfLines={1}>{label}</Text>
                    {isMe && (
                      <View style={[styles.youPill, { backgroundColor: `${theme.primary}18` }]}>
                        <Text style={[styles.youPillText, { color: theme.primary }]}>You</Text>
                      </View>
                    )}
                  </View>
                  {member.displayName?.trim() && member.email ? (
                    <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
                  ) : null}
                  <View style={[styles.rolePill, { backgroundColor: pillColors.bg }]}>
                    <Text style={[styles.rolePillText, { color: pillColors.color }]}>{badge}</Text>
                  </View>
                </View>

                {/* Actions */}
                {isLoading ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : hasActions ? (
                  <View style={styles.actionGroup}>
                    {showTransfer && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleTransfer(member)}
                        accessibilityLabel={`Transfer ownership to ${label}`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="swap-horizontal-outline" size={17} color={theme.primary} />
                      </TouchableOpacity>
                    )}
                    {showPromote && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handlePromote(member)}
                        accessibilityLabel={`Promote ${label} to admin`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="shield-checkmark-outline" size={17} color={theme.primary} />
                      </TouchableOpacity>
                    )}
                    {showDemote && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleDemote(member)}
                        accessibilityLabel={`Remove ${label}'s admin`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="shield-outline" size={17} color={theme.secondaryText} />
                      </TouchableOpacity>
                    )}
                    {showRemove && (
                      <TouchableOpacity
                        style={styles.actionBtn}
                        onPress={() => handleRemove(member)}
                        accessibilityLabel={`Remove ${label} from family`}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Ionicons name="person-remove-outline" size={17} color={theme.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* ── LEGEND ── */}
        <View style={styles.legend}>
          <Text style={styles.legendItem}>👑 Owner · full control</Text>
          <Text style={styles.legendItem}>🛡️ Admin · can remove members</Text>
          <Text style={styles.legendItem}>👤 Member · standard access</Text>
        </View>

        {/* ── DANGER ZONE (owner only) ── */}
        {myRole === ROLES.OWNER && (
          <>
            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>Danger Zone</Text>
            <View style={[styles.card, styles.dangerCard]}>
              <View style={styles.dangerInfo}>
                <Text style={styles.dangerTitle}>Delete Family</Text>
                <Text style={styles.dangerBody}>
                  Permanently removes this family and all its data. Every member will be signed out of this family immediately.
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.dangerBtn, { borderColor: theme.error }]}
                onPress={() => { setDeleteInput(''); setShowDeleteModal(true); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.dangerBtnText, { color: theme.error }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* ── DELETE CONFIRMATION MODAL ── */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowDeleteModal(false); setDeleteInput(''); }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Delete Family</Text>
            <Text style={styles.modalBody}>
              This is permanent and cannot be undone. All events, albums, and chat history will be erased. Every member will lose access immediately.
            </Text>
            <Text style={styles.modalPrompt}>
              Type <Text style={styles.modalCode}>DELETE</Text> to confirm.
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                deleteReady && { borderColor: theme.error },
              ]}
              value={deleteInput}
              onChangeText={setDeleteInput}
              placeholder="Type DELETE"
              placeholderTextColor={theme.secondaryText}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: theme.border }]}
                onPress={() => { setShowDeleteModal(false); setDeleteInput(''); }}
              >
                <Text style={[styles.modalBtnLabel, { color: theme.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modalDeleteBtn,
                  { backgroundColor: deleteReady ? theme.error : `${theme.error}35` },
                ]}
                onPress={handleDeleteFamily}
                disabled={!deleteReady || deletingFamily}
              >
                {deletingFamily ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={[styles.modalBtnLabel, { color: '#fff' }]}>Delete Forever</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea:  { flex: 1, backgroundColor: theme.background },
    centered:  { flex: 1, alignItems: 'center', justifyContent: 'center' },
    container: {
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
      backgroundColor: theme.background,
    },

    emptyText: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      textAlign: 'center',
    },

    // ── Family header ──
    familyHeader: {
      alignItems: 'center',
      paddingVertical: spacing.xl,
    },
    familyIconBox: {
      width: 72,
      height: 72,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.md,
    },
    familyIconEmoji: { fontSize: 34 },
    familyName: {
      fontSize: 22,
      fontWeight: '700',
      color: theme.text,
      textAlign: 'center',
    },
    familyMeta: {
      marginTop: 4,
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
    },
    familyId: {
      marginTop: 3,
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
      fontWeight: '500',
    },

    // ── Section label ──
    sectionTitle: {
      fontSize: 11,
      fontWeight: '600',
      color: theme.secondaryText,
      textTransform: 'uppercase',
      letterSpacing: 0.9,
      marginTop: spacing.lg,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },

    // ── Card shell ──
    card: {
      borderRadius: radius.lg,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
      ...shadow,
    },

    // ── Member rows ──
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      gap: spacing.md,
    },
    memberRowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    memberAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    memberAvatarText: {
      fontSize: 15,
      fontWeight: '700',
      lineHeight: 18,
    },
    memberInfo:    { flex: 1, minWidth: 0 },
    memberNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexWrap: 'wrap',
    },
    memberName: {
      fontSize: typography.body.fontSize + 1,
      fontWeight: '600',
      color: theme.text,
      flexShrink: 1,
    },
    memberEmail: {
      marginTop: 2,
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
    },
    rolePill: {
      alignSelf: 'flex-start',
      marginTop: 5,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    rolePillText: {
      fontSize: 11,
      fontWeight: '600',
    },
    youPill: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
      borderRadius: radius.sm,
    },
    youPillText: {
      fontSize: 11,
      fontWeight: '700',
    },
    actionGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
      flexShrink: 0,
    },
    actionBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBackground,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    },

    // ── Legend ──
    legend: {
      marginTop: spacing.md,
      marginLeft: spacing.xs,
      gap: 4,
    },
    legendItem: {
      fontSize: 12,
      color: theme.secondaryText,
      lineHeight: 18,
    },

    // ── Danger zone ──
    dangerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.lg,
      gap: spacing.md,
    },
    dangerInfo: { flex: 1 },
    dangerTitle: {
      fontSize: typography.body.fontSize + 1,
      fontWeight: '600',
      color: theme.text,
      marginBottom: 3,
    },
    dangerBody: {
      fontSize: typography.small.fontSize,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    dangerBtn: {
      borderWidth: 1,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 8,
      flexShrink: 0,
    },
    dangerBtnText: {
      fontSize: 13,
      fontWeight: '700',
    },

    // ── Delete modal ──
    modalOverlay: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.overlay,
      paddingHorizontal: spacing.lg,
    },
    modalSheet: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.xl,
      ...shadow,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '800',
      color: theme.error,
      marginBottom: spacing.md,
    },
    modalBody: {
      fontSize: typography.body.fontSize,
      color: theme.secondaryText,
      lineHeight: 22,
      marginBottom: spacing.sm,
    },
    modalPrompt: {
      fontSize: typography.body.fontSize,
      color: theme.text,
      marginTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    modalCode: {
      fontWeight: '800',
      color: theme.error,
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : Platform.OS === 'android' ? 'monospace' : 'monospace',
    },
    modalInput: {
      backgroundColor: theme.inputBackground,
      borderWidth: 1.5,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 16,
      fontWeight: '700',
      color: theme.text,
      letterSpacing: 3,
      marginBottom: spacing.md,
    },
    modalActions: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    modalCancelBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalDeleteBtn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    modalBtnLabel: {
      fontSize: 15,
      fontWeight: '700',
    },
  })
);
