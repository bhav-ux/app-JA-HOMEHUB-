import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { createThemedStyles, spacing, useAppTheme } from '../../theme';

/**
 * Shared bottom-sheet shell: backdrop, drag handle, rounded top corners,
 * optional title + close button, keyboard-avoiding body. Compose feature
 * content as `children` instead of re-implementing the Modal scaffolding
 * (this replaces the ad hoc Modal setups previously duplicated per screen).
 */
export default function HomeHubBottomSheet({ visible, onClose, title, children, avoidKeyboard = false }) {
  const { theme } = useAppTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();

  const body = (
    <View style={[styles.sheet, { paddingBottom: spacing.xl + insets.bottom }]}>
      <View style={styles.handle} />
      {title ? (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          {onClose ? (
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-circle" size={24} color={theme.secondaryText} />
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>
      {avoidKeyboard ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.avoider}
          pointerEvents="box-none"
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </Modal>
  );
}

const useStyles = createThemedStyles(({ theme }) =>
  StyleSheet.create({
    backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.overlay },
    avoider: { justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: theme.card,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: spacing.lg,
      paddingTop: spacing.sm,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: theme.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.md,
    },
    title: { fontSize: 16, fontWeight: '700', color: theme.text },
  })
);
