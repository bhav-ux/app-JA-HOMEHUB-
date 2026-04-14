import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { Ionicons } from '@expo/vector-icons';
import LoginScreen from './screens/LoginScreen';
import SignupScreen from './screens/SignupScreen';
import EventsScreen from './screens/EventsScreen';
import CalendarScreen from './screens/CalendarScreen';
import AlbumsScreen from './screens/AlbumsScreen';
import ChatScreen from './screens/ChatScreen';
import ProfileScreen from './screens/ProfileScreen';
import AddEventScreen from './screens/AddEventScreen';
import AddCalendarNoteScreen from './screens/AddCalendarNoteScreen';
import CreateAlbumScreen from './screens/CreateAlbumScreen';
import AlbumScreen from './screens/AlbumScreen';
import EventDetailsScreen from './screens/EventDetailsScreen';
import FamilySetupScreen from './screens/FamilySetupScreen';
import HomeDashboardScreen from './screens/HomeDashboardScreen';
import { auth, db } from './firebaseConfig';
import { registerForPushNotificationsAsync } from './utils/notifications';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs({ familyId, route }) {
  const familyIdValue = familyId ?? route?.params?.familyId;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => {
          const map = {
            Home: 'home-outline',
            Calendar: 'calendar-outline',
            Albums: 'images-outline',
            Chat: 'chatbubbles-outline',
            Profile: 'person-circle-outline',
          };
          const iconName = map[route.name] || 'ellipse-outline';
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
      <Tab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
      <Tab.Screen name="Profile">
        {(props) => <ProfileScreen {...props} familyId={familyIdValue} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export default function App() {
  const [initialRoute, setInitialRoute] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [familyId, setFamilyId] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      if (!user) {
        setFamilyId(null);
        setInitialRoute('Login');
        setCheckingAuth(false);
        return;
      }

      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        const familyValue = snap.exists() ? snap.data()?.familyId : null;
        setFamilyId(familyValue || null);
        setInitialRoute(familyValue ? 'MainTabs' : 'FamilySetup');
      } catch (error) {
        setFamilyId(null);
        setInitialRoute('FamilySetup');
      } finally {
        setCheckingAuth(false);
      }
    });

    return unsubscribe;
  }, []);

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
        if (!token) return;
        await setDoc(doc(db, 'users', user.uid), { expoPushToken: token }, { merge: true });
      } catch (error) {
        console.error('Failed to register push token', error);
      }
    };

    savePushToken();
  }, [user?.uid]);

  if (checkingAuth || initialRoute === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="auto" />
      <Stack.Navigator initialRouteName={initialRoute}>
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{ headerShown: false }}
        />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign up' }} />
        <Stack.Screen name="FamilySetup" component={FamilySetupScreen} options={{ title: 'Family Setup' }} />
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
        <Stack.Screen
          name="EventDetails"
          component={EventDetailsScreen}
          options={{ title: 'Event Details' }}
        />
        <Stack.Screen name="AddCalendarNote" component={AddCalendarNoteScreen} options={{ title: 'Add Calendar Note' }} />
        <Stack.Screen name="CreateAlbum" component={CreateAlbumScreen} options={{ title: 'Create Album' }} />
        <Stack.Screen name="Album" component={AlbumScreen} options={({ route }) => ({ title: route.params?.albumName || 'Album' })} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
