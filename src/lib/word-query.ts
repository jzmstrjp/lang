import type { Prisma } from '@prisma/client';
import type { ProblemLength } from '@/config/problem';

/** 問題の長さに対応する words テーブルの検索条件 */
export function wordWhereForProblemLength(type: ProblemLength): Prisma.WordWhereInput {
  if (type === 'kids') {
    return { isKids: true };
  }
  return {
    OR: [{ targetLength: type }, { isKids: false, targetLength: null }],
  };
}
