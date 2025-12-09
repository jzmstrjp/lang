#!/usr/bin/env tsx

/**
 * 問題データを長さ別に集計し、imageUrl の有無を確認するスクリプト
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { WORD_COUNT_RULES, type ProblemLength } from '../src/config/problem';

type CoverageStats = {
  total: number;
  withImage: number;
  withoutImage: number;
};

function buildWordCountFilter(length: ProblemLength): Prisma.IntFilter {
  const rule = WORD_COUNT_RULES[length];
  const filter: Prisma.IntFilter = { gte: rule.min };

  if (length !== 'long') {
    filter.lte = rule.max;
  }

  return filter;
}

async function collectStats(length: ProblemLength): Promise<CoverageStats> {
  const wordCount = buildWordCountFilter(length);

  const total = await prisma.problem.count({
    where: { wordCount },
  });

  if (total === 0) {
    return { total: 0, withImage: 0, withoutImage: 0 };
  }

  const withImage = await prisma.problem.count({
    where: {
      wordCount,
      imageUrl: { not: null },
    },
  });

  return {
    total,
    withImage,
    withoutImage: total - withImage,
  };
}

async function main() {
  try {
    console.log('🔍 imageUrl の有無を長さ別に確認します...');

    const lengths: ProblemLength[] = ['short', 'medium', 'long'];
    const results = await Promise.all(lengths.map((length) => collectStats(length)));

    console.log('\n📊 集計結果');
    lengths.forEach((length, index) => {
      const stats = results[index];
      console.log(
        `  - ${String(length).padEnd(7)}: ${stats.total}件 （画像あり: ${stats.withImage}件、画像なし: ${stats.withoutImage}件）`,
      );
    });

    const totals = results.reduce(
      (acc, cur) => {
        acc.total += cur.total;
        acc.withImage += cur.withImage;
        acc.withoutImage += cur.withoutImage;
        return acc;
      },
      { total: 0, withImage: 0, withoutImage: 0 },
    );

    console.log('--------------------------------');
    console.log(
      `  - 全体　: ${totals.total}件 （画像あり: ${totals.withImage}件、画像なし: ${totals.withoutImage}件）`,
    );
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
