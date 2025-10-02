import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { replaceUrlHost } from '@/lib/cdn-utils';
import { PROBLEM_FETCH_LIMIT } from '@/const';

export type ProblemWithAudio = Omit<
  Problem,
  'incorrectOptions' | 'audioEnUrl' | 'audioJaUrl' | 'audioEnReplyUrl'
> & {
  incorrectOptions: string[];
  audioEnUrl: string;
  audioJaUrl: string;
  audioEnReplyUrl: string;
};

export type FetchProblemsOptions = {
  type: ProblemLength;
  search?: string;
  limit?: number;
};

export type FetchProblemsResult = {
  problems: ProblemWithAudio[];
  count: number;
};

/**
 * 問題をデータベースから取得する共通関数
 * サーバーコンポーネント・APIルートの両方から使用可能
 */
export async function fetchProblems(options: FetchProblemsOptions): Promise<FetchProblemsResult> {
  const { type, search, limit = PROBLEM_FETCH_LIMIT } = options;

  // limitの範囲チェック
  const sanitizedLimit = Math.min(Math.max(limit, 1), PROBLEM_FETCH_LIMIT);

  // WORD_COUNT_RULESに基づいて単語数の範囲を決定
  const rules = WORD_COUNT_RULES[type];
  if (!rules) {
    throw new Error(
      `Invalid type: ${type}. Valid types are: ${Object.keys(WORD_COUNT_RULES).join(', ')}`,
    );
  }

  // WHERE条件を構築
  const conditions: string[] = [
    '"audioReady" = true',
    `"wordCount" >= ${rules.min}`,
    `"wordCount" <= ${rules.max}`,
  ];

  if (search) {
    const trimmedSearch = search.trim();
    if (trimmedSearch) {
      const escapedSearch = trimmedSearch.replace(/'/g, "''");
      conditions.push(
        `("englishSentence" ILIKE '%${escapedSearch}%' OR "japaneseSentence" ILIKE '%${escapedSearch}%')`,
      );
    }
  }

  const whereClause = conditions.join(' AND ');

  // PostgreSQLのRANDOM()を使って複数件をランダムに取得
  const problems = await prisma.$queryRawUnsafe<Problem[]>(
    `SELECT * FROM "problems" WHERE ${whereClause} ORDER BY RANDOM() LIMIT ${sanitizedLimit}`,
  );

  if (!problems || problems.length === 0) {
    return { problems: [], count: 0 };
  }

  // データを整形
  const formattedProblems: ProblemWithAudio[] = problems.map((problem) => {
    // incorrectOptionsをJSON文字列から配列に変換
    let incorrectOptions: string[] = [];
    try {
      if (typeof problem.incorrectOptions === 'string') {
        incorrectOptions = JSON.parse(problem.incorrectOptions);
      } else if (Array.isArray(problem.incorrectOptions)) {
        incorrectOptions = problem.incorrectOptions.map(String);
      }
    } catch {
      console.warn('Failed to parse incorrectOptions:', problem.incorrectOptions);
      incorrectOptions = [];
    }

    return {
      ...problem,
      incorrectOptions,
      audioEnUrl: replaceUrlHost(problem.audioEnUrl),
      audioJaUrl: replaceUrlHost(problem.audioJaUrl),
      audioEnReplyUrl: replaceUrlHost(problem.audioEnReplyUrl),
      imageUrl: problem.imageUrl ? replaceUrlHost(problem.imageUrl) : problem.imageUrl,
    };
  });

  return { problems: formattedProblems, count: formattedProblems.length };
}
