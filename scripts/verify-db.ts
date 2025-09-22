#!/usr/bin/env tsx

/**
 * データベースの最新問題を確認するための専用スクリプト
 */

import { PrismaClient } from '@prisma/client';

async function main() {
  const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
    log: ['error'],
  });

  try {
    console.log('🔍 データベースの確認中...');

    const latest = await prisma.problem.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        english: true,
        japaneseReply: true,
        type: true,
        createdAt: true,
        wordCount: true,
        genre: true,
        nuance: true,
      },
    });

    if (latest) {
      console.log('');
      console.log('💾 ===============================================');
      console.log('✅ 最新の問題がDBに保存されています');
      console.log('💾 ===============================================');
      console.log('🆔 ID:', latest.id);
      console.log('📊 Type:', latest.type);
      console.log('📚 English:', latest.english);
      console.log('🗾 Japanese:', latest.japaneseReply);
      console.log('📝 Word Count:', latest.wordCount);
      console.log('🎭 Genre:', latest.genre);
      console.log('💬 Nuance:', latest.nuance);
      console.log('⏰ Created:', latest.createdAt);
      console.log('');
    } else {
      console.log('❌ DBに問題が見つかりません。');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ DB確認エラー:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
