/**
 * Fisher-Yatesアルゴリズムで配列をシャッフル
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export type ShuffledQuizOption =
  | {
      text: string;
      kind: 'correct';
      incorrectIndex: null;
    }
  | {
      text: string;
      kind: 'incorrect';
      incorrectIndex: number;
    };

/**
 * 選択肢をシャッフルして正解のインデックスを返す
 * 正解は配列の先頭にあることを前提とする
 */
export function shuffleOptionsWithCorrectIndex(
  correctOption: string,
  incorrectOptions: string[],
): { options: ShuffledQuizOption[]; correctIndex: number } {
  const baseOptions: ShuffledQuizOption[] = [
    {
      text: correctOption,
      kind: 'correct',
      incorrectIndex: null,
    },
    ...incorrectOptions.map<ShuffledQuizOption>((option, index) => ({
      text: option,
      kind: 'incorrect',
      incorrectIndex: index,
    })),
  ];

  const shuffled = shuffleArray(baseOptions);

  const correctIndex = shuffled.findIndex((item) => item.kind === 'correct');

  return {
    options: shuffled,
    correctIndex: correctIndex === -1 ? 0 : correctIndex,
  };
}
