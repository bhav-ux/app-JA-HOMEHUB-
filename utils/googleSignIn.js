import Constants from 'expo-constants';
import { Platform } from 'react-native';
import {
  GoogleAuthProvider,
  signInWithCredential,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import * as WebBrowser from 'expo-web-browser';
import { auth, db } from '../firebaseConfig';
import { normalizeEmail } from './emailLinkAuth';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_OAUTH_PATH = 'oauth/google';

export function getGoogleWebClientId() {
  const clientId =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    Constants.expoConfig?.extra?.googleWebClientId;
  if (!clientId) {
    const error = new Error(
      'Google Web Client ID is missing. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in your .env file.'
    );
    error.code = 'auth/google-client-id-missing';
    throw error;
  }
  return clientId;
}

export function getGoogleOAuthClientIds() {
  const webClientId = getGoogleWebClientId();
  const extra = Constants.expoConfig?.extra || {};

  console.log({
    webClientId,
    androidClientId: extra.googleAndroidClientId,
    iosClientId: extra.googleIosClientId,
  });

  return {
    webClientId,
    iosClientId: extra.googleIosClientId || webClientId,
    androidClientId: extra.googleAndroidClientId || webClientId,
  };
}

export function getGoogleRedirectUriOptions() {
  return {
    scheme: Constants.expoConfig?.scheme || 'homehub',
    path: GOOGLE_OAUTH_PATH,
  };
}

export async function ensureGoogleSignInUserDocument(firebaseUser) {
  const { uid, email, displayName, photoURL } = firebaseUser;
  const userRef = doc(db, 'users', uid);
  const snapshot = await getDoc(userRef);

  if (snapshot.exists()) {
    return { isNewUser: false, data: snapshot.data() };
  }

  const payload = {
    displayName: (displayName || '').trim(),
    email: normalizeEmail(email || ''),
    photoURL: photoURL || null,
    familyId: null,
    createdAt: serverTimestamp(),
  };

  await setDoc(userRef, payload);
  return { isNewUser: true, data: payload };
}

export async function completeGoogleCredentialSignIn(idToken) {
  if (!idToken) {
    const error = new Error('Google did not return a valid sign-in token.');
    error.code = 'auth/invalid-credential';
    throw error;
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  await ensureGoogleSignInUserDocument(userCredential.user);
  return userCredential.user;
}

export async function signInWithGoogleWeb() {
  const provider = new GoogleAuthProvider();
  provider.addScope('profile');
  provider.addScope('email');
  provider.setCustomParameters({ prompt: 'select_account' });

  const result = await signInWithPopup(auth, provider);
  await ensureGoogleSignInUserDocument(result.user);
  return result.user;
}

export function extractGoogleIdToken(authResult) {
  return authResult?.authentication?.idToken || authResult?.params?.id_token || null;
}

export function isGoogleSignInCancelled(authResult) {
  return authResult?.type === 'cancel' || authResult?.type === 'dismiss';
}

export async function signInWithGoogle() {
  if (Platform.OS === 'web') {
    return signInWithGoogleWeb();
  }

  const error = new Error('Native Google sign-in must be started from the login screen.');
  error.code = 'auth/operation-not-supported-in-this-environment';
  throw error;
}
