#!/usr/bin/env tsx

/**
 * 問題データを難易度レベル別に集計するスクリプト
 */

import { prisma } from '../src/lib/prisma';

type DifficultyStats = {
  level: number | null;
  count: number;
};

async function collectStats(): Promise<DifficultyStats[]> {
  // 難易度レベル1〜10のそれぞれの件数を取得
  const statsPromises = Array.from({ length: 10 }, (_, i) => {
    const level = i + 1;
    return prisma.problem
      .count({
        where: { difficultyLevel: level },
      })
      .then((count) => ({ level, count }));
  });

  // difficultyLevel が null の件数も取得
  const nullCountPromise = prisma.problem
    .count({
      where: { difficultyLevel: null },
    })
    .then((count) => ({ level: null, count }));

  const results = await Promise.all([...statsPromises, nullCountPromise]);

  return results;
}

async function main() {
  try {
    console.log('🔍 難易度レベル別の問題数を確認します...\n');

    const stats = await collectStats();

    console.log('📊 集計結果\n');

    // レベル1〜10を表示
    const levelStats = stats.filter((s) => s.level !== null).sort((a, b) => a.level! - b.level!);
    levelStats.forEach((stat) => {
      const levelStr = `レベル ${stat.level}`;
      const bar = '█'.repeat(Math.ceil(stat.count / 10));
      console.log(`  ${levelStr.padEnd(12)}: ${String(stat.count).padStart(4)}件 ${bar}`);
    });

    // 未設定を表示
    const nullStat = stats.find((s) => s.level === null);
    if (nullStat && nullStat.count > 0) {
      console.log('  --------------------------------');
      const bar = '░'.repeat(Math.ceil(nullStat.count / 10));
      console.log(`  未設定       : ${String(nullStat.count).padStart(4)}件 ${bar}`);
    }

    // 合計を計算
    const total = stats.reduce((sum, stat) => sum + stat.count, 0);
    const withLevel = stats
      .filter((s) => s.level !== null)
      .reduce((sum, stat) => sum + stat.count, 0);

    console.log('  ================================');
    console.log(`  合計         : ${String(total).padStart(4)}件`);
    console.log(`  （設定済み: ${withLevel}件、未設定: ${nullStat?.count ?? 0}件）\n`);

    // 統計情報を表示
    if (withLevel > 0) {
      const levels = levelStats.filter((s) => s.count > 0).map((s) => s.level!);

      if (levels.length > 0) {
        const minLevel = Math.min(...levels);
        const maxLevel = Math.max(...levels);
        const weightedSum = levelStats.reduce((sum, s) => sum + s.level! * s.count, 0);
        const avgLevel = (weightedSum / withLevel).toFixed(1);

        console.log('📈 統計情報');
        console.log(`  最小レベル   : ${minLevel}`);
        console.log(`  最大レベル   : ${maxLevel}`);
        console.log(`  平均レベル   : ${avgLevel}`);
      }
    }
  } catch (error) {
    console.error('❌ 集計処理でエラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

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
