import { useEffect, useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { leaveGroup, subscribeToConversation } from '../services/chatService';
import { useFamilyMemberProfiles } from '../hooks/useFamilyMemberProfiles';
import HomeHubAvatar from '../src/components/ui/HomeHubAvatar';
import { createThemedStyles, spacing, useAppTheme } from '../src/theme';
import { showAlert, showConfirm } from '../utils/dialogs';
import { hapticLight } from '../utils/haptics';

export default function GroupInfoScreen({ navigation, route }) {
  const chat = route?.params?.chat;
  const { type, familyId, chatId, name, emoji, members } = chat || {};
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const [currentUser, setCurrentUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [leaving, setLeaving] = useState(false);

  const familyMembers = useFamilyMemberProfiles(familyId);
  const profileByUid = useMemo(() => new Map(familyMembers.map((m) => [m.uid, m])), [familyMembers]);

  useEffect(() => onAuthStateChanged(auth, setCurrentUser), []);

  useEffect(() => {
    if (!chat) { setMessages([]); return; }
    return subscribeToConversation(chat, setMessages, () => setMessages([]));
  }, [familyId, chatId, type]);

  const mediaItems = useMemo(
    () => messages.filter((m) => m.type === 'image' || m.type === 'video' || m.type === 'document'),
    [messages]
  );

  const handleLeave = () => {
    hapticLight();
    showConfirm('Leave Group', `Are you sure you want to leave ${name || 'this group'}?`, {
      confirmText: 'Leave',
      onConfirm: async () => {
        if (!currentUser?.uid || leaving) return;
        setLeaving(true);
        try {
          await leaveGroup(familyId, chatId, currentUser.uid);
          navigation.getParent?.()?.popToTop?.() ?? navigation.goBack();
        } catch {
          showAlert('Error', 'Could not leave the group. Please try again.');
        } finally {
          setLeaving(false);
        }
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.headerBtn}
          accessibilityLabel="Go back"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Group Info</Text>
        <View style={styles.headerBtn} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: spacing.xl + insets.bottom }]}
      >
        {/* Identity */}
        <View style={styles.identity}>
          <HomeHubAvatar name={name} emoji={emoji || null} seed={chatId} size={84} />
          <Text style={styles.groupName}>{name || 'Group'}</Text>
          <Text style={styles.groupMeta}>{(members || []).length} members</Text>
        </View>

        {/* Members */}
        <Text style={styles.sectionLabel}>Members</Text>
        <View style={styles.card}>
          {(members || []).map((uid, index) => {
            const profile = profileByUid.get(uid);
            const isMe = uid === currentUser?.uid;
            return (
              <View
                key={uid}
                style={[styles.memberRow, index < members.length - 1 && styles.rowDivider]}
              >
                <HomeHubAvatar name={profile?.name} uri={profile?.photoURL} seed={uid} size={40} />
                <Text style={styles.memberName} numberOfLines={1}>
                  {profile?.name || 'Family Member'}{isMe ? ' (You)' : ''}
                </Text>
              </View>
            );
          })}
        </View>

        {/* Shared media */}
        <Text style={styles.sectionLabel}>Shared Media</Text>
        <View style={styles.card}>
          {mediaItems.length === 0 ? (
            <Text style={styles.emptyText}>No photos, videos, or files shared yet.</Text>
          ) : (
            <View style={styles.mediaGrid}>
              {mediaItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.mediaThumb}
                  activeOpacity={0.75}
                  onPress={() => {
                    if (item.mediaUrl) {
                      Linking.openURL(item.mediaUrl).catch(() =>
                        showAlert('Could not open', 'This file could not be opened.')
                      );
                    }
                  }}
                >
                  <Ionicons
                    name={item.type === 'image' ? 'image' : item.type === 'video' ? 'videocam' : 'document-text'}
                    size={20}
                    color={theme.secondaryText}
                  />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Leave group */}
        {type === 'group' ? (
          <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} disabled={leaving}>
            <Ionicons name="exit-outline" size={18} color={theme.error} />
            <Text style={styles.leaveBtnText}>{leaving ? 'Leaving…' : 'Leave Group'}</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 16, fontWeight: '700', color: theme.text },
    scrollContent: { paddingHorizontal: spacing.lg },

    identity: { alignItems: 'center', paddingVertical: spacing.lg },
    groupName: { fontSize: 20, fontWeight: '800', color: theme.text, marginTop: spacing.md },
    groupMeta: { fontSize: 13, color: theme.secondaryText, marginTop: 3 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.secondaryText,
      letterSpacing: 1,
      textTransform: 'uppercase',
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
      marginLeft: spacing.xs,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: spacing.sm,
      ...shadow,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: 10,
      paddingHorizontal: spacing.xs,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    memberName: { fontSize: 15, fontWeight: '600', color: theme.text, flex: 1 },

    emptyText: {
      fontSize: 13,
      color: theme.secondaryText,
      textAlign: 'center',
      paddingVertical: spacing.md,
    },
    mediaGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.xs,
      padding: spacing.xs,
    },
    mediaThumb: {
      width: 56,
      height: 56,
      borderRadius: radius.sm,
      backgroundColor: theme.inputBackground,
      alignItems: 'center',
      justifyContent: 'center',
    },

    leaveBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      marginTop: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: theme.error,
    },
    leaveBtnText: { fontSize: 15, fontWeight: '700', color: theme.error },
  })
);
