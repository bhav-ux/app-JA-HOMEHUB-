import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import {
  createGroup,
  createOrGetDM,
  subscribeToFamilyMemberIds,
} from '../services/chatService';
import { createThemedStyles, spacing, typography, useAppTheme, radius } from '../src/theme';
import { showAlert } from '../utils/dialogs';
import { listenToUserDisplayName } from '../utils/user';

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const AVATAR_COLORS = [
  '#6366F1', '#F43F5E', '#F59E0B', '#0D9488',
  '#8B5CF6', '#EC4899', '#14B8A6', '#F97316',
];

function getAvatarColor(str) {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function InitialsAvatar({ name, size = 44, uid, emoji }) {
  const bg = getAvatarColor(uid || name || '');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ fontSize: emoji ? size * 0.5 : size * 0.38, color: '#fff', fontWeight: '700' }}>
        {emoji || getInitials(name)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function NewChatScreen({ navigation, route }) {
  const familyId = route?.params?.familyId;
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState(null);
  const [mode, setMode] = useState('dm'); // 'dm' | 'group'
  const [familyMemberIds, setFamilyMemberIds] = useState([]);
  const [nameMap, setNameMap] = useState({});

  // DM state
  const [creatingDmFor, setCreatingDmFor] = useState(null); // uid being opened

  // Group state
  const [groupName, setGroupName] = useState('');
  const [groupEmoji, setGroupEmoji] = useState('');
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [creating, setCreating] = useState(false);

  const nameListenersRef = useRef({});

  // Resolve current user
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setSelectedMembers(new Set([user.uid]));
      }
    });
    return unsub;
  }, []);

  // Subscribe to family member IDs + their display names
  useEffect(() => {
    if (!familyId) return;
    const unsub = subscribeToFamilyMemberIds(familyId, (ids) => {
      setFamilyMemberIds(ids);
      ids.forEach((uid) => {
        if (nameListenersRef.current[uid]) return;
        nameListenersRef.current[uid] = listenToUserDisplayName(uid, (displayName) => {
          setNameMap((prev) => ({ ...prev, [uid]: displayName || '' }));
        });
      });
    });
    return () => {
      unsub();
      Object.values(nameListenersRef.current).forEach((fn) => fn?.());
      nameListenersRef.current = {};
    };
  }, [familyId]);

  const otherMembers = familyMemberIds.filter((uid) => uid !== currentUser?.uid);

  // ---------------------------------------------------------------------------
  // DM handlers
  // ---------------------------------------------------------------------------

  const handleStartDM = async (targetUid) => {
    if (!currentUser?.uid || !familyId || creatingDmFor) return;
    try {
      setCreatingDmFor(targetUid);
      const dmId = await createOrGetDM(familyId, currentUser.uid, targetUid);
      const targetName = nameMap[targetUid] || 'Family Member';
      navigation.replace('Conversation', {
        chat: {
          type: 'dm',
          familyId,
          chatId: dmId,
          name: targetName,
          members: [currentUser.uid, targetUid].sort(),
        },
      });
    } catch (error) {
      showAlert('Error', 'Could not start conversation. Please try again.');
    } finally {
      setCreatingDmFor(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Group handlers
  // ---------------------------------------------------------------------------

  const toggleMember = (uid) => {
    if (uid === currentUser?.uid) return; // cannot deselect self
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.add(uid);
      }
      return next;
    });
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      showAlert('Name required', 'Please enter a name for the group.');
      return;
    }
    const extraMembers = [...selectedMembers].filter((uid) => uid !== currentUser?.uid);
    if (extraMembers.length === 0) {
      showAlert('Add members', 'Please select at least one other family member for the group.');
      return;
    }
    if (!currentUser?.uid || !familyId || creating) return;

    try {
      setCreating(true);
      const allMembers = [...selectedMembers];
      const groupId = await createGroup(
        familyId,
        groupName.trim(),
        groupEmoji.trim().slice(0, 2),
        allMembers,
        currentUser.uid
      );
      navigation.replace('Conversation', {
        chat: {
          type: 'group',
          familyId,
          chatId: groupId,
          name: groupName.trim(),
          emoji: groupEmoji.trim().slice(0, 2),
          members: allMembers,
        },
      });
    } catch (error) {
      showAlert('Error', 'Could not create the group. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right', 'bottom']}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>New Chat</Text>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color={theme.text} />
          </TouchableOpacity>
        </View>

        {/* Mode tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, mode === 'dm' && styles.tabActive]}
            onPress={() => setMode('dm')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'dm' && styles.tabTextActive]}>Direct Message</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, mode === 'group' && styles.tabActive]}
            onPress={() => setMode('group')}
            activeOpacity={0.8}
          >
            <Text style={[styles.tabText, mode === 'group' && styles.tabTextActive]}>New Group</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + insets.bottom }]}
          keyboardShouldPersistTaps="handled"
        >
          {/* ---- DM Mode ---- */}
          {mode === 'dm' && (
            <View>
              {otherMembers.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No family members yet</Text>
                  <Text style={styles.emptyBody}>
                    Invite others to your family to start messaging them directly.
                  </Text>
                </View>
              ) : (
                otherMembers.map((uid) => {
                  const memberName = nameMap[uid] || 'Family Member';
                  const isLoading = creatingDmFor === uid;
                  return (
                    <TouchableOpacity
                      key={uid}
                      style={styles.memberRow}
                      onPress={() => handleStartDM(uid)}
                      activeOpacity={0.75}
                      disabled={!!creatingDmFor}
                    >
                      <InitialsAvatar name={memberName} uid={uid} size={44} />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{memberName}</Text>
                      </View>
                      {isLoading ? (
                        <ActivityIndicator size="small" color={theme.primary} />
                      ) : (
                        <Ionicons name="chevron-forward" size={18} color={theme.border} />
                      )}
                    </TouchableOpacity>
                  );
                })
              )}
            </View>
          )}

          {/* ---- Group Mode ---- */}
          {mode === 'group' && (
            <View style={styles.groupForm}>
              {/* Group name */}
              <Text style={styles.fieldLabel}>Group Name</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Family Book Club, Weekend Plans..."
                placeholderTextColor={theme.secondaryText}
                value={groupName}
                onChangeText={setGroupName}
                maxLength={50}
              />

              {/* Emoji */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.md }]}>Emoji (optional)</Text>
              <TextInput
                style={[styles.textInput, { fontSize: 24, textAlign: 'center', letterSpacing: 4 }]}
                placeholder="🏡"
                placeholderTextColor={theme.secondaryText}
                value={groupEmoji}
                onChangeText={(t) => setGroupEmoji(t.slice(0, 2))}
                maxLength={2}
              />

              {/* Members */}
              <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>Members</Text>

              {/* Current user row — always selected, disabled */}
              {currentUser && (
                <View style={[styles.memberRow, styles.memberRowSelected]}>
                  <InitialsAvatar name={nameMap[currentUser.uid] || 'You'} uid={currentUser.uid} size={44} />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>{nameMap[currentUser.uid] || 'You'}</Text>
                    <Text style={styles.memberSubtext}>You</Text>
                  </View>
                  <View style={styles.checkboxChecked}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                </View>
              )}

              {otherMembers.map((uid) => {
                const memberName = nameMap[uid] || 'Family Member';
                const isSelected = selectedMembers.has(uid);
                return (
                  <TouchableOpacity
                    key={uid}
                    style={[styles.memberRow, isSelected && styles.memberRowSelected]}
                    onPress={() => toggleMember(uid)}
                    activeOpacity={0.75}
                  >
                    <InitialsAvatar name={memberName} uid={uid} size={44} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>{memberName}</Text>
                    </View>
                    <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                      {isSelected && <Ionicons name="checkmark" size={14} color="#fff" />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {otherMembers.length === 0 && (
                <Text style={styles.emptyBody}>No other family members to add.</Text>
              )}

              {/* Create button */}
              <TouchableOpacity
                style={[styles.createButton, creating && styles.createButtonDisabled]}
                onPress={handleCreateGroup}
                activeOpacity={0.8}
                disabled={creating}
              >
                {creating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.createButtonText}>Create Group</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: spacing.xl + insets.bottom }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, backgroundColor: theme.background },

    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.headerBackground,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: theme.text,
    },
    closeBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: theme.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },

    tabs: {
      flexDirection: 'row',
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
      marginBottom: spacing.sm,
      backgroundColor: theme.inputBackground,
      borderRadius: radius.md,
      padding: 3,
    },
    tab: {
      flex: 1,
      paddingVertical: 9,
      borderRadius: radius.sm + 2,
      alignItems: 'center',
    },
    tabActive: {
      backgroundColor: theme.card,
      ...shadow,
    },
    tabText: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.secondaryText,
    },
    tabTextActive: {
      color: theme.primary,
    },

    scrollContent: { paddingTop: spacing.sm },

    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.lg,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    memberRowSelected: {
      backgroundColor: theme.primaryLight,
    },
    memberInfo: {
      flex: 1,
      marginLeft: 12,
    },
    memberName: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.text,
    },
    memberSubtext: {
      fontSize: 12,
      color: theme.secondaryText,
      marginTop: 2,
    },

    checkbox: {
      width: 24,
      height: 24,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkboxChecked: {
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },

    groupForm: { paddingTop: spacing.sm },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: theme.secondaryText,
      marginBottom: spacing.sm,
      marginTop: spacing.sm,
      paddingHorizontal: spacing.lg,
    },
    textInput: {
      marginHorizontal: spacing.lg,
      backgroundColor: theme.inputBackground,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },

    createButton: {
      marginHorizontal: spacing.lg,
      marginTop: spacing.xl,
      backgroundColor: theme.primary,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    createButtonDisabled: { opacity: 0.6 },
    createButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: '700',
    },

    emptyState: {
      paddingTop: spacing.xxl,
      paddingHorizontal: spacing.xl,
      alignItems: 'center',
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: theme.text,
      marginBottom: spacing.sm,
    },
    emptyBody: {
      fontSize: 14,
      color: theme.secondaryText,
      textAlign: 'center',
      lineHeight: 20,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
  })
);
