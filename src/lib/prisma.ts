import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// GitHub Actions環境でのprepared statement問題を回避
// 環境変数PRISMA_CLIENT_DISABLE_PREPARED_STATEMENTSでPrismaが自動的に処理
console.log('🔧 Prisma初期化 - CI環境:', process.env.CI);
console.log(
  '🔧 PRISMA_CLIENT_DISABLE_PREPARED_STATEMENTS:',
  process.env.PRISMA_CLIENT_DISABLE_PREPARED_STATEMENTS,
);

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
