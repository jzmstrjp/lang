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
      className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
    >
      Googleログイン
    </button>
  );
}
