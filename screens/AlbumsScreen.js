import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { deleteAlbum } from '../utils/delete';
import { showAlert, showConfirm } from '../utils/dialogs';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import AnimatedCard from '../src/components/AnimatedCard';

const FAB_SPRING = { tension: 300, friction: 20, useNativeDriver: true };

const getAlbumPreviewUri = (album) =>
  album?.coverUrl ||
  album?.thumbnailUrl ||
  album?.previewUrl ||
  (Array.isArray(album?.previewImages) ? album.previewImages[0] : null) ||
  (Array.isArray(album?.photos) ? album.photos[0]?.url : null) ||
  null;

function AlbumCard({ item, onOpen, onDelete, styles, theme }) {
  const previewUri = getAlbumPreviewUri(item);
  const openLabel = `Open album ${item.name || 'Untitled Album'}`;

  if (Platform.OS === 'web') {
    return (
      <View style={styles.albumCard}>
        <TouchableOpacity
          style={styles.albumOpenButton}
          activeOpacity={0.85}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
        >
          <View style={styles.previewWrap}>
            {previewUri ? (
              <Image source={{ uri: previewUri }} style={styles.previewImage} />
            ) : (
              <View style={styles.previewPlaceholder}>
                <Ionicons name="images-outline" size={20} color={theme.secondaryText} />
              </View>
            )}
          </View>
          <View style={styles.albumInfo} pointerEvents="none">
            <Text style={styles.albumName} numberOfLines={1}>{item.name || 'Untitled Album'}</Text>
            <Text style={styles.albumMeta}>{previewUri ? 'Tap to open album' : 'No preview yet'}</Text>
          </View>
          <Text style={styles.chevron}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.deleteButton, styles.webDeleteButton]}
          activeOpacity={0.7}
          onPress={onDelete}
          accessibilityRole="button"
          accessibilityLabel={`Delete album ${item.name || 'Untitled Album'}`}
        >
          <Text style={styles.deleteButtonText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <AnimatedCard style={styles.albumCard} onPress={onOpen} accessibilityLabel={openLabel}>
      <View style={styles.previewWrap}>
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} />
        ) : (
          <View style={styles.previewPlaceholder}>
            <Ionicons name="images-outline" size={20} color={theme.secondaryText} />
          </View>
        )}
      </View>
      <View style={styles.albumInfo} pointerEvents="none">
        <Text style={styles.albumName} numberOfLines={1}>{item.name || 'Untitled Album'}</Text>
        <Text style={styles.albumMeta}>{previewUri ? 'Tap to open album' : 'No preview yet'}</Text>
      </View>
      <TouchableOpacity style={styles.deleteButton} activeOpacity={0.7} onPress={onDelete}>
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </AnimatedCard>
  );
}

export default function AlbumsScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const familyId = familyIdProp ?? route?.params?.familyId;
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const contentFade = useRef(new Animated.Value(0)).current;
  const hasAnimated = useRef(false);
  const fabScale = useRef(new Animated.Value(1)).current;

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 800);
  }, []);

  const onFabPressIn = useCallback(() => {
    Animated.spring(fabScale, { toValue: 0.88, ...FAB_SPRING }).start();
  }, [fabScale]);

  const onFabPressOut = useCallback(() => {
    Animated.spring(fabScale, { toValue: 1, ...FAB_SPRING }).start();
  }, [fabScale]);

  useEffect(() => {
    if (!loading && !hasAnimated.current) {
      hasAnimated.current = true;
      Animated.timing(contentFade, { toValue: 1, duration: 250, useNativeDriver: true }).start();
    }
  }, [loading, contentFade]);

  useEffect(() => {
    if (!familyId) {
      setLoading(false);
      return;
    }

    const albumsRef = collection(db, 'families', familyId, 'albums');
    const albumsQuery = query(albumsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      albumsQuery,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAlbums(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error loading albums', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [familyId]);

  const handleCreateAlbum = () => {
    if (!familyId) {
      showAlert('Family not set', 'Join or create a family to add albums.');
      return;
    }
    navigation.navigate('CreateAlbum', { familyId });
  };

  const handleOpenAlbum = (album) => {
    if (!familyId) return;
    navigation.navigate('Album', {
      albumId: album.id,
      albumName: album.name,
      familyId,
    });
  };

  const handleDeleteAlbum = (album) => {
    if (!auth.currentUser) {
      showAlert('Not signed in', 'You need to be signed in to delete albums.');
      return;
    }
    if (!album?.id || !familyId) return;
    console.log('[AlbumsScreen] Delete requested', { albumId: album.id, familyId });
    showConfirm('Delete Item', 'Are you sure you want to delete this?', {
      onConfirm: async () => {
        try {
          console.log('[AlbumsScreen] Confirmed delete', { albumId: album.id, familyId });
          await deleteAlbum({ familyId, albumId: album.id });
        } catch (error) {
          console.error('Failed to delete album', error);
          showAlert('Delete failed', getFirebaseErrorMessage(error, 'Could not delete album.'));
        }
      },
    });
  };

  const renderAlbum = ({ item }) => (
    <AlbumCard
      item={item}
      styles={styles}
      theme={theme}
      onOpen={() => handleOpenAlbum(item)}
      onDelete={() => handleDeleteAlbum(item)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Albums</Text>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : !familyId ? (
          <View style={styles.centerContent}>
            <Text style={styles.infoText}>Family not set. Join or create a family to view albums.</Text>
          </View>
        ) : (
          <Animated.View style={[styles.flex, { opacity: contentFade }]}>
            <FlatList
              data={albums}
              keyExtractor={(item) => item.id}
              renderItem={renderAlbum}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[
                albums.length ? styles.listContent : styles.emptyContent,
                { paddingBottom: spacing.xxl + 40 + insets.bottom },
              ]}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
              ListEmptyComponent={<Text style={styles.emptyText}>{"No albums yet.\nCreate your first family album."}</Text>}
            />
          </Animated.View>
        )}

        <Animated.View style={[styles.fab, { bottom: spacing.lg + Math.max(insets.bottom, spacing.xs), transform: [{ scale: fabScale }] }]}>
          <TouchableOpacity
            style={styles.fabTouchable}
            onPress={handleCreateAlbum}
            onPressIn={onFabPressIn}
            onPressOut={onFabPressOut}
            activeOpacity={0.9}
          >
            <Text style={styles.fabText}>+</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.md, backgroundColor: theme.background },
    flex: { flex: 1 },
    title: { ...typography.title, marginBottom: spacing.md, color: theme.text },
    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    infoText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center' },
    listContent: { paddingBottom: spacing.xxl + 40, gap: spacing.sm + 2 },
    emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
    albumCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      borderRadius: radius.lg,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    albumOpenButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      marginRight: spacing.md,
      ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
    },
    previewWrap: {
      width: 58,
      height: 58,
      borderRadius: radius.md,
      overflow: 'hidden',
      marginRight: spacing.md,
      backgroundColor: theme.inputBackground,
    },
    previewImage: { width: '100%', height: '100%' },
    previewPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.inputBackground,
    },
    albumInfo: { flex: 1, minWidth: 0 },
    albumName: { ...typography.heading, fontSize: typography.heading.fontSize - 1, color: theme.text },
    albumMeta: { marginTop: 3, fontSize: typography.small.fontSize, color: theme.secondaryText },
    chevron: {
      marginLeft: spacing.sm,
      fontSize: 24,
      color: theme.secondaryText,
    },
    deleteButton: {
      marginLeft: spacing.md,
      minHeight: 36,
      minWidth: 44,
      paddingHorizontal: spacing.sm + 2,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    webDeleteButton: Platform.OS === 'web' ? { zIndex: 3, elevation: 3, cursor: 'pointer' } : {},
    deleteButtonText: { color: theme.error, fontSize: typography.small.fontSize + 1, fontWeight: '700' },
    emptyText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center', lineHeight: 22 },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      overflow: 'hidden',
      ...shadow,
    },
    fabTouchable: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    fabText: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '700', marginTop: -2 },
  })
);
