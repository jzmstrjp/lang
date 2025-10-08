import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

function requiredEnvVar(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`環境変数 ${name} が設定されていません。`);
  }

  return value;
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: requiredEnvVar('GOOGLE_CLIENT_ID'),
      clientSecret: requiredEnvVar('GOOGLE_CLIENT_SECRET'),
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  secret: requiredEnvVar('NEXTAUTH_SECRET'),
};
