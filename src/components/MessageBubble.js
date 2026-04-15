import { StyleSheet, View } from 'react-native';
import { createThemedStyles, radius, spacing } from '../theme';

export default function MessageBubble({ isSender, children, style }) {
  const styles = useStyles();

  return (
    <View
      style={[
        styles.base,
        isSender ? styles.senderBubble : styles.receiverBubble,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const useStyles = createThemedStyles(({ theme, shadow }) =>
  StyleSheet.create({
    base: {
      maxWidth: '100%',
      borderRadius: radius.lg,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      ...shadow,
    },
    senderBubble: {
      backgroundColor: theme.messageBubbleSender,
    },
    receiverBubble: {
      backgroundColor: theme.messageBubbleReceiver,
    },
  })
);
