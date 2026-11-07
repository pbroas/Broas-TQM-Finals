import { initializeApp, getApps, getApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { DESIGNATED_SUPER_ADMIN_EMAIL } from './security';

// Initialize Firebase Admin SDK safely (singleton pattern)
if (!getApps().length) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (e) {
    console.warn('Firebase Admin SDK initialization note:', e);
  }
}

export const adminApp = getApps().length ? getApp() : null;
export const adminAuth = getApps().length ? getAuth(getApp()) : null;

// Helper to access admin firestore with configured databaseId
export function getAdminFirestore() {
  if (!getApps().length) return null;
  const app = getApp();
  const dbId = (firebaseConfig as any).firestoreDatabaseId;
  if (dbId && dbId !== '(default)') {
    try {
      return getFirestore(app, dbId);
    } catch {
      return getFirestore(app);
    }
  }
  return getFirestore(app);
}

export interface VerifiedAdminResult {
  uid: string;
  email: string;
  isSuperAdmin: boolean;
  claims?: Record<string, any>;
}

/**
 * Verifies an incoming Next.js API Request against Firebase ID Tokens and Admin permissions.
 * Checks:
 * 1. Bearer Token validity
 * 2. Primary root designated super admin email (paulineingrid123@gmail.com)
 * 3. Firebase custom claims (super_admin: true)
 * 4. Active document in /admins collection
 */
export async function verifyAdminRequest(req: Request): Promise<VerifiedAdminResult | null> {
  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const idToken = authHeader.replace('Bearer ', '').trim();
  if (!idToken) return null;

  let decodedToken: DecodedIdToken | null = null;
  let userEmail = '';
  let userId = '';
  let customClaims: Record<string, any> = {};

  // 1. Try Firebase Admin verifyIdToken
  try {
    if (adminAuth) {
      decodedToken = await adminAuth.verifyIdToken(idToken);
      userEmail = decodedToken.email || '';
      userId = decodedToken.uid;
      customClaims = decodedToken;
    }
  } catch (err: any) {
    console.warn('adminAuth.verifyIdToken fallback trigger:', err?.message || err);
  }

  // 2. Fallback to Google Identity Toolkit token lookup if Admin verify encounters cert/service account issue in sandbox
  if (!decodedToken) {
    try {
      const res = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${firebaseConfig.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        }
      );
      const data = await res.json();
      if (data && data.users && data.users[0]) {
        const u = data.users[0];
        userId = u.localId;
        userEmail = u.email;
        if (u.customAttributes) {
          try {
            customClaims = JSON.parse(u.customAttributes);
          } catch {}
        }
      } else {
        return null;
      }
    } catch (err) {
      console.error('Token verification error:', err);
      return null;
    }
  }

  if (!userId || !userEmail) {
    return null;
  }

  const normalizedEmail = userEmail.trim().toLowerCase();

  // Condition A: Designated Root Super Admin
  if (normalizedEmail === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase()) {
    return {
      uid: userId,
      email: normalizedEmail,
      isSuperAdmin: true,
      claims: customClaims,
    };
  }

  // Condition B: Firebase Custom Claim
  if (customClaims.super_admin === true || customClaims.role === 'super_admin') {
    return {
      uid: userId,
      email: normalizedEmail,
      isSuperAdmin: true,
      claims: customClaims,
    };
  }

  // Condition C: Active Record in /admins collection
  const adminDb = getAdminFirestore();
  if (adminDb) {
    try {
      // Check by UID
      const uidDoc = await adminDb.collection('admins').doc(userId).get();
      if (uidDoc.exists) {
        const data = uidDoc.data();
        if (data && data.status !== 'revoked' && (data.role === 'super_admin' || data.role === 'admin')) {
          return {
            uid: userId,
            email: normalizedEmail,
            isSuperAdmin: true,
            claims: customClaims,
          };
        }
      }

      // Check by email query
      const emailQuery = await adminDb
        .collection('admins')
        .where('email', '==', normalizedEmail)
        .where('status', '!=', 'revoked')
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        return {
          uid: userId,
          email: normalizedEmail,
          isSuperAdmin: true,
          claims: customClaims,
        };
      }
    } catch (dbErr) {
      console.warn('Admin check in Firestore error:', dbErr);
    }
  }

  return {
    uid: userId,
    email: normalizedEmail,
    isSuperAdmin: false,
    claims: customClaims,
  };
}

/**
 * Assigns or revokes Super Admin custom claim while preserving any other existing custom claims.
 */
export async function setAdminCustomClaim(uid: string, isSuperAdmin: boolean): Promise<boolean> {
  if (!adminAuth) return false;
  try {
    const user = await adminAuth.getUser(uid);
    const currentClaims = user.customClaims || {};
    await adminAuth.setCustomUserClaims(uid, {
      ...currentClaims,
      super_admin: isSuperAdmin,
      role: isSuperAdmin ? 'super_admin' : 'employee',
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch (err) {
    console.warn(`Failed to set custom claims for user ${uid}:`, err);
    return false;
  }
}
