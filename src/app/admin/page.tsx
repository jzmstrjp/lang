import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { isAdminEmail } from '@/lib/auth/admin';
import { getServerAuthSession } from '@/lib/auth/session';

export default async function AdminPage() {
  const session = await getServerAuthSession();
  const email = session?.user?.email ?? null;
  const isAdmin = email ? await isAdminEmail(email) : false;

  return (
    <div className="space-y-6">
      {!session && (
        <section className="space-y-4 text-center">
          <GoogleSignInButton />
        </section>
      )}

      {session && !isAdmin && (
        <section className="space-y-4 rounded-lg border border-red-200 bg-red-50 p-6">
          <div className="space-y-1">
            <p className="text-base font-semibold text-red-700">アクセス権がありません</p>
          </div>
          <SignOutButton />
        </section>
      )}

      {session && isAdmin && (
        <section className="">
          <div>
            <p className="text-base mb-4 font-semibold text-slate-900">
              ようこそ、{session.user?.name ?? '管理者'} さん
            </p>
          </div>
          <SignOutButton />
        </section>
      )}
    </div>
  );
}
