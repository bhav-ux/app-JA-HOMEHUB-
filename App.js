import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { createNavigationContainerRef, NavigationContainer, StackActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import OnboardingScreen, { ONBOARDING_KEY } from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import EmailLinkSentScreen from './screens/EmailLinkSentScreen';
import EmailLinkAuthScreen from './screens/EmailLinkAuthScreen';
import EventsScreen from './screens/EventsScreen';
import CalendarScreen from './screens/CalendarScreen';
import AlbumsScreen from './screens/AlbumsScreen';
import ChatsHomeScreen from './screens/ChatsHomeScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddEventScreen from './screens/AddEventScreen';
import AddCalendarNoteScreen from './screens/AddCalendarNoteScreen';
import CreateAlbumScreen from './screens/CreateAlbumScreen';
import AlbumScreen from './screens/AlbumScreen';
import EventDetailsScreen from './screens/EventDetailsScreen';
import FamilySetupScreen from './screens/FamilySetupScreen';
import FamilyManagementScreen from './screens/FamilyManagementScreen';
import HomeDashboardScreen from './screens/HomeDashboardScreen';
import ConversationScreen from './screens/ConversationScreen';
import NewChatScreen from './screens/NewChatScreen';
import { auth, db } from './firebaseConfig';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { getNavigationTheme } from './src/theme';
import { showAlert } from './utils/dialogs';
import { isEmailLinkSignInUrl } from './utils/emailLinkAuth';
import { registerForPushNotificationsAsync } from './utils/notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const navigationRef = createNavigationContainerRef();

function MainTabs({ familyId, route }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const familyIdValue = familyId ?? route?.params?.familyId;

  return (
    <Tab.Navigator
      screenOptions={({ route: tabRoute }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.secondaryText,
        tabBarStyle: {
          backgroundColor: theme.tabBarBackground,
          borderTopColor: theme.border,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: Math.max(insets.bottom, 6),
        },
        tabBarIcon: ({ color, size }) => {
          const map = {
            Home: 'home-outline',
            Calendar: 'calendar-outline',
            Albums: 'images-outline',
            Chat: 'chatbubbles-outline',
            Profile: 'person-circle-outline',
          };
          const iconName = map[tabRoute.name] || 'ellipse-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home">
        {(props) => <HomeDashboardScreen {...props} familyId={familyIdValue} />}
      </Tab.Screen>
      <Tab.Screen name="Calendar" component={CalendarScreen} />
      <Tab.Screen name="Albums">
        {(props) => <AlbumsScreen {...props} familyId={familyIdValue} />}
      </Tab.Screen>
      <Tab.Screen name="Chat" component={ChatsHomeScreen} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen
        name="Profile"
        options={{
          headerShown: true,
          headerTitle: 'Profile',
          headerTitleAlign: 'center',
        }}
      >
        {(props) => <ProfileScreen {...props} familyId={familyIdValue} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { theme, isDark, isThemeReady } = useTheme();
  const [initialRoute, setInitialRoute] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [user, setUser] = useState(null);
  const [navigationReady, setNavigationReady] = useState(false);
  const [pendingEmailLink, setPendingEmailLink] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setFamilyId(null);
        try {
          const done = await AsyncStorage.getItem(ONBOARDING_KEY);
          setInitialRoute(done === 'true' ? 'Login' : 'Onboarding');
        } catch {
          setInitialRoute('Login');
        }
        setCheckingAuth(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', nextUser.uid));
        const familyValue = snap.exists() ? snap.data()?.familyId : null;
        setFamilyId(familyValue || null);
        setInitialRoute(familyValue ? 'MainTabs' : 'FamilySetup');
      } catch (error) {
        console.error('[App] Failed to determine initial route', error);
        setFamilyId(null);
        setInitialRoute('FamilySetup');
      } finally {
        setCheckingAuth(false);
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const queueEmailLink = (url) => {
      if (url && isEmailLinkSignInUrl(url)) {
        setPendingEmailLink(url);
      }
    };

    Linking.getInitialURL()
      .then((url) => {
        if (isMounted) {
          queueEmailLink(url);
        }
      })
      .catch((error) => {
        console.error('[App] Failed to read initial URL', error);
      });

    const subscription = Linking.addEventListener('url', ({ url }) => {
      queueEmailLink(url);
    });

    return () => {
      isMounted = false;
      subscription.remove?.();
    };
  }, []);

  useEffect(() => {
    if (!navigationReady || !pendingEmailLink || !navigationRef.isReady()) {
      return;
    }

    const currentRoute = navigationRef.getCurrentRoute();
    const params = { emailLink: pendingEmailLink, receivedAt: Date.now() };

    if (currentRoute?.name === 'EmailLinkAuth') {
      navigationRef.dispatch(StackActions.replace('EmailLinkAuth', params));
    } else {
      navigationRef.navigate('EmailLinkAuth', params);
    }

    setPendingEmailLink('');
  }, [navigationReady, pendingEmailLink]);

  useEffect(() => {
    if (!user) return;
    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, (snap) => {
      const familyValue = snap.exists() ? snap.data()?.familyId : null;
      setFamilyId(familyValue || null);
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    if (!user?.uid) return;

    const savePushToken = async () => {
      try {
        const token = await registerForPushNotificationsAsync();

        console.log('EXPO PUSH TOKEN:', token);

        if (!token) {
          showAlert('Push registration', 'No push token received');
          return;
        }

        showAlert('Push registration', `Push token received:\n\n${token}`);

        await setDoc(
          doc(db, 'users', user.uid),
          { expoPushToken: token },
          { merge: true }
        );
      } catch (error) {
        console.error('Failed to register push token', error);

        showAlert('Push registration failed', error.message);
      }
    };

    savePushToken();
  }, [user?.uid]);

  const navigationTheme = useMemo(() => getNavigationTheme(theme, isDark), [theme, isDark]);

  if (!isThemeReady || checkingAuth || initialRoute === null) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.background,
        }}
      >
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      theme={navigationTheme}
      onReady={() => setNavigationReady(true)}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack.Navigator
        initialRouteName={initialRoute}
        screenOptions={{
          headerStyle: { backgroundColor: theme.headerBackground },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text, fontWeight: '700' },
          headerTitleAlign: 'center',
          headerBackTitleVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: theme.background },
        }}
      >
        <Stack.Screen
          name="Onboarding"
          component={OnboardingScreen}
          options={{ headerShown: false, gestureEnabled: false, animation: 'fade' }}
        />
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign up' }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
        <Stack.Screen
          name="EmailLinkSent"
          component={EmailLinkSentScreen}
          options={{ title: 'Check your email' }}
        />
        <Stack.Screen
          name="EmailLinkAuth"
          component={EmailLinkAuthScreen}
          options={{ title: 'Email sign-in' }}
        />
        <Stack.Screen name="FamilySetup" component={FamilySetupScreen} options={{ title: 'Family Setup' }} />
        <Stack.Screen name="FamilyManagement" component={FamilyManagementScreen} options={{ title: 'Manage Family' }} />
        <Stack.Screen
          name="MainTabs"
          options={{
            headerShown: false,
            gestureEnabled: false,
          }}
        >
          {(props) => <MainTabs {...props} familyId={familyId} />}
        </Stack.Screen>
        <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Events' }} />
        <Stack.Screen name="AddEvent" component={AddEventScreen} options={{ title: 'Add Event' }} />
        <Stack.Screen name="EventDetails" component={EventDetailsScreen} options={{ title: 'Event Details' }} />
        <Stack.Screen name="AddCalendarNote" component={AddCalendarNoteScreen} options={{ title: 'Add Calendar Note' }} />
        <Stack.Screen name="CreateAlbum" component={CreateAlbumScreen} options={{ title: 'Create Album' }} />
        <Stack.Screen
          name="Album"
          component={AlbumScreen}
          options={({ route }) => ({ title: route.params?.albumName || 'Album' })}
        />
        <Stack.Screen
          name="Conversation"
          component={ConversationScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="NewChat"
          component={NewChatScreen}
          options={{ title: 'New Chat', headerTitleAlign: 'center' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppNavigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
