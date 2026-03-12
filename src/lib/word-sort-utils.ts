import { shuffleArray } from '@/lib/shuffle-utils';
import type { ProblemWithAudio } from '@/lib/problem-service';

/** 選択対象の単語トークン */
export type WordToken = {
  kind: 'word';
  id: string;
  word: string;
};

/** 自動表示される句読点トークン（選択不要） */
export type PunctuationToken = {
  kind: 'punctuation';
  id: string;
  punctuation: string;
};

export type SlotToken = WordToken | PunctuationToken;

export type WordSortProblemData = {
  problemId: string;
  /** シャッフル済み（単語のみ） */
  shuffledTokens: WordToken[];
  /** 正解順のスロット列（単語＋句読点） */
  correctSlots: SlotToken[];
};

const TRAILING_PUNCTUATION_RE = /^(.*?)([,;:!?.]+)$/;

/**
 * 英文をスペース分割し、末尾の句読点を単語から分離してスロット列を生成する
 */
function tokenize(sentence: string, problemId: string): SlotToken[] {
  const parts = sentence.trim().split(/\s+/);
  const slots: SlotToken[] = [];
  let wordIndex = 0;

  for (const part of parts) {
    const match = TRAILING_PUNCTUATION_RE.exec(part);
    if (match && match[1]) {
      slots.push({ kind: 'word', id: `${problemId}-${wordIndex}`, word: match[1] });
      wordIndex++;
      slots.push({ kind: 'punctuation', id: `${problemId}-p${wordIndex}`, punctuation: match[2] });
    } else if (match && !match[1]) {
      // 句読点のみ（先頭が句読点の場合）
      slots.push({ kind: 'punctuation', id: `${problemId}-p${wordIndex}`, punctuation: match[2] });
    } else {
      slots.push({ kind: 'word', id: `${problemId}-${wordIndex}`, word: part });
      wordIndex++;
    }
  }

  return slots;
}

/**
 * 英文をスペースで分割・句読点分離してシャッフルした並び替え問題データを生成する
 */
export function generateWordSortProblem(problem: ProblemWithAudio): WordSortProblemData {
  const problemId = String(problem.id);
  const correctSlots = tokenize(problem.englishSentence, problemId);
  const wordTokens = correctSlots.filter((s): s is WordToken => s.kind === 'word');
  const shuffledTokens = shuffleArray(wordTokens);

  return {
    problemId,
    shuffledTokens,
    correctSlots,
  };
}

/**
 * 選択済みトークンの並びが正解と一致するか判定する。
 * 同じ単語が複数ある場合も正しい位置であれば正解とするため、word の文字列で比較する。
 */
export function checkWordSortAnswer(
  selectedTokens: WordToken[],
  correctSlots: SlotToken[],
): boolean {
  const correctWords = correctSlots.filter((s): s is WordToken => s.kind === 'word');
  if (selectedTokens.length !== correctWords.length) return false;
  return selectedTokens.every(
    (token, index) => token.word.toLowerCase() === correctWords[index].word.toLowerCase(),
  );
}
