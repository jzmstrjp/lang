export type ProblemLength = 'kids' | 'short' | 'medium' | 'long';

export const WORD_COUNT_RULES = {
  kids: {
    min: 2,
    max: 6,
    sentenceNote:
      'ごく簡単な文法でごく短い口語文にしてください。中学1年生レベルの基本的な語彙・構文で作成すること。できるだけ短い文にしてください。例: "Water, please.", "Help me, please.", "Do you like soccer?", "Can I borrow your eraser?", "I like your jacket!", "Are you free today?"',
    sceneNote:
      '中高生の日常生活のシーンにしてください。友人・恋愛・部活・放課後・家族など中高生らしい話題が望ましいです。幼稚園児や小学校低学年を想起させるような幼い話題（砂遊び・おもちゃ・絵本など）は避けてください。ビジネスのシーンも避けてください。',
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
} as const satisfies Record<
  ProblemLength,
  { min: number; max: number; sentenceNote?: string; sceneNote?: string }
>;

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
