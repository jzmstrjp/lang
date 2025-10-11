import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { replaceUrlHost } from '@/lib/cdn-utils';
import { PROBLEM_FETCH_LIMIT } from '@/const';

const PROBLEM_CACHE_LIMIT = 100;
const PROBLEM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;

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

type ProblemCacheEntry = {
  problems: ProblemWithAudio[];
  expiresAt: number;
};

const globalForProblemCache = globalThis as unknown as {
  problemCache?: Map<ProblemLength, ProblemCacheEntry>;
  problemCacheLoading?: Map<ProblemLength, Promise<ProblemWithAudio[]>>;
};

const problemCache =
  globalForProblemCache.problemCache ?? new Map<ProblemLength, ProblemCacheEntry>();
if (!globalForProblemCache.problemCache) {
  globalForProblemCache.problemCache = problemCache;
}

const problemCacheLoading =
  globalForProblemCache.problemCacheLoading ??
  new Map<ProblemLength, Promise<ProblemWithAudio[]>>();
if (!globalForProblemCache.problemCacheLoading) {
  globalForProblemCache.problemCacheLoading = problemCacheLoading;
}

function formatProblem(problem: Problem): ProblemWithAudio {
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
}

function isCacheValid(entry: ProblemCacheEntry | undefined): entry is ProblemCacheEntry {
  return Boolean(entry && entry.expiresAt > Date.now());
}

async function loadProblemsFromDb(type: ProblemLength): Promise<ProblemWithAudio[]> {
  const rules = WORD_COUNT_RULES[type];
  if (!rules) {
    throw new Error(
      `Invalid type: ${type}. Valid types are: ${Object.keys(WORD_COUNT_RULES).join(', ')}`,
    );
  }

  const problems = await prisma.problem.findMany({
    where: {
      audioReady: true,
      wordCount: {
        gte: rules.min,
        lte: rules.max,
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: PROBLEM_CACHE_LIMIT,
  });

  const formattedProblems = problems.map(formatProblem);

  problemCache.set(type, {
    problems: formattedProblems,
    expiresAt: Date.now() + PROBLEM_CACHE_TTL_MS,
  });

  return formattedProblems;
}

async function getCachedProblems(type: ProblemLength): Promise<ProblemWithAudio[]> {
  const cacheEntry = problemCache.get(type);
  if (isCacheValid(cacheEntry)) {
    return cacheEntry.problems;
  }

  let loadingPromise = problemCacheLoading.get(type);
  if (!loadingPromise) {
    loadingPromise = loadProblemsFromDb(type).catch((error) => {
      problemCache.delete(type);
      throw error;
    });
    problemCacheLoading.set(type, loadingPromise);
    loadingPromise.finally(() => {
      problemCacheLoading.delete(type);
    });
  }

  return loadingPromise;
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
  const formattedProblems: ProblemWithAudio[] = problems.map(formatProblem);

  return { problems: formattedProblems, count: formattedProblems.length };
}

/**
 * 24時間キャッシュされた問題リストからランダムに1件を返す
 */
export async function fetchRandomProblem(type: ProblemLength): Promise<ProblemWithAudio | null> {
  const problems = await getCachedProblems(type);
  if (problems.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * problems.length);
  return problems[randomIndex];
}
