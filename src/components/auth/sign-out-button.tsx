'use client';

import { signOut } from 'next-auth/react';

export function SignOutButton() {
  const handleClick = () => {
    void signOut({ callbackUrl: '/' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      ログアウト
    </button>
  );
}
