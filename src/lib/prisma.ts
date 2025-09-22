import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// PrismaClientの確実なシングルトン化
function createPrismaClient() {
  console.log('🔧 Prisma初期化 - CI環境:', process.env.CI);
  console.log(
    '🔧 PRISMA_CLIENT_DISABLE_PREPARED_STATEMENTS:',
    process.env.PRISMA_CLIENT_DISABLE_PREPARED_STATEMENTS,
  );

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

// グローバルでシングルトンを維持
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// 開発環境でのみグローバルに保存（HMR対応）
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

// プロセス終了時のクリーンアップ
process.on('beforeExit', async () => {
  await prisma.$disconnect();
});
