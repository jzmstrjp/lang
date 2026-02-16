import type { ProblemWithAudio } from '@/lib/problem-service';

export type BlankProblemData = {
  problemId: string;
  sentenceWithBlank: string; // "I ___ to the store"
  correctAnswer: string; // "went"
  options: string[]; // シャッフルされた4択
  correctIndex: number; // 正解のインデックス
  originalSentence: string; // 元の英文
  blankStartIndex: number; // 空白の開始位置
  blankEndIndex: number; // 空白の終了位置
};

/**
 * 英文を単語に分割する（末尾の句読点を除去）
 */
export function extractWords(sentence: string): string[] {
  // 英文を単語に分割し、末尾の句読点のみ除去
  const words = sentence
    .split(/\s+/)
    .map((word) => word.replace(/[.,!?;:]+$/g, ''))
    .filter((word) => word.length > 0);

  return words;
}

/**
 * 配列からランダムに要素を選択
 */
function randomChoice<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * 配列をシャッフル
 */
function shuffle<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

/**
 * 単語が大文字始まりかどうかを判定
 */
function startsWithUpperCase(word: string): boolean {
  if (word.length === 0) return false;
  return word[0] === word[0].toUpperCase() && word[0] !== word[0].toLowerCase();
}

/**
 * 単語の最初の文字を大文字にする
 */
function capitalize(word: string): string {
  if (word.length === 0) return word;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * 単語の最初の文字を小文字にする
 */
function uncapitalize(word: string): string {
  if (word.length === 0) return word;
  return word[0].toLowerCase() + word.slice(1);
}

/**
 * 正規表現で使用する際に特殊文字をエスケープする
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 単語穴埋め問題を生成
 */
export function generateBlankProblem(problem: ProblemWithAudio): BlankProblemData {
  const { id, englishSentence, englishReply } = problem;

  // 1. englishSentenceから単語を抽出
  const sentenceWords = extractWords(englishSentence);

  if (sentenceWords.length === 0) {
    throw new Error('英文に単語が含まれていません');
  }

  // 2. ランダムに1単語を選択（正解）
  const correctAnswer = randomChoice(sentenceWords);

  // 3. 選んだ単語を空白化した文を生成
  // 大文字小文字を区別せずに置換（ただし最初に見つかった箇所のみ）
  const escapedAnswer = escapeRegExp(correctAnswer);
  const regex = new RegExp(`\\b${escapedAnswer}\\b`, 'i');
  const match = englishSentence.match(regex);

  if (!match || match.index === undefined) {
    throw new Error('正解の単語が文章内に見つかりませんでした');
  }

  const blankStartIndex = match.index;
  const blankEndIndex = match.index + match[0].length;

  const sentenceWithBlank = englishSentence.replace(regex, '___');

  // 4. englishReplyから誤答候補を抽出
  const replyWords = extractWords(englishReply);

  // sentenceWordsを小文字化したセット（除外用）
  const sentenceWordsLower = new Set(sentenceWords.map((w) => w.toLowerCase()));

  // 正解と異なる、かつenglishSentenceに含まれない単語を誤答候補とする
  const incorrectCandidates = replyWords.filter(
    (word) =>
      word.toLowerCase() !== correctAnswer.toLowerCase() &&
      !sentenceWordsLower.has(word.toLowerCase()),
  );

  // 100単語のダミー単語リスト（TOEIC頻出の基本単語）
  const dummyWords = [
    'about',
    'after',
    'all',
    'also',
    'and',
    'any',
    'are',
    'as',
    'at',
    'be',
    'because',
    'been',
    'before',
    'being',
    'between',
    'both',
    'but',
    'by',
    'can',
    'come',
    'could',
    'day',
    'do',
    'even',
    'find',
    'first',
    'for',
    'from',
    'get',
    'give',
    'go',
    'good',
    'great',
    'had',
    'has',
    'have',
    'he',
    'her',
    'here',
    'him',
    'his',
    'how',
    'if',
    'in',
    'into',
    'is',
    'it',
    'its',
    'just',
    'know',
    'like',
    'look',
    'make',
    'many',
    'may',
    'me',
    'more',
    'most',
    'much',
    'must',
    'my',
    'new',
    'no',
    'not',
    'now',
    'of',
    'on',
    'one',
    'only',
    'or',
    'other',
    'our',
    'out',
    'over',
    'people',
    'said',
    'say',
    'see',
    'she',
    'should',
    'so',
    'some',
    'such',
    'take',
    'than',
    'that',
    'the',
    'their',
    'them',
    'then',
    'there',
    'these',
    'they',
    'this',
    'time',
    'to',
    'two',
    'up',
    'use',
    'very',
    'want',
    'way',
    'we',
    'well',
    'what',
    'when',
    'which',
    'who',
    'will',
    'with',
    'would',
    'year',
    'you',
    'your',
  ];

  // 誤答を3つ選ぶ（重複なし）
  let incorrectOptions: string[] = [];

  // まずenglishReplyから（englishSentence除外済み）
  if (incorrectCandidates.length >= 3) {
    const shuffled = shuffle(incorrectCandidates);
    incorrectOptions = shuffled.slice(0, 3);
  } else {
    incorrectOptions = [...incorrectCandidates];

    // 足りない場合はダミー単語から追加
    const availableDummies = dummyWords.filter(
      (word) =>
        word.toLowerCase() !== correctAnswer.toLowerCase() &&
        !sentenceWordsLower.has(word.toLowerCase()) &&
        !incorrectOptions.some((opt) => opt.toLowerCase() === word.toLowerCase()),
    );

    const shuffledDummies = shuffle(availableDummies);
    while (incorrectOptions.length < 3 && shuffledDummies.length > 0) {
      incorrectOptions.push(shuffledDummies.shift()!);
    }

    // それでも足りない場合は、最終手段としてenglishSentenceから使う
    if (incorrectOptions.length < 3) {
      const sentenceFallback = sentenceWords.filter(
        (word) =>
          word.toLowerCase() !== correctAnswer.toLowerCase() &&
          !incorrectOptions.some((opt) => opt.toLowerCase() === word.toLowerCase()),
      );
      const shuffledFallback = shuffle(sentenceFallback);
      while (incorrectOptions.length < 3 && shuffledFallback.length > 0) {
        incorrectOptions.push(shuffledFallback.shift()!);
      }
    }
  }

  // 正解が大文字始まりかどうかで、誤答も大文字・小文字を揃える
  const correctIsCapitalized = startsWithUpperCase(correctAnswer);
  const normalizedIncorrectOptions = incorrectOptions.map((word) => {
    if (correctIsCapitalized) {
      return capitalize(word);
    } else {
      return uncapitalize(word);
    }
  });

  // 5. 正解と誤答をシャッフルして4択を作成
  const allOptions = [correctAnswer, ...normalizedIncorrectOptions];
  const shuffledOptions = shuffle(allOptions);

  // 正解のインデックスを特定
  const correctIndex = shuffledOptions.findIndex(
    (option) => option.toLowerCase() === correctAnswer.toLowerCase(),
  );

  return {
    problemId: id,
    sentenceWithBlank,
    correctAnswer,
    options: shuffledOptions,
    correctIndex,
    originalSentence: englishSentence,
    blankStartIndex,
    blankEndIndex,
  };
}
