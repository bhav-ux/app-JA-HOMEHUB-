import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import * as Location from 'expo-location';
import HomeHubBottomSheet from '../ui/HomeHubBottomSheet';
import { createThemedStyles, spacing } from '../../theme';
import { showAlert } from '../../../utils/dialogs';

const COMING_SOON = new Set(['poll', 'chore', 'event']);

const OPTIONS = [
  { key: 'photo', label: 'Photo', icon: 'image', color: '#8B5CF6', bg: '#8B5CF622' },
  { key: 'camera', label: 'Camera', icon: 'camera', color: '#EC4899', bg: '#EC489922' },
  { key: 'video', label: 'Video', icon: 'videocam', color: '#F43F5E', bg: '#F43F5E22' },
  { key: 'document', label: 'Document', icon: 'document-text', color: '#3B82F6', bg: '#3B82F622' },
  { key: 'location', label: 'Location', icon: 'location', color: '#14B8A6', bg: '#14B8A622' },
  { key: 'poll', label: 'Poll', icon: 'bar-chart', color: '#F59E0B', bg: '#F59E0B22' },
  { key: 'chore', label: 'Chore', icon: 'checkmark-done', color: '#22C55E', bg: '#22C55E22' },
  { key: 'event', label: 'Event', icon: 'calendar', color: '#EF4444', bg: '#EF444422' },
];

export default function ShareSheet({ visible, onClose, onPhotoPicked, onVideoPicked, onDocumentPicked, onLocationPicked }) {
  const styles = useStyles();

  const runThenClose = async (fn) => {
    onClose();
    await fn();
  };

  const handlePhoto = () => runThenClose(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed', 'Allow photo library access to share a photo.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) onPhotoPicked(uri);
  });

  const handleCamera = () => runThenClose(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed', 'Allow camera access to take a photo.'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) onPhotoPicked(uri);
  });

  const handleVideo = () => runThenClose(async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed', 'Allow photo library access to share a video.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.7 });
    if (result.canceled) return;
    const uri = result.assets?.[0]?.uri;
    if (uri) onVideoPicked(uri);
  });

  const handleDocument = () => runThenClose(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets?.[0];
    if (asset?.uri) onDocumentPicked({ uri: asset.uri, name: asset.name });
  });

  const handleLocation = () => runThenClose(async () => {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) { showAlert('Permission needed', 'Allow location access to share your location.'); return; }
    try {
      const position = await Location.getCurrentPositionAsync({});
      onLocationPicked({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    } catch {
      showAlert('Location unavailable', 'Could not get your current location. Please try again.');
    }
  });

  const handlePress = (key) => {
    if (COMING_SOON.has(key)) {
      onClose();
      showAlert('Coming soon', `Sharing a ${key} in chat is on the way.`);
      return;
    }
    if (key === 'photo') return handlePhoto();
    if (key === 'camera') return handleCamera();
    if (key === 'video') return handleVideo();
    if (key === 'document') return handleDocument();
    if (key === 'location') return handleLocation();
  };

  return (
    <HomeHubBottomSheet visible={visible} onClose={onClose} title="Share something">
      <View style={styles.grid}>
        {OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={styles.item}
            onPress={() => handlePress(opt.key)}
            activeOpacity={0.75}
          >
            <View style={[styles.iconCircle, { backgroundColor: opt.bg }]}>
              <Ionicons name={opt.icon} size={22} color={opt.color} />
            </View>
            <Text style={styles.label}>{opt.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </HomeHubBottomSheet>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingBottom: spacing.md,
    },
    item: {
      width: '25%',
      alignItems: 'center',
      paddingVertical: spacing.sm,
    },
    iconCircle: {
      width: 52,
      height: 52,
      borderRadius: 26,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.text,
    },
  })
);
