import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAdminRequest,
  getAdminFirestore,
  setAdminCustomClaim,
  adminAuth,
} from '@/lib/firebase-admin';
import { DESIGNATED_SUPER_ADMIN_EMAIL } from '@/lib/security';

export interface AdminUserRecord {
  id: string;
  uid?: string;
  email: string;
  displayName?: string;
  role: 'super_admin';
  status: 'active' | 'revoked';
  grantedBy: string;
  grantedAt: string;
  revokedBy?: string;
  revokedAt?: string;
  isDesignatedRoot?: boolean;
}

export interface AdminAuditLog {
  id: string;
  action: 'grant' | 'revoke';
  targetEmail: string;
  targetUid?: string | null;
  performedBy: string;
  timestamp: string;
  notes?: string;
}

/**
 * GET /api/admin/admins
 * Lists all authorized Super Administrators and role change audit logs.
 * Protected: Requires valid Firebase ID token from an active Super Admin.
 */
export async function GET(req: NextRequest) {
  try {
    const verified = await verifyAdminRequest(req);
    if (!verified || !verified.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Administrative privileges required.' },
        { status: 403 }
      );
    }

    const adminDb = getAdminFirestore();
    const adminsMap = new Map<string, AdminUserRecord>();

    // 1. Always include designated root administrator
    const rootEmail = DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase();
    adminsMap.set(rootEmail, {
      id: 'root-super-admin',
      email: rootEmail,
      displayName: 'Primary Super Administrator',
      role: 'super_admin',
      status: 'active',
      grantedBy: 'System Bootstrap',
      grantedAt: '2026-10-31T00:00:00.000Z',
      isDesignatedRoot: true,
    });

    const logs: AdminAuditLog[] = [];

    if (adminDb) {
      // 2. Query /admins collection
      try {
        const adminsSnap = await adminDb.collection('admins').get();
        adminsSnap.forEach((doc: any) => {
          const data = doc.data() as Partial<AdminUserRecord>;
          if (data.email) {
            const em = data.email.toLowerCase();
            adminsMap.set(em, {
              id: doc.id,
              uid: data.uid || doc.id,
              email: em,
              displayName: data.displayName || em.split('@')[0],
              role: 'super_admin',
              status: data.status === 'revoked' ? 'revoked' : 'active',
              grantedBy: data.grantedBy || 'Super Admin',
              grantedAt: data.grantedAt || new Date().toISOString(),
              revokedBy: data.revokedBy,
              revokedAt: data.revokedAt,
              isDesignatedRoot: em === rootEmail,
            });
          }
        });
      } catch (e) {
        console.warn('Failed reading admins collection in Firestore:', e);
      }

      // 3. Query /admin_audit_logs collection
      try {
        const logsSnap = await adminDb
          .collection('admin_audit_logs')
          .orderBy('timestamp', 'desc')
          .limit(50)
          .get();
        logsSnap.forEach((doc: any) => {
          logs.push({ id: doc.id, ...(doc.data() as any) });
        });
      } catch (e) {
        console.warn('Failed reading admin_audit_logs collection:', e);
      }
    }

    return NextResponse.json({
      admins: Array.from(adminsMap.values()),
      logs,
    });
  } catch (err: any) {
    console.error('Admin list error:', err);
    return NextResponse.json(
      { error: 'Failed to retrieve administrator directory', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/admins
 * Grants Super Admin privileges to an account by email or UID.
 * Protected: Requires valid Firebase ID token from an active Super Admin.
 */
export async function POST(req: NextRequest) {
  try {
    const verified = await verifyAdminRequest(req);
    if (!verified || !verified.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only active Super Administrators can grant privileges.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { email, displayName, notes } = body;

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid Google Account email is required.' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const adminDb = getAdminFirestore();
    let targetUid: string | null = null;
    let targetDisplayName = displayName || normalizedEmail.split('@')[0];

    // 1. Try to find user in Firebase Auth
    if (adminAuth) {
      try {
        const authUser = await adminAuth.getUserByEmail(normalizedEmail);
        targetUid = authUser.uid;
        if (authUser.displayName) targetDisplayName = authUser.displayName;

        // Set Firebase custom claims (super_admin: true)
        if (targetUid) {
          await setAdminCustomClaim(targetUid, true);
        }
      } catch (authErr: any) {
        // User may not have signed in yet; still register admin permit
        console.info(`User ${normalizedEmail} not yet in Firebase Auth; registered for future sign-in.`);
      }
    }

    const docId = targetUid || `admin_${Buffer.from(normalizedEmail).toString('hex').substring(0, 32)}`;
    const now = new Date().toISOString();

    const adminRecord: AdminUserRecord = {
      id: docId,
      uid: targetUid || undefined,
      email: normalizedEmail,
      displayName: targetDisplayName,
      role: 'super_admin',
      status: 'active',
      grantedBy: verified.email,
      grantedAt: now,
      isDesignatedRoot: normalizedEmail === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase(),
    };

    if (adminDb) {
      try {
        // 2. Persist in /admins collection
        await adminDb.collection('admins').doc(docId).set(adminRecord, { merge: true });

        // 3. Record in /admin_audit_logs collection
        const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const logEntry: AdminAuditLog = {
          id: logId,
          action: 'grant',
          targetEmail: normalizedEmail,
          targetUid,
          performedBy: verified.email,
          timestamp: now,
          notes: notes || 'Super Administrator role granted.',
        };
        await adminDb.collection('admin_audit_logs').doc(logId).set(logEntry);
      } catch (dbErr: any) {
        console.warn('AdminDb server write notice (client SDK manages direct persistence):', dbErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Super Admin access granted to ${normalizedEmail}`,
      admin: adminRecord,
    });
  } catch (err: any) {
    console.error('Grant admin error:', err);
    return NextResponse.json(
      { error: 'Failed to grant administrative privileges', details: err.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/admins
 * Revokes Super Admin privileges.
 * Protected: Requires valid Firebase ID token from an active Super Admin.
 * Safety: Prevents removal of the designated root admin and the last active administrator.
 */
export async function DELETE(req: NextRequest) {
  try {
    const verified = await verifyAdminRequest(req);
    if (!verified || !verified.isSuperAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized: Only active Super Administrators can revoke privileges.' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(req.url);
    const targetEmail = searchParams.get('email')?.trim().toLowerCase();

    if (!targetEmail) {
      return NextResponse.json({ error: 'Target admin email is required.' }, { status: 400 });
    }

    // Safety Rule 1: Cannot revoke the primary designated root administrator
    if (targetEmail === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase()) {
      return NextResponse.json(
        { error: 'Cannot revoke the primary designated Super Administrator (paulineingrid123@gmail.com).' },
        { status: 400 }
      );
    }

    const adminDb = getAdminFirestore();

    // Safety Rule 2: Cannot remove the last active Super Administrator
    if (adminDb) {
      const activeAdminsSnap = await adminDb
        .collection('admins')
        .where('status', '==', 'active')
        .get();

      let activeCount = 1; // Count root admin as 1
      activeAdminsSnap.forEach((doc: any) => {
        const d = doc.data();
        if (d.email && d.email.toLowerCase() !== DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase()) {
          activeCount++;
        }
      });

      if (activeCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot remove the last active Super Administrator. At least one administrator must remain.' },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    let targetUid: string | null = null;

    // 1. Revoke custom claims in Firebase Auth if UID exists
    if (adminAuth) {
      try {
        const authUser = await adminAuth.getUserByEmail(targetEmail);
        targetUid = authUser.uid;
        if (targetUid) {
          await setAdminCustomClaim(targetUid, false);
        }
      } catch (authErr) {
        console.warn(`User ${targetEmail} not found in Auth during revoke:`, authErr);
      }
    }

    if (adminDb) {
      try {
        // 2. Mark /admins document as revoked
        const querySnap = await adminDb
          .collection('admins')
          .where('email', '==', targetEmail)
          .get();

        const batch = adminDb.batch();
        querySnap.forEach((doc: any) => {
          batch.update(doc.ref, {
            status: 'revoked',
            revokedBy: verified.email,
            revokedAt: now,
          });
        });
        await batch.commit();

        // 3. Record in /admin_audit_logs
        const logId = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const logEntry: AdminAuditLog = {
          id: logId,
          action: 'revoke',
          targetEmail,
          targetUid,
          performedBy: verified.email,
          timestamp: now,
          notes: `Super Administrator privileges revoked by ${verified.email}`,
        };
        await adminDb.collection('admin_audit_logs').doc(logId).set(logEntry);
      } catch (dbErr: any) {
        console.warn('AdminDb server revoke notice (client SDK manages direct persistence):', dbErr?.message);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Super Admin privileges revoked for ${targetEmail}.`,
    });
  } catch (err: any) {
    console.error('Revoke admin error:', err);
    return NextResponse.json(
      { error: 'Failed to revoke administrative privileges', details: err.message },
      { status: 500 }
    );
  }
}
