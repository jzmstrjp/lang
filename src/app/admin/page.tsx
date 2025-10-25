import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { isAdminEmail } from '@/lib/auth/admin';
import { getServerAuthSession } from '@/lib/auth/session';
import { use } from 'react';

export default function AdminPage() {
  const session = use(getServerAuthSession());
  const email = session?.user?.email ?? null;
  const isAdmin = use(
    (async () => {
      if (!email) return false;
      return isAdminEmail(email);
    })(),
  );

  return (
    <div className="text-center">
      {!session && (
        <section className="space-y-4 text-center">
          <GoogleSignInButton />
        </section>
      )}

      {session && !isAdmin && (
        <section className="space-y-4 rounded-lg border border-[var(--error)] bg-[var(--error)]/10 p-6">
          <div className="space-y-1">
            <p className="text-base font-semibold text-[var(--admin-delete)]">
              アクセス権がありません
            </p>
          </div>
          <SignOutButton />
        </section>
      )}

      {session && isAdmin && (
        <section className="">
          <div>
            <p className="text-base mb-4 font-semibold text-[var(--text)]">
              ようこそ、{session.user?.name ?? '管理者'} さん
            </p>
          </div>
          <SignOutButton />
        </section>
      )}
    </div>
  );
}
