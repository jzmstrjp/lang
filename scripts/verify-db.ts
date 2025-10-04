#!/usr/bin/env tsx

/**
 * データベースの最新問題を確認するための専用スクリプト
 */

import { PrismaClient } from '@prisma/client';

// Prismaクライアントをシングルトンとして管理
let prisma: PrismaClient | null = null;

function getPrismaClient() {
  if (!prisma) {
    prisma = new PrismaClient({
      log: ['error'],
    });
  }
  return prisma;
}

async function main() {
  const prismaClient = getPrismaClient();

  try {
    console.log('🔍 データベースの確認中...');

    const latest = await prismaClient.problem.findFirst({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        englishSentence: true,
        japaneseSentence: true,
        japaneseReply: true,
        wordCount: true,
        createdAt: true,
        place: true,
        senderRole: true,
        receiverRole: true,
      },
    });

    if (latest) {
      console.log('');
      console.log('💾 ===============================================');
      console.log('✅ 最新の問題がDBに保存されています');
      console.log('💾 ===============================================');
      console.log('🆔 ID:', latest.id);
      console.log('📊 Word Count:', latest.wordCount);
      console.log('📚 English:', latest.englishSentence);
      console.log('🗾 Japanese Sentence:', latest.japaneseSentence);
      console.log('💬 Japanese Reply:', latest.japaneseReply);
      console.log('📍 Place:', latest.place);
      console.log('👤 Sender Role:', latest.senderRole);
      console.log('👥 Receiver Role:', latest.receiverRole);
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
    await prismaClient.$disconnect();
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { main };
