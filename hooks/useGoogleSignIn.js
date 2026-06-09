import { useCallback, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { getFirebaseErrorMessage } from '../utils/firebaseError';
import {
  completeGoogleCredentialSignIn,
  extractGoogleIdToken,
  getGoogleOAuthClientIds,
  getGoogleRedirectUriOptions,
  isGoogleSignInCancelled,
  signInWithGoogleWeb,
} from '../utils/googleSignIn';

const PLACEHOLDER_CLIENT_ID = 'missing-client-id.apps.googleusercontent.com';

function useGoogleAuthRequestConfig() {
  return useMemo(() => {
    try {
      return {
        hasNativeClientId: true,
        clientIds: getGoogleOAuthClientIds(),
      };
    } catch {
      return {
        hasNativeClientId: false,
        clientIds: {
          webClientId: PLACEHOLDER_CLIENT_ID,
          iosClientId: PLACEHOLDER_CLIENT_ID,
          androidClientId: PLACEHOLDER_CLIENT_ID,
        },
      };
    }
  }, []);
}

export function useGoogleSignIn() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState('');
  const { hasNativeClientId, clientIds } = useGoogleAuthRequestConfig();
  const [request, , promptAsync] = Google.useIdTokenAuthRequest(
    {
      ...clientIds,
      selectAccount: true,
    },
    getGoogleRedirectUriOptions()
  );

  const signInWithGoogle = useCallback(async () => {
    try {
      setGoogleLoading(true);
      setGoogleError('');

      if (Platform.OS !== 'web' && !hasNativeClientId) {
        const error = new Error('Google sign-in is not configured yet.');
        error.code = 'auth/google-client-id-missing';
        throw error;
      }

      if (Platform.OS === 'web') {
        await signInWithGoogleWeb();
        return;
      }

      if (!request) {
        const error = new Error('Google sign-in is still initializing. Please try again.');
        error.code = 'auth/google-not-ready';
        throw error;
      }

      const authResult = await promptAsync();
      if (isGoogleSignInCancelled(authResult)) {
        return;
      }

      if (authResult.type !== 'success') {
        const error = new Error('Google sign-in failed. Please try again.');
        error.code = 'auth/google-sign-in-failed';
        throw error;
      }

      const idToken = extractGoogleIdToken(authResult);
      await completeGoogleCredentialSignIn(idToken);
    } catch (error) {
      if (error?.code === 'auth/popup-closed-by-user') {
        return;
      }

      setGoogleError(
        getFirebaseErrorMessage(error, 'Unable to sign in with Google. Please try again.')
      );
    } finally {
      setGoogleLoading(false);
    }
  }, [hasNativeClientId, promptAsync, request]);

  return {
    signInWithGoogle,
    googleLoading,
    googleError,
    setGoogleError,
    isGoogleConfigured: Platform.OS === 'web' || (hasNativeClientId && Boolean(request)),
  };
}
