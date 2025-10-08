#!/usr/bin/env tsx

/**
 * incorrectOptions の各文と japaneseSentence の長さを比較し集計するスクリプト
 */

import type { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { WORD_COUNT_RULES, type ProblemLength } from '../src/config/problem';

type ComparisonStats = {
  total: number;
  allLonger: number;
  allShorter: number;
};

type ProblemRecord = {
  id: string;
  japaneseSentence: string;
  incorrectOptions: Prisma.JsonValue;
};

function ensureEnv() {
  const requiredEnv = 'DATABASE_URL';
  if (!process.env[requiredEnv]) {
    console.error(`❌ 必要な環境変数 ${requiredEnv} が設定されていません。`);
    process.exit(1);
  }
}

function buildWordCountFilter(length: ProblemLength): Prisma.IntFilter {
  const rule = WORD_COUNT_RULES[length];
  const filter: Prisma.IntFilter = { gte: rule.min };

  if (length !== 'long') {
    filter.lte = rule.max;
  }

  return filter;
}

function parseIncorrectOptions(raw: Prisma.JsonValue): string[] {
  if (raw == null) {
    return [];
  }

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
    } catch {
      console.warn('⚠️ incorrectOptions の JSON パースに失敗しました:', raw);
      return [];
    }
  }

  if (Array.isArray(raw)) {
    return raw.map((item) => String(item));
  }

  return [];
}

function countCharacters(text: string): number {
  return Array.from(text ?? '').length;
}

function tallyComparisons(problem: ProblemRecord): { longer: boolean; shorter: boolean } {
  const options = parseIncorrectOptions(problem.incorrectOptions);

  if (options.length === 0) {
    return { longer: false, shorter: false };
  }

  const baseLength = countCharacters(problem.japaneseSentence);
  const optionLengths = options.map((option) => countCharacters(option));

  return {
    longer: optionLengths.every((length) => length > baseLength),
    shorter: optionLengths.every((length) => length < baseLength),
  };
}

async function collectStats(length: ProblemLength): Promise<ComparisonStats> {
  const wordCount = buildWordCountFilter(length);
  const problems = await prisma.problem.findMany({
    where: { wordCount },
    select: {
      id: true,
      japaneseSentence: true,
      incorrectOptions: true,
    },
  });

  let allLonger = 0;
  let allShorter = 0;

  for (const problem of problems) {
    const { longer, shorter } = tallyComparisons(problem);
    if (longer) {
      allLonger += 1;
    }
    if (shorter) {
      allShorter += 1;
    }
  }

  return {
    total: problems.length,
    allLonger,
    allShorter,
  };
}

async function main() {
  ensureEnv();

  console.log('🔍 incorrectOptions と japaneseSentence の長さ差を集計します...');

  const lengths: ProblemLength[] = ['short', 'medium', 'long'];
  const results = await Promise.all(lengths.map((length) => collectStats(length)));

  console.log('\n📊 集計結果');
  lengths.forEach((length, index) => {
    const stats = results[index];
    console.log(`  - ${String(length).padEnd(7)}: ${stats.total}件`);
    console.log(
      `長い選択肢ばっか！: ${stats.allLonger}件
短い選択肢ばっか！: ${stats.allShorter}件
--------------------------------`,
    );
  });
}

if (require.main === module) {
  main()
    .then(() => prisma.$disconnect())
    .catch((error) => {
      console.error('❌ 集計中にエラーが発生しました:', error);
      prisma.$disconnect().finally(() => process.exit(1));
    });
}

export { collectStats, main };
