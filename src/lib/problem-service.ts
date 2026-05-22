import { cacheLife } from 'next/cache';
import { prisma } from '@/lib/prisma';
import type { Problem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import {
  WORD_COUNT_RULES,
  DIFFICULTY_LEVEL_RULES,
  type ProblemLength,
  type DifficultyLevel,
} from '@/config/problem';
import {
  PROBLEM_FETCH_LIMIT,
  EXPRESSION_FETCH_PHRASES,
  EXPRESSION_FETCH_PER_PHRASE,
  cdnUrl,
} from '@/const';

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
  maxWordCount?: number;
  difficultyLevel?: DifficultyLevel;
  search?: string;
  limit?: number;
  includeNullDifficulty?: boolean;
  latestCount?: number;
  groupByExpression?: boolean;
};

const LATEST_COUNT_MAX = 10000;

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
    audioEnUrl: problem.audioEnUrl ? cdnUrl(problem.audioEnUrl) : '',
    audioJaUrl: problem.audioJaUrl ? cdnUrl(problem.audioJaUrl) : '',
    audioEnReplyUrl: problem.audioEnReplyUrl ? cdnUrl(problem.audioEnReplyUrl) : '',
    imageUrl: problem.imageUrl ? cdnUrl(problem.imageUrl) : null,
  };
}

/**
 * 問題をデータベースから取得する共通関数
 * サーバーコンポーネント・APIルートの両方から使用可能
 */
export async function fetchProblems(options: FetchProblemsOptions): Promise<FetchProblemsResult> {
  const {
    type,
    maxWordCount,
    difficultyLevel,
    search,
    limit = PROBLEM_FETCH_LIMIT,
    includeNullDifficulty = false,
    latestCount,
    groupByExpression = false,
  } = options;

  // limitの範囲チェック
  const sanitizedLimit = Math.min(Math.max(limit, 1), PROBLEM_FETCH_LIMIT);

  // 検索文字列の前処理
  const trimmedSearch = search?.trim();
  const hasSearch = trimmedSearch && trimmedSearch.length > 0;

  // WHERE句を構築
  const whereClauses: Prisma.Sql[] = [
    Prisma.sql`"audioReady" = true`,
    Prisma.sql`"imageUrl" IS NOT NULL`,
  ];

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

  // maxWordCountが指定されている場合は上限でフィルタ（typeより優先）
  if (maxWordCount !== undefined) {
    whereClauses.push(Prisma.sql`"wordCount" <= ${maxWordCount}`);
  }

  // difficultyLevelが指定されている場合は難易度でフィルタ
  if (difficultyLevel) {
    const rules = DIFFICULTY_LEVEL_RULES[difficultyLevel];
    if (!rules) {
      throw new Error(
        `Invalid difficultyLevel: ${difficultyLevel}. Valid levels are: ${Object.keys(DIFFICULTY_LEVEL_RULES).join(', ')}`,
      );
    }
    if (includeNullDifficulty) {
      whereClauses.push(
        Prisma.sql`("difficultyLevel" IS NULL OR ("difficultyLevel" >= ${rules.min} AND "difficultyLevel" <= ${rules.max}))`,
      );
    } else {
      whereClauses.push(Prisma.sql`"difficultyLevel" >= ${rules.min}`);
      whereClauses.push(Prisma.sql`"difficultyLevel" <= ${rules.max}`);
    }
  }

  // 検索条件を追加
  if (hasSearch) {
    whereClauses.push(
      Prisma.sql`("englishSentence" ILIKE ${`%${trimmedSearch}%`} OR "japaneseSentence" ILIKE ${`%${trimmedSearch}%`})`,
    );
  }

  // WHERE句を結合
  const whereClause = Prisma.join(whereClauses, ' AND ');

  let problems: ProblemWithAudio[];

  if (groupByExpression && !hasSearch) {
    // EXPRESSION_FETCH_PHRASES グループ × EXPRESSION_FETCH_PER_PHRASE 問を取得
    // latestCount が指定されている場合は最新N件の中から選ぶ
    const baseQuery =
      latestCount !== undefined
        ? Prisma.sql`(SELECT * FROM "problems" WHERE ${whereClause} ORDER BY "createdAt" DESC LIMIT ${Math.min(Math.max(Math.floor(latestCount), 1), LATEST_COUNT_MAX)}) AS p`
        : Prisma.sql`"problems" p`;
    const outerWhere = latestCount !== undefined ? Prisma.empty : Prisma.sql`WHERE ${whereClause}`;
    problems = await prisma.$queryRaw<ProblemWithAudio[]>`
      SELECT p.*
      FROM ${baseQuery}
      JOIN (
        SELECT "expression", "expressionJa"
        FROM ${baseQuery}
        WHERE "expression" IS NOT NULL
        GROUP BY "expression", "expressionJa"
        HAVING COUNT(*) >= 2
        ORDER BY RANDOM()
        LIMIT ${EXPRESSION_FETCH_PHRASES}
      ) AS chosen
        ON p."expression" = chosen."expression"
        AND (p."expressionJa" = chosen."expressionJa" OR (p."expressionJa" IS NULL AND chosen."expressionJa" IS NULL))
      ${outerWhere}
      ORDER BY p."expression", p."expressionJa", RANDOM()
    `;
    // 各グループから最大 EXPRESSION_FETCH_PER_PHRASE 件に絞る
    const seen = new Map<string, number>();
    problems = problems.filter((p) => {
      const key = `${p.expression ?? ''}::${p.expressionJa ?? ''}`;
      const count = seen.get(key) ?? 0;
      if (count >= EXPRESSION_FETCH_PER_PHRASE) return false;
      seen.set(key, count + 1);
      return true;
    });

    // 共通: expressionでグループ化して2つずつペアで交互に並べる
    // 例: [ex1×3, ex2×3, ex3×2, ex4×2] →
    //     ex1, ex2, ex1, ex2, ex1, ex2, ex3, ex4, ex3, ex4
    const withExpression = problems.filter((p) => p.expression != null);
    const withoutExpression = problems.filter((p) => p.expression == null);
    const grouped = new Map<string, ProblemWithAudio[]>();
    for (const p of withExpression) {
      const key = `${p.expression}::${p.expressionJa ?? ''}`;
      const group = grouped.get(key) ?? [];
      group.push(p);
      grouped.set(key, group);
    }
    const groups = Array.from(grouped.values()).toSorted((a, b) => b.length - a.length);
    const interleaved: ProblemWithAudio[] = [];
    for (let pairStart = 0; pairStart < groups.length; pairStart += 2) {
      const pair = groups.slice(pairStart, pairStart + 2);
      const maxInPair = Math.max(...pair.map((g) => g.length));
      for (let i = 0; i < maxInPair; i++) {
        for (const group of pair) {
          if (i < group.length) interleaved.push(group[i]!);
        }
      }
    }
    problems = [...interleaved, ...withoutExpression];
  } else {
    // 条件全体からランダム取得
    problems = await prisma.$queryRaw<ProblemWithAudio[]>`
      SELECT * FROM "problems"
      WHERE ${whereClause}
      ORDER BY RANDOM()
      LIMIT ${sanitizedLimit}
    `;
  }

  if (!problems || problems.length === 0) {
    return { problems: [], count: 0 };
  }

  const formattedProblems: ProblemWithAudio[] = problems.map(formatProblem);

  return { problems: formattedProblems, count: formattedProblems.length };
}

const INITIAL_PROBLEMS_POOL_SIZE = 10;

/**
 * 初期表示用に複数件まとめて取得する。
 * `'use cache: remote'` で Vercel Runtime Cache（リージョン内全インスタンス共有）に
 * キャッシュし、呼び出し側で配列からランダムに1件選ぶことで
 * 「キャッシュは効かせつつアクセスごとの問題はランダム」を両立する。
 *
 * `'use cache'`（in-memory）だと Vercel Lambda が ephemeral なため cold start で
 * 即消失してしまい cache miss が多発する。Next.js 16 + Vercel での公式推奨は
 * `'use cache: remote'`。
 * https://www.vercel.com/docs/runtime-cache
 */
export async function loadInitialProblems(
  options: Omit<FetchProblemsOptions, 'limit'>,
): Promise<ProblemWithAudio[]> {
  'use cache: remote';
  cacheLife('hours');

  const { problems } = await fetchProblems({
    ...options,
    limit: INITIAL_PROBLEMS_POOL_SIZE,
  });
  return problems;
}

const PROBLEM_LENGTHS: ProblemLength[] = ['kids', 'short', 'medium', 'long'];

export type ProblemsByLength = Record<ProblemLength, ProblemWithAudio[]>;

/**
 * `/problems/[type]` の全 type 分の初期問題プールをまとめて取得する。
 * 引数なしなのでキャッシュエントリは 1 つに集約される（4 type 分のプールを 1 cache key で保持）。
 * search や latest など個別パラメータが付くケースでは fetchProblems を直接呼ぶ側で取得する。
 *
 * `'use cache: remote'` で Vercel Runtime Cache に保存することで、
 * Lambda インスタンス間で共有される（cold start でも cache hit する）。
 */
export async function loadInitialProblemsByLength(): Promise<ProblemsByLength> {
  'use cache: remote';
  cacheLife('hours');

  const entries = await Promise.all(
    PROBLEM_LENGTHS.map(async (type) => {
      const { problems } = await fetchProblems({
        type,
        difficultyLevel: 'non_kids',
        limit: INITIAL_PROBLEMS_POOL_SIZE,
        includeNullDifficulty: true,
      });
      return [type, problems] as const;
    }),
  );

  return Object.fromEntries(entries) as ProblemsByLength;
}

/**
 * 初期問題プールから 1 件をランダムに選ぶ。
 * Server Component から呼ぶことを想定。
 * 各リクエストで新たに評価されるため、ユーザーごとに異なる問題が選ばれる
 * （プール自体は `'use cache'` で hour 単位でキャッシュされる）。
 */
export function pickRandomProblem(problems: ProblemWithAudio[]): ProblemWithAudio | null {
  if (problems.length === 0) return null;
  return problems[Math.floor(Math.random() * problems.length)] ?? null;
}
