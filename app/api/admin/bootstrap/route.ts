import { NextRequest, NextResponse } from 'next/server';
import { DESIGNATED_SUPER_ADMIN_EMAIL } from '@/lib/security';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const isSuperAdmin = email.trim().toLowerCase() === DESIGNATED_SUPER_ADMIN_EMAIL.toLowerCase();

    return NextResponse.json({
      isSuperAdmin,
      designatedEmail: DESIGNATED_SUPER_ADMIN_EMAIL,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
