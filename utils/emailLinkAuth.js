import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Linking, Platform } from 'react-native';
import {
  isSignInWithEmailLink,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  updateProfile,
} from 'firebase/auth';
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';

const PENDING_EMAIL_LINK_KEY = '@ja_homehub_pending_email_link';
const EMAIL_FOR_SIGN_IN_KEY = '@ja_homehub_email_for_sign_in';
const EMAIL_LINK_PATH = '/auth/email-link';

const FALLBACK_NATIVE_LINK_BASE_URL =
  Constants.expoConfig?.extra?.emailLinkUrlBase ||
  (auth.app.options.authDomain ? `https://${auth.app.options.authDomain}` : null);
const CUSTOM_LINK_DOMAIN = Constants.expoConfig?.extra?.emailLinkDomain || '';

function trimTrailingSlash(value = '') {
  return value.replace(/\/+$/, '');
}

export function normalizeEmail(email = '') {
  return email.trim().toLowerCase();
}

export function getEmailLinkLandingUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${trimTrailingSlash(window.location.origin)}${EMAIL_LINK_PATH}`;
  }

  const baseUrl = trimTrailingSlash(FALLBACK_NATIVE_LINK_BASE_URL || '');
  return `${baseUrl}${EMAIL_LINK_PATH}`;
}

export function buildEmailLinkActionCodeSettings() {
  const config = Constants.expoConfig || {};
  const iosBundleId = config.ios?.bundleIdentifier;
  const androidPackage = config.android?.package;

  return {
    url: getEmailLinkLandingUrl(),
    handleCodeInApp: true,
    ...(iosBundleId ? { iOS: { bundleId: iosBundleId } } : {}),
    ...(androidPackage
      ? {
          android: {
            packageName: androidPackage,
            installApp: true,
          },
        }
      : {}),
    ...(CUSTOM_LINK_DOMAIN ? { linkDomain: CUSTOM_LINK_DOMAIN } : {}),
  };
}

export async function storePendingEmailLinkRequest({ email, displayName = '', mode = 'login' }) {
  const pendingRequest = {
    email: normalizeEmail(email),
    displayName: displayName.trim(),
    mode,
    requestedAt: Date.now(),
  };

  await AsyncStorage.multiSet([
    [PENDING_EMAIL_LINK_KEY, JSON.stringify(pendingRequest)],
    [EMAIL_FOR_SIGN_IN_KEY, pendingRequest.email],
  ]);

  return pendingRequest;
}

export async function getPendingEmailLinkRequest() {
  const rawValue = await AsyncStorage.getItem(PENDING_EMAIL_LINK_KEY);
  if (!rawValue) return null;

  try {
    return JSON.parse(rawValue);
  } catch {
    return null;
  }
}

export async function clearPendingEmailLinkRequest() {
  await AsyncStorage.multiRemove([PENDING_EMAIL_LINK_KEY, EMAIL_FOR_SIGN_IN_KEY]);
}

export async function sendHomeHubEmailLink({ email, displayName = '', mode = 'login' }) {
  const pendingRequest = {
    email: normalizeEmail(email),
    displayName: displayName.trim(),
    mode,
    requestedAt: Date.now(),
  };

  await sendSignInLinkToEmail(
    auth,
    pendingRequest.email,
    buildEmailLinkActionCodeSettings()
  );

  await AsyncStorage.multiSet([
    [PENDING_EMAIL_LINK_KEY, JSON.stringify(pendingRequest)],
    [EMAIL_FOR_SIGN_IN_KEY, pendingRequest.email],
  ]);

  return pendingRequest;
}

export async function resendPendingHomeHubEmailLink() {
  const pendingRequest = await getPendingEmailLinkRequest();
  if (!pendingRequest?.email) {
    const error = new Error('No pending email link request was found.');
    error.code = 'auth/missing-email-link-request';
    throw error;
  }

  await sendSignInLinkToEmail(
    auth,
    pendingRequest.email,
    buildEmailLinkActionCodeSettings()
  );

  return pendingRequest;
}

export function isEmailLinkSignInUrl(url) {
  return Boolean(url) && isSignInWithEmailLink(auth, url);
}

export async function getStoredEmailForEmailLink() {
  const storedEmail = await AsyncStorage.getItem(EMAIL_FOR_SIGN_IN_KEY);
  return storedEmail ? normalizeEmail(storedEmail) : '';
}

export async function completeHomeHubEmailLinkSignIn({ emailLink, email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    const error = new Error('Please confirm your email to finish signing in.');
    error.code = 'auth/missing-email';
    throw error;
  }

  const pendingRequest = await getPendingEmailLinkRequest();
  const credential = await signInWithEmailLink(auth, normalizedEmail, emailLink);

  await clearPendingEmailLinkRequest();

  return {
    credential,
    pendingRequest,
  };
}

export async function getUserDocument(uid) {
  return getDoc(doc(db, 'users', uid));
}

export async function ensureHomeHubUserDocument({
  uid,
  email,
  displayName = '',
  photoURL = null,
  familyId = null,
}) {
  const normalizedEmail = normalizeEmail(email);
  const trimmedDisplayName = displayName.trim();
  const payload = {
    email: normalizedEmail,
    displayName: trimmedDisplayName,
    familyId,
    createdAt: serverTimestamp(),
    ...(photoURL ? { photoURL } : {}),
  };

  await setDoc(doc(db, 'users', uid), payload, { merge: false });

  if (auth.currentUser && trimmedDisplayName && auth.currentUser.displayName !== trimmedDisplayName) {
    await updateProfile(auth.currentUser, { displayName: trimmedDisplayName });
  }

  return payload;
}

export async function resolvePostAuthDestination(uid) {
  const snapshot = await getUserDocument(uid);
  const familyId = snapshot.exists() ? snapshot.data()?.familyId : null;

  if (familyId) {
    return { routeName: 'MainTabs', params: { familyId } };
  }

  return { routeName: 'FamilySetup' };
}

export async function openEmailApp() {
  const candidates = Platform.select({
    ios: ['mailto:'],
    android: ['mailto:'],
    default: ['mailto:'],
  });

  for (const url of candidates || []) {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) continue;
      await Linking.openURL(url);
      return true;
    } catch {
      continue;
    }
  }

  return false;
}