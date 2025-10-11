import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { replaceUrlHost } from '@/lib/cdn-utils';
import { PROBLEM_FETCH_LIMIT } from '@/const';
import { redisClient } from '@/lib/redis';

const PROBLEM_CACHE_LIMIT = 100;
const PROBLEM_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const PROBLEM_CACHE_TTL_SECONDS = PROBLEM_CACHE_TTL_MS / 1000;
const PROBLEM_CACHE_KEY_PREFIX = 'problem-cache';

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

type GlobalProblemCache = {
  problemCache?: Map<ProblemLength, ProblemCacheEntry>;
  problemCacheLoading?: Map<ProblemLength, Promise<ProblemWithAudio[]>>;
};

const globalForProblemCache = globalThis as unknown as GlobalProblemCache;

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

function ensureDate(date: Date | string): Date {
  return date instanceof Date ? date : new Date(date);
}

function normalizeProblem(problem: ProblemWithAudio): ProblemWithAudio {
  return {
    ...problem,
    createdAt: ensureDate(problem.createdAt),
    updatedAt: ensureDate(problem.updatedAt),
  };
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

function getRedisKey(type: ProblemLength): string {
  return `${PROBLEM_CACHE_KEY_PREFIX}:${type}`;
}

async function saveProblemsToCache(
  type: ProblemLength,
  problems: ProblemWithAudio[],
): Promise<ProblemWithAudio[]> {
  const entry: ProblemCacheEntry = {
    problems,
    expiresAt: Date.now() + PROBLEM_CACHE_TTL_MS,
  };

  problemCache.set(type, entry);

  if (redisClient) {
    try {
      await redisClient.set(getRedisKey(type), entry, { ex: PROBLEM_CACHE_TTL_SECONDS });
    } catch (error) {
      console.warn('[Redis] set failed:', error);
    }
  }

  return entry.problems;
}

async function getProblemsFromRedis(type: ProblemLength): Promise<ProblemWithAudio[] | null> {
  if (!redisClient) return null;

  try {
    const entry = await redisClient.get<ProblemCacheEntry>(getRedisKey(type));
    if (!entry || !isCacheValid(entry)) {
      return null;
    }

    const normalizedProblems = entry.problems.map(normalizeProblem);
    problemCache.set(type, { problems: normalizedProblems, expiresAt: entry.expiresAt });

    return normalizedProblems;
  } catch (error) {
    console.warn('[Redis] get failed:', error);
    return null;
  }
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

  await saveProblemsToCache(type, formattedProblems);

  return formattedProblems;
}

async function getCachedProblems(type: ProblemLength): Promise<ProblemWithAudio[]> {
  const cacheEntry = problemCache.get(type);
  if (isCacheValid(cacheEntry)) {
    return cacheEntry.problems;
  }

  const redisProblems = await getProblemsFromRedis(type);
  if (redisProblems) {
    return redisProblems;
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
