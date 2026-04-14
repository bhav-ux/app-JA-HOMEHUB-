import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
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

export default function AlbumsScreen({ navigation, route, familyId: familyIdProp }) {
  const familyId = familyIdProp ?? route?.params?.familyId;
  const [albums, setAlbums] = useState([]);
  const [loading, setLoading] = useState(true);

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
    if (!familyId) {
      return;
    }
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
    Alert.alert('Delete Album and all photos?', 'Are you sure you want to delete this?', [
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
    <View style={styles.albumCard}>
      <TouchableOpacity style={styles.albumInfo} onPress={() => handleOpenAlbum(item)}>
        <Text style={styles.albumName}>{item.name || 'Untitled Album'}</Text>
        <Text style={styles.albumMeta}>Tap to view</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => handleDeleteAlbum(item)}
        accessibilityRole="button"
        accessibilityLabel="Delete album"
      >
        <Text style={styles.deleteButtonText}>Delete</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Albums</Text>

        {loading ? (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#007AFF" />
          </View>
        ) : !familyId ? (
          <View style={styles.centerContent}>
            <Text style={styles.infoText}>Family not set. Join or create a family to view albums.</Text>
          </View>
        ) : (
          <FlatList
            data={albums}
            keyExtractor={(item) => item.id}
            renderItem={renderAlbum}
            contentContainerStyle={albums.length ? styles.listContent : styles.emptyContent}
            ListEmptyComponent={<Text style={styles.emptyText}>No albums yet. Tap + to create one.</Text>}
          />
        )}

        <TouchableOpacity
          style={styles.fab}
          onPress={handleCreateAlbum}
          accessibilityRole="button"
          accessibilityLabel="Create album"
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
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#555',
    textAlign: 'center',
  },
  listContent: {
    paddingBottom: 96,
    gap: 12,
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  albumCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#f7f7f7',
    borderWidth: 1,
    borderColor: '#e4e4e4',
  },
  albumInfo: {
    flex: 1,
  },
  albumName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111',
  },
  albumMeta: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
  deleteButton: {
    marginLeft: 12,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ff3b30',
  },
  deleteButtonText: {
    color: '#ff3b30',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 16,
    color: '#777',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  fabText: {
    color: '#fff',
    fontSize: 32,
    lineHeight: 34,
    fontWeight: '700',
    marginTop: -2,
  },
});
