import { Alert, Platform } from 'react-native';

const joinMessage = (title, message) => [title, message].filter(Boolean).join('\n\n');

export function showAlert(title, message, buttons, options) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const text = joinMessage(title, message);
  if (typeof globalThis.alert === 'function') {
    globalThis.alert(text);
  } else {
    console.warn('[dialogs] Alert requested on web:', text);
  }
  buttons?.[0]?.onPress?.();
}

export function showConfirm(title, message, { onConfirm, onCancel } = {}) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: onCancel },
      { text: 'Delete', style: 'destructive', onPress: onConfirm },
    ]);
    return;
  }

  const text = joinMessage(title, message);
  const confirmed = typeof globalThis.confirm === 'function' ? globalThis.confirm(text) : true;
  if (confirmed) {
    onConfirm?.();
    return;
  }
  onCancel?.();
}
