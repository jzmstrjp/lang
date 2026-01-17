export type ProblemLength = 'short' | 'medium' | 'long';

export const WORD_COUNT_RULES = {
  short: {
    min: 2,
    max: 6,
    note: '指定された語彙以外は、中学2年生でも知っている単語や表現だけを使ってほしい。',
  },
  medium: { min: 7, max: 13 },
  long: {
    min: 14,
    max: 30,
  },
} as const satisfies Record<ProblemLength, { min: number; max: number; note?: string }>;

export const VALID_DIFFICULTY_LEVELS = [
  'kids',
  'non_kids',
  'easy',
  'normal',
  'hard',
  'expert',
] as const;

export type DifficultyLevel = (typeof VALID_DIFFICULTY_LEVELS)[number];

export const DIFFICULTY_LEVEL_RULES: Record<
  DifficultyLevel,
  { min: number; max: number; displayName: string }
> = {
  kids: { min: 1, max: 2, displayName: 'Kids' },
  non_kids: { min: 3, max: 10, displayName: 'Non-Kids' },
  easy: { min: 3, max: 4, displayName: 'Easy' },
  normal: { min: 5, max: 6, displayName: 'Normal' },
  hard: { min: 7, max: 8, displayName: 'Hard' },
  expert: { min: 9, max: 10, displayName: 'Expert' },
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
