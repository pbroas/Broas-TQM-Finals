import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Suppress benign gRPC idle stream disconnection notices
setLogLevel('error');

// CRITICAL: Must use firestoreDatabaseId from configuration
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const SECURE_TOKEN_ACTIVATION_URL =
  'https://console.developers.google.com/apis/api/securetoken.googleapis.com/overview?project=648207412439';

export async function checkTokenServiceHealth(): Promise<boolean> {
  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseConfig.apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: 'healthcheck' }),
    });
    const data = await res.json();
    if (data?.error?.message?.includes('Token Service API has not been used in project')) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}
testConnection();

export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (err: any) {
    const code = err?.code || '';
    // Handle expected user cancellations (e.g. user closes popup or rapid clicks) gracefully
    if (
      code === 'auth/cancelled-popup-request' ||
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/user-cancelled'
    ) {
      console.info('Google sign-in popup closed or cancelled by user.');
      return null;
    }

    const msg = err?.message || String(err);
    if (msg.includes('token-service-api') || msg.includes('securetoken')) {
      throw new Error(
        `Token Service API is disabled for project 648207412439. Enable it at: ${SECURE_TOKEN_ACTIVATION_URL}`
      );
    }
    console.error('Google Sign-In notice:', err);
    throw err;
  }
}

export async function signOutUser() {
  try {
    await fbSignOut(auth);
  } catch (e) {
    console.warn('Sign out notice:', e);
  }
}
