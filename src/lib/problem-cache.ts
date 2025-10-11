import type { ProblemLength } from '@/config/problem';
import type { ProblemWithAudio } from '@/lib/problem-service';
import { redisClient } from '@/lib/redis';

const PROBLEM_CACHE_KEY_PREFIX = 'problem-cache';

type ProblemCacheEntry = {
  problems: ProblemWithAudio[];
  expiresAt: number;
};

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

export async function fetchFirstProblem(type: ProblemLength): Promise<ProblemWithAudio | null> {
  if (!redisClient) {
    return null;
  }

  try {
    const entry = await redisClient.get<ProblemCacheEntry>(`${PROBLEM_CACHE_KEY_PREFIX}:${type}`);
    if (!entry || !Array.isArray(entry.problems) || entry.problems.length === 0) {
      return null;
    }

    const normalizedProblems = entry.problems.map(normalizeProblem);
    const randomIndex = Math.floor(Math.random() * normalizedProblems.length);
    return normalizedProblems[randomIndex] ?? null;
  } catch (error) {
    console.warn('[Redis] fetchFirstProblem failed:', error);
    return null;
  }
}
