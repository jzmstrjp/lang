export type ProblemLength = 'kids' | 'short' | 'medium' | 'long';

/** `/problems/[type]` で有効な長さ（子ども向けは `/level/kids`） */
export const PROBLEM_ROUTE_LENGTHS = ['short', 'medium', 'long'] as const;

export type ProblemRouteLength = (typeof PROBLEM_ROUTE_LENGTHS)[number];

export const WORD_COUNT_RULES = {
  kids: {
    min: 2,
    max: 6,
    sentenceNote:
      'ビジネスシーンのセリフは避けてください。OBJECT や ADJECTIVE などは、文脈に合う自然で具体的な英単語に差し替えてください。',
  },
  short: {
    min: 3,
    max: 9,
    sentenceNote: '指定されたワード以外は、中学生でも分かりそうな語彙で作成すること。',
  },
  medium: { min: 10, max: 15 },
  long: {
    min: 16,
    max: 30,
    sentenceNote: '1つの文を無理に長くせずとも、複数の文に分けても良い。',
  },
} as const satisfies Record<ProblemLength, { min: number; max: number; sentenceNote?: string }>;

export const VALID_DIFFICULTY_LEVELS = ['kids', 'non_kids'] as const;

export type DifficultyLevel = (typeof VALID_DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LEVEL_RULES: Record<
  DifficultyLevel,
  { min: number; max: number; displayName: string }
> = {
  kids: { min: 1, max: 2, displayName: 'Kids' },
  non_kids: { min: 3, max: 10, displayName: 'Non-Kids' },
};

/**
 * WORD_COUNT_RULESから指定されたタイプの単語数配列を動的に生成
 * 例: short タイプの場合 [2, 3, 4, 5, 6] を返す
 */
export function generateWordCountArray(type: ProblemLength): number[] {
  const rule = WORD_COUNT_RULES[type];
  const wordCounts: number[] = [];
  for (let i = rule.min; i <= rule.max; i++) {
    wordCounts.push(i);
  }
  return wordCounts;
}

/**
 * 指定されたタイプから単語数をランダムに選択
 */
export function selectRandomWordCount(type: ProblemLength): number {
  const wordCountArray = generateWordCountArray(type);
  return wordCountArray[Math.floor(Math.random() * wordCountArray.length)];
}

/**
 * 英文の単語数を計算する
 */
export function countWords(text: string): number {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean).length;
}
