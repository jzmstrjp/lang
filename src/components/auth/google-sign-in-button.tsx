'use client';

import { signIn } from 'next-auth/react';

export function GoogleSignInButton() {
  const handleClick = () => {
    void signIn('google', { callbackUrl: '/admin' });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="inline-flex items-center justify-center rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-[var(--primary-text)] transition hover:bg-[var(--primary-hover)]"
    >
      Googleログイン
    </button>
  );
}
