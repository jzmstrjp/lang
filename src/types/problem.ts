import { Prisma } from '@prisma/client';

/**
 * データベースに新しい問題を作成する際に使用する型
 * Prismaが生成したProblemCreateInputから自動生成される属性を除外
 */
export type CreateProblemData = Omit<Prisma.ProblemCreateInput, 'id' | 'createdAt' | 'updatedAt'>;

/**
 * seedデータで使用する型
 * wordCount、音声・画像URLは外部で設定される想定
 */
export type SeedProblemData = Omit<
  CreateProblemData,
  'wordCount' | 'audioEnUrl' | 'audioJaUrl' | 'audioEnReplyUrl' | 'imageUrl'
>;
