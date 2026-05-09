const FIREBASE_MESSAGES = {
  'auth/email-already-in-use': 'This email is already in use.',
  'auth/invalid-email': 'Enter a valid email address.',
  'auth/invalid-credential': 'Email or password is incorrect.',
  'auth/user-not-found': 'No account found for this email.',
  'auth/wrong-password': 'Email or password is incorrect.',
  'auth/weak-password': 'Use at least 6 characters for the password.',
  'auth/too-many-requests': 'Too many attempts. Please try again shortly.',
  'auth/network-request-failed': 'Network issue. Check your connection and try again.',
  'auth/requires-recent-login': 'Please log in again to continue.',
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
