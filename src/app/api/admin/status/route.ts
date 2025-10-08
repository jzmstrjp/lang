import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth/session';
import { isAdminEmail } from '@/lib/auth/admin';

export async function GET() {
  try {
    const session = await getServerAuthSession();
    const email = session?.user?.email ?? null;

    if (!email) {
      return NextResponse.json({ isAdmin: false });
    }

    const isAdmin = await isAdminEmail(email);
    return NextResponse.json({ isAdmin });
  } catch (error) {
    console.error('[admin-status] エラーが発生しました', error);
    return NextResponse.json({ isAdmin: false }, { status: 500 });
  }
}
