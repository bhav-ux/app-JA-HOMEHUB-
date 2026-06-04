import { Alert, Platform } from 'react-native';

const joinMessage = (title, message) => [title, message].filter(Boolean).join('\n\n');
const getVisibleButtons = (buttons) => (Array.isArray(buttons) ? buttons.filter(Boolean) : []);

export function showAlert(title, message, buttons, options) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons, options);
    return;
  }

  const text = joinMessage(title, message);
  const visibleButtons = getVisibleButtons(buttons);

  if (visibleButtons.length <= 1) {
    if (typeof globalThis.alert === 'function') {
      globalThis.alert(text);
    } else {
      console.warn('[dialogs] Alert requested on web:', text);
    }
    visibleButtons[0]?.onPress?.();
    return;
  }

  const cancelButton = visibleButtons.find((button) => button.style === 'cancel');
  const actionButton = visibleButtons.find((button) => button.style !== 'cancel') || visibleButtons[0];

  if (typeof globalThis.confirm === 'function' && actionButton) {
    const choiceText = [
      text,
      `Press OK for ${actionButton.text || 'Continue'}.`,
      cancelButton?.text ? `Press Cancel for ${cancelButton.text}.` : null,
    ]
      .filter(Boolean)
      .join('\n\n');
    const confirmed = globalThis.confirm(choiceText);
    if (confirmed) {
      actionButton.onPress?.();
      return;
    }
    cancelButton?.onPress?.();
    return;
  }

  console.warn('[dialogs] Multi-button alert requested on web without confirm():', text);
  cancelButton?.onPress?.();
}

export function showConfirm(
  title,
  message,
  { onConfirm, onCancel, confirmText = 'Delete', cancelText = 'Cancel' } = {}
) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, [
      { text: cancelText, style: 'cancel', onPress: onCancel },
      { text: confirmText, style: 'destructive', onPress: onConfirm },
    ]);
    return;
  }

  const text = joinMessage(title, message);
  if (typeof globalThis.confirm !== 'function') {
    console.warn('[dialogs] Confirm requested on web without confirm():', text);
    onCancel?.();
    return;
  }

  const confirmed = globalThis.confirm(text);
  if (confirmed) {
    onConfirm?.();
    return;
  }
  onCancel?.();
}
