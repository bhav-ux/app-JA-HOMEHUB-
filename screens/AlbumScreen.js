import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';
import * as ImagePicker from 'expo-image-picker';
import * as Crypto from 'expo-crypto';
import { addDoc, collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import { listenToUserDisplayName } from '../utils/user';
import { uploadImage } from '../utils/uploadImage';

export default function AlbumScreen({ route }) {
  const { albumName, albumId, familyId } = route?.params || {};
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [nameMap, setNameMap] = useState({});
  const nameListeners = useRef({});

  useEffect(() => {
    if (!familyId || !albumId) {
      setLoading(false);
      return;
    }
    const photosRef = collection(db, 'families', familyId, 'albums', albumId, 'photos');
    const q = query(photosRef, orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setLoading(false);
        setPhotos(data);
        const creatorIds = Array.from(new Set(data.map((p) => p.createdBy).filter(Boolean)));
        creatorIds.forEach((uid) => {
          if (nameListeners.current[uid]) return;
          nameListeners.current[uid] = listenToUserDisplayName(uid, (displayName) => {
            setNameMap((prev) => ({ ...prev, [uid]: displayName || '' }));
          });
        });
      },
      (error) => {
        console.error('Error fetching photos', error);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [albumId, familyId]);

  useEffect(() => {
    return () => {
      Object.values(nameListeners.current).forEach((unsubscribe) => unsubscribe?.());
      nameListeners.current = {};
    };
  }, []);

  useEffect(() => {
    const withUrls = photos.filter((photo) => photo.url);
    if (viewerVisible && withUrls.length === 0) {
      setViewerVisible(false);
    } else if (viewerIndex >= withUrls.length && withUrls.length > 0) {
      setViewerIndex(0);
    }
  }, [photos, viewerIndex, viewerVisible]);

  const requestPermission = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow photo library access to upload images.');
      return false;
    }
    return true;
  }, []);

  const handleUpload = useCallback(async () => {
    if (!familyId || !albumId) {
      Alert.alert('Missing info', 'Family or album not found.');
      return;
    }
    if (!auth.currentUser?.uid) {
      Alert.alert('Not signed in', 'You need to be signed in to upload photos.');
      return;
    }
    const hasPermission = await requestPermission();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (!asset?.uri) return;

    setUploading(true);
    try {
      const fileId = Crypto.randomUUID ? Crypto.randomUUID() : `${Date.now()}`;
      const filePath = `${familyId}/${albumId}/${fileId}.jpg`;
      const imageUrl = await uploadImage(asset.uri, filePath);

      await addDoc(collection(db, 'families', familyId, 'albums', albumId, 'photos'), {
        url: imageUrl,
        path: filePath,
        createdBy: auth.currentUser.uid,
        createdAt: new Date(),
      });
    } catch (error) {
      console.error('Upload failed', error);
      Alert.alert('Upload failed', error.message || 'Please try again.');
    } finally {
      setUploading(false);
    }
  }, [albumId, familyId, requestPermission]);

  const renderItem = ({ item }) => {
    const creatorLabel = nameMap[item.createdBy] || item.createdBy || '';
    return (
      <TouchableOpacity
        style={styles.photoWrapper}
        activeOpacity={0.9}
        onPress={() => {
          if (!item.url) {
            Alert.alert('Image unavailable', 'This photo could not be loaded yet.');
            return;
          }
          const nextViewerPhotos = photos.filter((photo) => photo.url);
          const nextIndex = nextViewerPhotos.findIndex((photo) => photo.id === item.id);
          if (nextIndex >= 0) {
            setViewerIndex(nextIndex);
            setViewerVisible(true);
          }
        }}
        accessibilityRole="button"
        accessibilityLabel="Open photo"
      >
        <View style={styles.photoBox}>
          {item.url ? (
            <Image source={{ uri: item.url }} style={styles.photo} />
          ) : (
            <View style={styles.photoPlaceholder}>
              <Text style={styles.photoPlaceholderText}>Unavailable</Text>
            </View>
          )}
        </View>
        {creatorLabel ? <Text style={styles.photoMeta}>{creatorLabel}</Text> : null}
      </TouchableOpacity>
    );
  };

  const listContentStyle = photos.length ? styles.listContent : styles.emptyContent;
  const viewerPhotos = photos.filter((photo) => photo.url);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.title}>{albumName || 'Album'}</Text>
      </View>

      {loading ? (
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      ) : !familyId || !albumId ? (
        <View style={styles.centerContent}>
          <Text style={styles.infoText}>Album details missing.</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={3}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={listContentStyle}
          ListEmptyComponent={<Text style={styles.emptyText}>No photos yet. Tap + to add one.</Text>}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, uploading && styles.fabDisabled]}
        onPress={handleUpload}
        disabled={uploading}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Upload photo"
      >
        {uploading ? <ActivityIndicator color="#fff" /> : <Text style={styles.fabText}>+</Text>}
      </TouchableOpacity>

      <ImageViewing
        images={viewerPhotos.map((p) => ({ uri: p.url }))}
        imageIndex={viewerIndex}
        visible={viewerVisible}
        onRequestClose={() => setViewerVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#666',
  },
  listContent: {
    paddingHorizontal: 8,
    paddingBottom: 96,
  },
  emptyContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  columnWrapper: {
    gap: 8,
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  photoWrapper: {
    flex: 1 / 3,
    paddingHorizontal: 2,
  },
  photoBox: {
    aspectRatio: 1,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#f2f2f2',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#e9e9e9',
  },
  photoPlaceholderText: {
    fontSize: 11,
    color: '#666',
  },
  photoMeta: {
    marginTop: 4,
    fontSize: 11,
    color: '#555',
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
  fabDisabled: {
    opacity: 0.7,
  },
});
