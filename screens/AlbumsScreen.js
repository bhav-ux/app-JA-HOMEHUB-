import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Alert,
} from 'react-native';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { deleteAlbum } from '../utils/delete';
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';
import AnimatedCard from '../src/components/AnimatedCard';

const FAB_SPRING = { tension: 300, friction: 20, useNativeDriver: true };

function AlbumCard({ item, onOpen, onDelete, styles }) {
  return (
    <AnimatedCard style={styles.albumCard} onPress={onOpen} accessibilityLabel={`Open album ${item.name || 'Untitled Album'}`}>
      <View style={styles.albumInfo} pointerEvents="none">
        <Text style={styles.albumName}>{item.name || 'Untitled Album'}</Text>
        <Text style={styles.albumMeta}>Tap to view</Text>
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
      Alert.alert('Family not set', 'Join or create a family to add albums.');
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
      Alert.alert('Not signed in', 'You need to be signed in to delete albums.');
      return;
    }
    if (!album?.id || !familyId) return;
    Alert.alert('Delete Item', 'Are you sure you want to delete this?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlbum({ familyId, albumId: album.id });
          } catch (error) {
            console.error('Failed to delete album', error);
            Alert.alert('Delete failed', error.message || 'Could not delete album.');
          }
        },
      },
    ]);
  };

  const renderAlbum = ({ item }) => (
    <AlbumCard
      item={item}
      styles={styles}
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
              contentContainerStyle={albums.length ? styles.listContent : styles.emptyContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
              ListEmptyComponent={<Text style={styles.emptyText}>{"No albums yet.\nCreate your first family album."}</Text>}
            />
          </Animated.View>
        )}

        <Animated.View style={[styles.fab, { transform: [{ scale: fabScale }] }]}>
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
    container: { flex: 1, padding: spacing.lg, backgroundColor: theme.background },
    flex: { flex: 1 },
    title: { ...typography.title, marginBottom: spacing.lg, color: theme.text },
    centerContent: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    infoText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center' },
    listContent: { paddingBottom: spacing.xxl, gap: spacing.md },
    emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
    albumCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: spacing.lg,
      borderRadius: radius.md,
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      ...shadow,
    },
    albumInfo: { flex: 1 },
    albumName: { ...typography.heading, color: theme.text },
    albumMeta: { marginTop: spacing.xs, fontSize: typography.body.fontSize, color: theme.secondaryText },
    deleteButton: {
      marginLeft: spacing.md,
      minHeight: 44,
      minWidth: 44,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: theme.error,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteButtonText: { color: theme.error, fontSize: typography.small.fontSize + 1, fontWeight: '700' },
    emptyText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText, textAlign: 'center', lineHeight: 22 },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
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
