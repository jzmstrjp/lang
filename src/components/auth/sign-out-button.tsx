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
      className="inline-flex items-center justify-center rounded-md border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text)] transition hover:bg-[var(--border)]"
    >
      ログアウト
    </button>
  );
}
