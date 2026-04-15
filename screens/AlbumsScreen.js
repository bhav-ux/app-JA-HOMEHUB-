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
import { createThemedStyles, spacing, typography, useAppTheme } from '../src/theme';

export default function AlbumsScreen({ navigation, route, familyId: familyIdProp }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
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
      <TouchableOpacity style={styles.deleteButton} onPress={() => handleDeleteAlbum(item)}>
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
            <ActivityIndicator size="large" color={theme.primary} />
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

        <TouchableOpacity style={styles.fab} onPress={handleCreateAlbum}>
          <Text style={styles.fabText}>+</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const useStyles = createThemedStyles(({ theme, radius, shadow }) =>
  StyleSheet.create({
    safeArea: { flex: 1, backgroundColor: theme.background },
    container: { flex: 1, padding: spacing.lg, backgroundColor: theme.background },
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
    emptyText: { fontSize: typography.body.fontSize + 1, color: theme.secondaryText },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadow,
    },
    fabText: { color: '#fff', fontSize: 32, lineHeight: 34, fontWeight: '700', marginTop: -2 },
  })
);
