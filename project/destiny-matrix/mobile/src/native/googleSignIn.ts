import { GoogleOneTapSignIn, isErrorWithCode, statusCodes } from 'react-native-nitro-google-signin';
import { record } from './http';

export interface GoogleChallenge { challenge: string; nonce: string; client_id: string }
export const isGoogleChallenge = (value: unknown): value is GoogleChallenge => record(value) &&
  typeof value.challenge === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.challenge) &&
  typeof value.nonce === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value.nonce) &&
  typeof value.client_id === 'string' && value.client_id.length <= 255 && /^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(value.client_id);

export class NativeGoogleError extends Error {
  constructor(public reason: 'unavailable' | 'failed') { super('Google sign-in could not be completed'); }
}

/** Clear only this app's SDK session, never the Google account on the device. */
export async function clearGoogleSession(): Promise<void> {
  try { await GoogleOneTapSignIn.signOut(); } catch { /* Arcana owns its separate session. */ }
}

/** Called exclusively after the user presses the branded Google button. */
export async function requestGoogleCredential(challenge: GoogleChallenge): Promise<string | null> {
  try {
    GoogleOneTapSignIn.configure({ webClientId: challenge.client_id, nonce: challenge.nonce,
      offlineAccess: false, autoSelectOnSignIn: false });
    await GoogleOneTapSignIn.checkPlayServices();
    const result = await GoogleOneTapSignIn.presentExplicitSignIn();
    if (result.type === 'cancelled') return null;
    if (result.type !== 'success' || !result.data || typeof result.data.idToken !== 'string' ||
      result.data.idToken.length < 20 || result.data.idToken.length > 8192) throw new NativeGoogleError('failed');
    return result.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && error.code === statusCodes.SIGN_IN_CANCELLED) return null;
    throw new NativeGoogleError(isErrorWithCode(error) && error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE ? 'unavailable' : 'failed');
  } finally { await clearGoogleSession(); }
}
