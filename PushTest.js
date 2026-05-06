import { useEffect } from 'react';
import { Alert } from 'react-native';

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';

async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    Alert.alert('Use a real iPhone');
    return;
  }

  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } =
      await Notifications.requestPermissionsAsync();

    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Notification permission denied');
    return;
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId;

  if (!projectId) {
    Alert.alert('Project ID missing');
    return;
  }

  const token = await Notifications.getExpoPushTokenAsync({
    projectId,
  });

  console.log(token.data);

  Alert.alert('Push Token', token.data);
}

export default function PushTest() {
  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  return null;
}