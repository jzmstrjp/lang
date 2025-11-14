import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
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

function formatProblem(problem: ProblemWithAudio): ProblemWithAudio {
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
    audioEnUrl: problem.audioEnUrl,
    audioJaUrl: problem.audioJaUrl,
    audioEnReplyUrl: problem.audioEnReplyUrl,
    imageUrl: problem.imageUrl,
  };
}

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

  // 検索文字列の前処理
  const trimmedSearch = search?.trim();
  const hasSearch = trimmedSearch && trimmedSearch.length > 0;

  // PostgreSQLのRANDOM()を使って複数件をランダムに取得
  // $queryRawを使用してパラメータ化クエリでSQLインジェクションを防止
  const problems = await prisma.$queryRaw<ProblemWithAudio[]>`
    SELECT * FROM "problems"
    WHERE "audioReady" = true
      AND "wordCount" >= ${rules.min}
      AND "wordCount" <= ${rules.max}
      ${hasSearch ? Prisma.sql`AND ("englishSentence" ILIKE ${`%${trimmedSearch}%`} OR "japaneseSentence" ILIKE ${`%${trimmedSearch}%`})` : Prisma.empty}
    ORDER BY RANDOM()
    LIMIT ${sanitizedLimit}
  `;

  if (!problems || problems.length === 0) {
    return { problems: [], count: 0 };
  }

  const formattedProblems: ProblemWithAudio[] = problems.map(formatProblem);

  return { problems: formattedProblems, count: formattedProblems.length };
}
