const FIREBASE_MESSAGES = {
  'auth/email-already-in-use': 'This email is already in use.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'That email or sign-in link is incorrect.',
  'auth/invalid-action-code': 'This sign-in link is invalid or has already been used.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/expired-action-code': 'This sign-in link has expired. Request a new one.',
  'auth/missing-email': 'Enter the email address that received the sign-in link.',
  'auth/missing-email-link-request': 'Request a new sign-in link to continue.',
  'auth/invalid-login-credentials': 'That email does not match this sign-in link.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet.',
  'auth/too-many-requests': 'Too many attempts. Please try again shortly.',
  'auth/network-request-failed': 'Network issue. Check your connection and try again.',
  'auth/requires-recent-login': 'Please log in again to continue.',
  'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Google sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'An account already exists with the same email using a different sign-in method.',
  'auth/google-client-id-missing':
    'Google sign-in is not configured yet. Add your Firebase Web Client ID to the app config.',
  'auth/google-not-ready': 'Google sign-in is still loading. Please try again.',
  'auth/google-sign-in-failed': 'Google sign-in failed. Please try again.',
  'auth/unauthorized-continue-uri': 'This sign-in link is not configured correctly.',
  'auth/invalid-continue-uri': 'This sign-in link is not configured correctly.',
  'permission-denied': 'You do not have permission to do this.',
  'unavailable': 'Service is temporarily unavailable. Please try again.',
  'deadline-exceeded': 'Request timed out. Please try again.',
};

export function getFirebaseErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  const code = typeof error.code === 'string' ? error.code : '';
  if (code && FIREBASE_MESSAGES[code]) {
    return FIREBASE_MESSAGES[code];
  }

  // Firebase web SDK often prefixes Firestore codes with "firestore/".
  const normalizedCode = code.replace(/^firestore\//, '');
  if (normalizedCode && FIREBASE_MESSAGES[normalizedCode]) {
    return FIREBASE_MESSAGES[normalizedCode];
  }

  return fallback;
}
