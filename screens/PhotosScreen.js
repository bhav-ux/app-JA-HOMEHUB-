import { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { collection, doc, getDoc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { colors, radius, shadow, spacing, typography } from '../src/theme';
import { deleteAlbum } from '../utils/delete';

export default function PhotosScreen({ navigation }) {
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(true);
  const longPressFlag = useRef(false);

  const user = auth.currentUser;

  useEffect(() => {
    const fetchFamily = async () => {
      if (!user?.uid) {
        setFamilyLoading(false);
        setLoading(false);
        return;
      }
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const familyValue = snap.exists() ? snap.data()?.familyId : null;
        setFamilyId(familyValue || null);
      } catch (error) {
        console.error('Error fetching family', error);
      } finally {
        setFamilyLoading(false);
      }
    };
    fetchFamily();
  }, [user]);

  useEffect(() => {
    if (!user || !familyId) {
      setLoading(false);
      return;
    }

    const albumsRef = collection(db, 'families', familyId, 'albums');
    const q = query(albumsRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setAlbums(data);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching albums', error);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [user, familyId]);

  const handleCreateAlbum = () => {
    if (!user) {
      Alert.alert('Not signed in', 'You need to be signed in to create albums.');
      return;
    }
    if (!familyId) {
      Alert.alert('No family found', 'Please try again later.');
      return;
    }
    navigation.navigate('CreateAlbum');
  };

  const handleAlbumPress = (album) => {
    if (longPressFlag.current) {
      longPressFlag.current = false;
      return;
    }
    if (!familyId) {
      Alert.alert('No family found', 'Please try again later.');
      return;
    }
    navigation.navigate('Album', { albumId: album.id, albumName: album.name });
  };

  const handleDeleteAlbum = (album) => {
    if (!auth.currentUser) {
      Alert.alert('Not signed in', 'You need to be signed in to delete albums.');
      return;
    }
    if (!album?.id || !familyId) return;
    longPressFlag.current = true;
    Alert.alert('Delete Album and all photos?', 'Are you sure you want to delete this?', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => {
          longPressFlag.current = false;
        },
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteAlbum({ familyId, albumId: album.id });
            if (navigation.canGoBack?.()) {
              navigation.goBack();
            }
          } catch (error) {
            console.error('Failed to delete album', error);
            Alert.alert('Delete failed', error.message || 'Could not delete album.');
          } finally {
            longPressFlag.current = false;
          }
        },
      },
    ]);
  };

  const renderAlbumItem = ({ item }) => (
    <TouchableOpacity
      style={styles.albumCard}
      onPress={() => handleAlbumPress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.albumContent}>
        <Text style={styles.albumName}>{item.name}</Text>
        <Text style={styles.albumCount}>0 photos</Text>
      </View>
      <TouchableOpacity
        onPress={() => handleDeleteAlbum(item)}
        accessibilityRole="button"
        accessibilityLabel="Delete album"
        style={styles.deleteButton}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
      <Text style={styles.chevron}>›</Text>
    </TouchableOpacity>
  );

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Please log in to view albums.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (familyLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!familyId) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>No family found for your account.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Albums</Text>
        {loading ? (
          <ActivityIndicator size="large" color={colors.primary} style={styles.loader} />
        ) : (
          <FlatList
            data={albums}
            keyExtractor={(item) => item.id}
            renderItem={renderAlbumItem}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No albums yet. Tap + to create one.</Text>
              </View>
            }
          />
        )}
        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateAlbum}
          accessibilityRole="button"
          accessibilityLabel="Create album"
          accessibilityHint="Create a new album"
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    color: colors.textPrimary,
  },
  loader: {
    marginTop: spacing.xl,
  },
  listContent: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxl,
  },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow,
  },
  albumContent: {
    flex: 1,
  },
  albumName: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  albumCount: {
    ...typography.body,
    color: colors.textSecondary,
  },
  chevron: {
    fontSize: 24,
    color: colors.textSecondary,
    marginLeft: spacing.md,
  },
  deleteButton: {
    marginLeft: spacing.md,
    minHeight: 44,
    minWidth: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: colors.error,
    fontSize: typography.small.fontSize + 1,
    fontWeight: '700',
  },
  emptyState: {
    marginTop: spacing.xxl + spacing.md,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.xl,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow,
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    marginTop: -4,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.background,
  },
  infoText: {
    fontSize: typography.body.fontSize + 1,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
