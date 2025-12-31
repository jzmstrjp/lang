import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  WORD_COUNT_RULES,
  DIFFICULTY_LEVEL_RULES,
  type ProblemLength,
  type DifficultyLevel,
} from '@/config/problem';
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
  type?: ProblemLength;
  difficultyLevel?: DifficultyLevel;
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
  const { type, difficultyLevel, search, limit = PROBLEM_FETCH_LIMIT } = options;

  // limitの範囲チェック
  const sanitizedLimit = Math.min(Math.max(limit, 1), PROBLEM_FETCH_LIMIT);

  // typeとdifficultyLevelのどちらか一方は必須
  if (!type && !difficultyLevel) {
    throw new Error('Either type or difficultyLevel must be specified');
  }

  // 検索文字列の前処理
  const trimmedSearch = search?.trim();
  const hasSearch = trimmedSearch && trimmedSearch.length > 0;

  // WHERE句を構築
  const whereClauses: Prisma.Sql[] = [Prisma.sql`"audioReady" = true`];

  // typeが指定されている場合は単語数でフィルタ
  if (type) {
    const rules = WORD_COUNT_RULES[type];
    if (!rules) {
      throw new Error(
        `Invalid type: ${type}. Valid types are: ${Object.keys(WORD_COUNT_RULES).join(', ')}`,
      );
    }
    whereClauses.push(Prisma.sql`"wordCount" >= ${rules.min}`);
    whereClauses.push(Prisma.sql`"wordCount" <= ${rules.max}`);
  }

  // difficultyLevelが指定されている場合は難易度でフィルタ
  if (difficultyLevel) {
    const rules = DIFFICULTY_LEVEL_RULES[difficultyLevel];
    if (!rules) {
      throw new Error(
        `Invalid difficultyLevel: ${difficultyLevel}. Valid levels are: ${Object.keys(DIFFICULTY_LEVEL_RULES).join(', ')}`,
      );
    }
    whereClauses.push(Prisma.sql`"difficultyLevel" >= ${rules.min}`);
    whereClauses.push(Prisma.sql`"difficultyLevel" <= ${rules.max}`);
  }

  // 検索条件を追加
  if (hasSearch) {
    whereClauses.push(
      Prisma.sql`("englishSentence" ILIKE ${`%${trimmedSearch}%`} OR "japaneseSentence" ILIKE ${`%${trimmedSearch}%`})`,
    );
  }

  // WHERE句を結合
  const whereClause = Prisma.join(whereClauses, ' AND ');

  // PostgreSQLのRANDOM()を使って複数件をランダムに取得
  // $queryRawを使用してパラメータ化クエリでSQLインジェクションを防止
  const problems = await prisma.$queryRaw<ProblemWithAudio[]>`
    SELECT * FROM "problems"
    WHERE ${whereClause}
    ORDER BY RANDOM()
    LIMIT ${sanitizedLimit}
  `;

  if (!problems || problems.length === 0) {
    return { problems: [], count: 0 };
  }

  const formattedProblems: ProblemWithAudio[] = problems.map(formatProblem);

  return { problems: formattedProblems, count: formattedProblems.length };
}
