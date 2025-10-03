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

/**
 * 選択肢をシャッフルして正解のインデックスを返す
 * 正解は配列の先頭にあることを前提とする
 */
export function shuffleOptionsWithCorrectIndex(
  correctOption: string,
  incorrectOptions: string[],
): { options: string[]; correctIndex: number } {
  const allOptions = [correctOption, ...incorrectOptions];
  const zipped = allOptions.map((option, index) => ({ option, index }));

  // シャッフル
  for (let i = zipped.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [zipped[i], zipped[j]] = [zipped[j], zipped[i]];
  }

  const options = zipped.map((item) => item.option);
  const correctIndex = zipped.findIndex((item) => item.index === 0);

  return { options, correctIndex: correctIndex === -1 ? 0 : correctIndex };
}
