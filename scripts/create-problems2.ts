#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { words } from '../docs/words';
import { TEXT_MODEL } from '@/const';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import type { SeedProblemData } from '@/types/problem';
import {
  buildEnglishReplyGeneratorUserPrompt,
  buildEnglishSentenceGeneratorUserPrompt,
  buildJapaneseDialogueGeneratorUserPrompt,
} from '@/prompts/problem-dialogue-prompts';
import { scoreProblem } from './score-and-prune-problems';

dotenv.config();

export type ConversationHow = '対面での会話' | '電話での会話' | 'ビデオ通話での会話';

const HOW_CANDIDATES: ConversationHow[] = [
  '対面での会話',
  '対面での会話',
  '対面での会話',
  '対面での会話',
  '対面での会話',
  '対面での会話',
  '対面での会話',
  '対面での会話',
  '電話での会話',
  'ビデオ通話での会話',
];

function pickRandomHow(): ConversationHow {
  return HOW_CANDIDATES[Math.floor(Math.random() * HOW_CANDIDATES.length)]!;
}

/**
 * LATEST_USED_WORD に基づいて words 配列の開始インデックスを返す
 */
function resolveStartIndex(startAfter: string | null): number {
  if (!startAfter) return 0;
  const idx = words.indexOf(startAfter);
  if (idx === -1) {
    console.error(
      `⚠️ LATEST_USED_WORD "${startAfter}" が words に見つかりません。先頭から使用します。`,
    );
    return 0;
  }
  return idx + 1;
}

/**
 * DB から LATEST_USED_WORD を読む
 */
async function getLatestUsedWord(): Promise<string | null> {
  if (!process.env.DATABASE_URL) {
    return null;
  }
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: 'LATEST_USED_WORD' },
    });
    return config?.value ?? null;
  } catch (e) {
    console.error('⚠️ LATEST_USED_WORD の取得に失敗しました:', e instanceof Error ? e.message : e);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DB に LATEST_USED_WORD を保存する
 */
async function updateLatestUsedWord(word: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('⚠️ DATABASE_URL が未設定のため LATEST_USED_WORD を更新できません');
    return;
  }
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    await prisma.appConfig.upsert({
      where: { key: 'LATEST_USED_WORD' },
      update: { value: word },
      create: { key: 'LATEST_USED_WORD', value: word },
    });
    console.error(`🔖 LATEST_USED_WORD を "${word}" に更新しました`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * docs/words.ts の語彙に含まれるときだけ LATEST_USED_WORD を更新する（CLIの任意表現用）
 */
async function persistLatestUsedWordIfKnown(word: string): Promise<void> {
  if (!words.includes(word)) {
    console.error(
      `⚠️ LATEST_USED_WORD を更新しません（docs/words.ts の語彙に含まれないため: "${word}"）`,
    );
    return;
  }
  try {
    await updateLatestUsedWord(word);
  } catch (e) {
    console.error('⚠️ LATEST_USED_WORD の更新に失敗しました:', e instanceof Error ? e.message : e);
  }
}

/**
 * 使用済み語彙を docs/words.ts から除外（create-problems.ts と同じ）
 */
function removeUsedWordsFromWordList(wordsToRemove: readonly string[]): void {
  if (wordsToRemove.length === 0) {
    return;
  }

  const wordsPath = path.join(process.cwd(), 'docs', 'words.ts');

  if (!fs.existsSync(wordsPath)) {
    console.error(`⚠️ 語彙ファイルが見つからないため削除をスキップします: ${wordsPath}`);
    return;
  }

  const originalContent = fs.readFileSync(wordsPath, 'utf-8');
  const lines = originalContent.split('\n');
  const remainingWords = new Set(wordsToRemove);

  const updatedLines = lines.filter((line) => {
    const trimmed = line.trim();
    const match = trimmed.match(/^(['"])(.+)\1,?\s*$/);
    if (!match) {
      return true;
    }

    const wordValue = match[2];
    if (remainingWords.has(wordValue)) {
      remainingWords.delete(wordValue);
      return false;
    }

    return true;
  });

  if (remainingWords.size > 0) {
    console.error(
      `⚠️ 次の語彙はwords.tsで見つからず削除できませんでした: ${Array.from(remainingWords).join(', ')}`,
    );
  }

  const updatedContent = updatedLines.join('\n');
  if (updatedContent !== originalContent) {
    fs.writeFileSync(wordsPath, updatedContent, 'utf-8');
    console.error('✅ words.tsから使用済み語彙を削除しました');
  }
}

/**
 * 現在の words 配列上で lastWord まで（先頭から連続）を docs/words.ts から削除する
 */
function removeConsumedWordsThrough(lastWord: string): void {
  const lastIdx = words.indexOf(lastWord);
  if (lastIdx === -1) {
    console.error(
      `⚠️ "${lastWord}" が words 配列に見つからないため、words.ts からの一括削除をスキップします`,
    );
    return;
  }
  console.error('🧹 使用済み語彙をwords.tsから削除中...');
  removeUsedWordsFromWordList(words.slice(0, lastIdx + 1));
}

/**
 * SeedProblemData を直接 DB に投入し、成功後に LATEST_USED_WORD を更新する（--batch --seed 用）
 */
async function seedToDatabase(seedProblems: SeedProblemData[], lastWord: string): Promise<void> {
  const rawPrisma = new PrismaClient({ log: ['error'] });
  const acceleratedPrisma = rawPrisma.$extends(withAccelerate()) as unknown as PrismaClient;

  try {
    const createData = seedProblems.map((problem) => {
      const wordCount = problem.englishSentence
        .trim()
        .split(/\s+/)
        .filter((w) => w.length > 0).length;
      return {
        ...problem,
        wordCount,
        incorrectOptions: problem.incorrectOptions,
        audioEnUrl: null,
        audioJaUrl: null,
        audioEnReplyUrl: null,
        imageUrl: null,
      };
    });

    const result = await acceleratedPrisma.problem.createMany({
      data: createData,
      skipDuplicates: true,
    });

    console.error(
      `✅ DB投入完了: ${result.count}件挿入 (重複スキップ: ${createData.length - result.count}件)`,
    );

    await rawPrisma.appConfig.upsert({
      where: { key: 'LATEST_USED_WORD' },
      update: { value: lastWord },
      create: { key: 'LATEST_USED_WORD', value: lastWord },
    });
    console.error(`🔖 LATEST_USED_WORD を "${lastWord}" に更新しました`);
  } finally {
    await rawPrisma.$disconnect();
  }
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
};

function extractJsonArray(content: string): string {
  const fenced = content.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  const start = content.indexOf('[');
  const end = content.lastIndexOf(']');
  if (start !== -1 && end > start) {
    return content.slice(start, end + 1);
  }
  throw new Error('JSON配列が見つかりませんでした');
}

/** 話者の性別（TTS / SeedProblemData の VoiceType と同じ） */
type ProblemVoice = 'male' | 'female';

/** クイズ用に、台詞の状況説明を日本語で置くための下書き（problem1 の place / role に相当する段階） */
type SentenceContextDraft = {
  englishSentence: string;
  when: string;
  where: string;
  how: ConversationHow;
  senderRole: string;
  receiverRole: string;
  senderVoice: ProblemVoice;
  receiverVoice: ProblemVoice;
};

const VALID_HOW_VALUES: ConversationHow[] = ['対面での会話', '電話での会話', 'ビデオ通話での会話'];

function parseSentenceContextDraft(
  value: unknown,
  senderVoice: ProblemVoice,
  how: ConversationHow,
): SentenceContextDraft | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const o = value as Record<string, unknown>;
  if (
    typeof o.englishSentence !== 'string' ||
    typeof o.when !== 'string' ||
    typeof o.where !== 'string' ||
    typeof o.senderRole !== 'string' ||
    typeof o.receiverRole !== 'string'
  ) {
    return null;
  }
  const parsedHow: ConversationHow =
    typeof o.how === 'string' && VALID_HOW_VALUES.includes(o.how as ConversationHow)
      ? (o.how as ConversationHow)
      : how;
  const receiverVoice: ProblemVoice = senderVoice === 'male' ? 'female' : 'male';
  return {
    englishSentence: o.englishSentence,
    when: o.when,
    where: o.where,
    how: parsedHow,
    senderRole: o.senderRole,
    receiverRole: o.receiverRole,
    senderVoice,
    receiverVoice,
  };
}

type SentenceReplyDraft = {
  englishSentence: string;
  englishReply: string;
};

/** SentenceContextDraft に englishReply を足した1行（日本語翻訳の入力） */
type SentenceRowDraft = SentenceContextDraft & {
  englishReply: string;
};

/** 英日が揃った1行（seed 組み立て用） */
type SentenceBilingualDraft = SentenceRowDraft & {
  japaneseSentence: string;
  japaneseReply: string;
};

function isSentenceReplyDraft(value: unknown): value is SentenceReplyDraft {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return typeof o.englishSentence === 'string' && typeof o.englishReply === 'string';
}

/**
 * 話しかけ＋返答のペアごとに「いつ・どこで・誰が・誰に」と、話者・聞き手の性別（必ず異なる）を埋める。
 * buildEnglishReplies の後に呼び、返答と整合するシーンにする。
 * 後続で SeedProblemData の place / senderRole / receiverRole / senderVoice / receiverVoice に流用しやすい形。
 */
async function buildSentenceContextDrafts(
  replies: SentenceReplyDraft[],
  expression: string,
  senderVoice: ProblemVoice,
  how: ConversationHow,
): Promise<SentenceContextDraft[]> {
  if (replies.length === 0) {
    return [];
  }

  const receiverVoice: ProblemVoice = senderVoice === 'male' ? 'female' : 'male';
  const senderGender = senderVoice === 'male' ? '男性' : '女性';
  const receiverGender = receiverVoice === 'male' ? '男性' : '女性';

  const list = replies
    .map(
      (r, i) =>
        `${i + 1}. 話しかけ（英文）: ${r.englishSentence}\n   返答（英文）: ${r.englishReply}`,
    )
    .join('\n\n');

  const howNote =
    how === '電話での会話'
      ? '話しかける人（sender）が電話をかけている場所（例: 自宅のリビング、オフィスのデスク）'
      : how === 'ビデオ通話での会話'
        ? '話しかける人（sender）がビデオ通話をしている場所（例: 自宅のデスク、会社の会議室）'
        : '話しかける人（sender）のいる場所（例: 会社の会議室、自宅のリビング）';
  const prompt = `以下は会話クイズ用の「話しかけ」とその「返答」のペアである。課題表現「${expression}」に沿って用意された候補である。

${list}

【タスク】
各ペアについて、会話が起きる状況を次のキーで日本語の短文で埋めよ（クイズのシーン設定用。seedの人間可読なラベル想定）。
話しかけと返答の両方の内容が矛盾しない場所・関係・空気になること。

- englishSentence: 各ペアの「話しかけ（英文）」を**一字一句同じ**にコピーすること
- when: いつ（例: 平日の午前、会議の直前、週末の夕方）
- where: どこで（${howNote}）
- how: **必ず "${how}" 固定**
- senderRole: 話しかける側の役割・関係（例: 上司、同僚、母親）
- receiverRole: 聞き手の役割・関係（例: 部下、取引先、息子）
- senderVoice: **必ず "${senderVoice}" 固定**
- receiverVoice: **必ず "${receiverVoice}" 固定**

【性別の割り当て（厳守）】
- このバッチでは **話しかける人（sender）は${senderGender}、聞き手（receiver）は${receiverGender}** と決まっている。
- senderVoice="${senderVoice}"、receiverVoice="${receiverVoice}" を**全問で固定**すること。変えてはならない。
- senderRole / receiverRole は必ずその性別と矛盾しない役割にすること。
  - sender が${senderGender}なら: ${senderVoice === 'male' ? '父親・息子・兄・弟・夫・男性同僚・男性上司 など' : '母親・娘・姉・妹・妻・女性同僚・女性上司 など'}
  - receiver が${receiverGender}なら: ${receiverVoice === 'male' ? '父親・息子・兄・弟・夫・男性同僚・男性部下 など' : '母親・娘・姉・妹・妻・女性同僚・女性部下 など'}
- 英文に名前（Sarah, Jake など）や代名詞（he/she/him/her）が含まれる場合はそれに従って role を決めること。ただし voice は上記固定値を維持すること。

【厳守】
- 出力は JSON 配列のみ。説明文や番号付きリストは禁止。
- englishSentence は入力ペアの話しかけ英文と完全一致させること。
- 現実的で具体的な設定にすること。

\`\`\`json
[
  {
    "englishSentence": "...",
    "when": "...",
    "where": "...",
    "how": "${how}",
    "senderRole": "...",
    "receiverRole": "...",
    "senderVoice": "${senderVoice}",
    "receiverVoice": "${receiverVoice}"
  }
]
\`\`\``;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    const jsonSlice = extractJsonArray(content);
    const parsed = JSON.parse(jsonSlice) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('レスポンスが配列ではありません');
    }

    const inputSet = new Set(replies.map((r) => r.englishSentence.trim()));
    const rows = parsed
      .map((v) => parseSentenceContextDraft(v, senderVoice, how))
      .filter((row): row is SentenceContextDraft => row !== null)
      .filter((row) => inputSet.has(row.englishSentence.trim()));

    if (rows.length !== replies.length) {
      console.warn(
        `  ⚠️ 状況オブジェクトは ${rows.length} 件（入力ペア ${replies.length} 件）。englishSentence の不一致で落ちた可能性があります`,
      );
    }

    const byEn = new Map(rows.map((r) => [r.englishSentence.trim(), r]));
    return replies
      .map((r) => byEn.get(r.englishSentence.trim()))
      .filter((row): row is SentenceContextDraft => row !== undefined);
  } catch (error) {
    console.error(
      'buildSentenceContextDrafts に失敗しました:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

/**
 * englishSentence に対する聞き手の返答を英文で付ける。
 * englishSentence の主題が連想できるような自然な口語にすること。
 */
async function buildEnglishReplies(
  sentences: string[],
  senderVoice: ProblemVoice,
): Promise<SentenceReplyDraft[]> {
  if (sentences.length === 0) {
    return [];
  }

  const list = sentences.map((s, i) => `${i + 1}. ${s}`).join('\n');
  const prompt = buildEnglishReplyGeneratorUserPrompt(list, senderVoice);

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.6,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    const jsonSlice = extractJsonArray(content);
    const parsed = JSON.parse(jsonSlice) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('レスポンスが配列ではありません');
    }

    const inputSet = new Set(sentences.map((s) => s.trim()));
    const rows = parsed
      .filter(isSentenceReplyDraft)
      .filter((row) => inputSet.has(row.englishSentence.trim()));

    if (rows.length !== sentences.length) {
      console.warn(
        `  ⚠️ englishReply は ${rows.length} 件（入力 ${sentences.length} 文）。englishSentence の不一致の可能性があります`,
      );
    }

    const byEn = new Map(rows.map((r) => [r.englishSentence.trim(), r]));
    return sentences
      .map((s) => byEn.get(s.trim()))
      .filter((r): r is SentenceReplyDraft => r !== undefined);
  } catch (error) {
    console.error(
      'buildEnglishReplies に失敗しました:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
}

function pairKey(englishSentence: string, englishReply: string): string {
  return `${englishSentence.trim()}\u0000${englishReply.trim()}`;
}

type SentenceJaApiRow = {
  englishSentence: string;
  englishReply: string;
  japaneseSentence: string;
  japaneseReply: string;
};

function isSentenceJaApiRow(value: unknown): value is SentenceJaApiRow {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const o = value as Record<string, unknown>;
  return (
    typeof o.englishSentence === 'string' &&
    typeof o.englishReply === 'string' &&
    typeof o.japaneseSentence === 'string' &&
    typeof o.japaneseReply === 'string'
  );
}

/**
 * SentenceContextDraft の文脈を添えて、englishSentence / englishReply を自然な日本語のセリフに翻訳する。
 */
async function buildJapaneseDialogues(rows: SentenceRowDraft[]): Promise<SentenceBilingualDraft[]> {
  if (rows.length === 0) {
    return [];
  }

  const blocks = rows
    .map((r) =>
      JSON.stringify(
        {
          englishSentence: r.englishSentence,
          englishReply: r.englishReply,
          when: r.when,
          where: r.where,
          senderRole: r.senderRole,
          receiverRole: r.receiverRole,
          senderVoice: r.senderVoice,
          receiverVoice: r.receiverVoice,
        },
        null,
        2,
      ),
    )
    .join('\n\n---\n\n');

  const prompt = buildJapaneseDialogueGeneratorUserPrompt(blocks);

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.4,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    const jsonSlice = extractJsonArray(content);
    const parsed = JSON.parse(jsonSlice) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('レスポンスが配列ではありません');
    }

    const inputKeys = new Set(rows.map((r) => pairKey(r.englishSentence, r.englishReply)));
    const apiRows = parsed
      .filter(isSentenceJaApiRow)
      .filter((row) => inputKeys.has(pairKey(row.englishSentence, row.englishReply)));

    if (apiRows.length !== rows.length) {
      console.warn(
        `  ⚠️ 日本語翻訳は ${apiRows.length} 件（入力 ${rows.length} 行）。english の不一致の可能性があります`,
      );
    }

    const byKey = new Map(
      apiRows.map((row) => [pairKey(row.englishSentence, row.englishReply), row]),
    );

    return rows.map((r) => {
      const ja = byKey.get(pairKey(r.englishSentence, r.englishReply));
      return {
        ...r,
        japaneseSentence: ja?.japaneseSentence ?? '',
        japaneseReply: ja?.japaneseReply ?? '',
      };
    });
  } catch (error) {
    console.error(
      'buildJapaneseDialogues に失敗しました:',
      error instanceof Error ? error.message : error,
    );
    return rows.map((r) => ({
      ...r,
      japaneseSentence: '',
      japaneseReply: '',
    }));
  }
}

/** 採点後に残す問題数（常に3問） */
const KEEP_TOP_N = 3;

/**
 * タイプごとの生成候補数（生成倍率）。
 * short/kids は品質ばらつきが大きいので多め、long は高得点が揃いやすいので少なめ。
 */
const CANDIDATES_COUNT: Record<ProblemLength, number> = {
  kids: 8,
  short: 8,
  medium: 8,
  long: 6,
};

const createEnglishSentences = async (
  expression: string,
  wordCountLength: ProblemLength = 'short',
  senderVoice: ProblemVoice = 'male',
  how: ConversationHow = '対面での会話',
): Promise<string[]> => {
  const rule = WORD_COUNT_RULES[wordCountLength];
  const { min, max } = rule;
  const noteBlock = 'note' in rule && rule.note ? `\n- **注意: ${rule.note}**` : '';
  const total = CANDIDATES_COUNT[wordCountLength];
  const half = total / 2;
  const prompt = buildEnglishSentenceGeneratorUserPrompt({
    expression,
    min,
    max,
    noteBlock,
    total,
    half,
    senderVoice,
    how,
  });

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    const jsonSlice = extractJsonArray(content);
    const parsed = JSON.parse(jsonSlice) as unknown;
    if (!Array.isArray(parsed)) {
      throw new Error('レスポンスが配列ではありません');
    }

    const sentences = parsed.filter((item): item is string => typeof item === 'string');

    if (sentences.length !== total) {
      console.warn(`  ⚠️ 期待は${total}文ですが ${sentences.length} 文が返されました`);
    }

    return sentences;
  } catch (error) {
    console.error(
      'createEnglishSentences に失敗しました:',
      error instanceof Error ? error.message : error,
    );
    return [];
  }
};

/**
 * OpenAI APIを使ってシーンプロンプトを生成
 */
async function createScenePrompt(problemData: {
  when: string;
  how: string;
  word: string;
  sender: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    englishSentence: string;
    japaneseSentence: string;
  };
  receiver: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    englishReply: string;
    japaneseReply: string;
  };
}): Promise<{
  result: {
    scenePrompt: string;
  };
  tokenUsage: TokenUsage;
} | null> {
  console.log(`  🎨 「${problemData.word}」のシーンプロンプト生成中...`);

  const prompt = `以下の会話シーンについて、画像生成AIを使用して実写の2コマ画像を生成します。画像生成AIに渡すための場面説明を200文字程度の日本語で作成してください。

【シーン情報】
- いつ: ${problemData.when}
- どのように: ${problemData.how}

【1コマ目: 話しかける人（${problemData.sender.voice === 'male' ? '男性' : '女性'}・${problemData.sender.role}）】
- 場所: ${problemData.sender.where}
- 最初のセリフ: 「${problemData.sender.japaneseSentence}」

【2コマ目: 返答する人（${problemData.receiver.voice === 'male' ? '男性' : '女性'}・${problemData.receiver.role}）】
- 場所: ${problemData.receiver.where}
- 返答のセリフ: 「${problemData.receiver.japaneseReply}」

【要件】
1. **200文字程度**で簡潔に。日常やビジネスの場面であり得そうな自然な会話シーンを想像して、そのシーンを説明すること。
2. ストーリーと場所の様子を説明。まず対面なのか電話なのかビデオ通話なのか書くこと。ストーリーにはセリフそのものは含めず、画像の生成に必要な背景の情報などを描くこと。
3. 1コマ目と2コマ目で何が起こるかを簡潔に。画像生成AIが1コマ目に何を描くべきか、2コマ目に何を描くべきか迷わないように明確に言語化すること。
4. AIに描かせたくない内容があれば簡潔に書くこと。(例: 男性は塩を持っていない、まだコーヒーは席に届いていない、テーブルには何もない)
5. プロパティ名（sender/receiver/englishSentence等）は使わず、自然な日本語で

【例】
- ビデオ通話での会話。火曜の夕方、1コマ目では女性の同僚が自宅のリビングでパソコンの前に座り、ビデオ通話で男性の同僚に納期の注意を真剣な表情で伝えている。2コマ目では男性がオフィスの会議室でPCのモニタを見ながら自信ありげに返答している。
- 対面での会話。水曜の昼、カフェで女性が男性と向かい合って話している。テーブル上には食べ終わった料理の皿がある。1コマ目で女性はデザートを食べようと提案している。2コマ目では男性が嬉しそうにその提案に賛成している。まだデザートは注文されていない。

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "scenePrompt": "ここに場面説明の文が入る。"
}
\`\`\``;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.5,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    // JSONを抽出
    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error('JSON形式のレスポンスが見つかりませんでした');
    }

    const result = JSON.parse(jsonMatch[1]) as {
      scenePrompt: string;
    };

    // 型チェック
    if (!result.scenePrompt) {
      throw new Error('scenePromptが見つかりません');
    }

    return {
      result,
      tokenUsage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error(
      `  ❌ シーンプロンプト生成に失敗しました:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * 短い文を指定された文字数に伸ばす
 */
async function extendShortOption(
  originalText: string,
  targetLength: number,
  problemIndex: number,
): Promise<{
  result: string;
  tokenUsage: TokenUsage;
}> {
  const additionalChars = targetLength - originalText.length;

  if (additionalChars <= 0) {
    return {
      result: originalText,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  try {
    const userPrompt = `${originalText}

上記の文章を冗長な言い回しに変えることで、確実に${additionalChars}文字だけ長い文章にしてください。そしてその文章だけを返してください。`;

    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    const extendedText = content.trim();

    if (extendedText.length > originalText.length) {
      console.log(
        `  ✅ ${problemIndex}問目: 選択肢を伸ばしました（${originalText.length}文字 → ${extendedText.length}文字）`,
      );
      return {
        result: extendedText,
        tokenUsage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
      };
    } else {
      return {
        result: originalText,
        tokenUsage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
      };
    }
  } catch {
    return {
      result: originalText,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

/**
 * 長い文を指定された文字数に縮める
 */
async function shortenLongOption(
  originalText: string,
  targetLength: number,
  problemIndex: number,
): Promise<{
  result: string;
  tokenUsage: TokenUsage;
}> {
  const charsToRemove = originalText.length - targetLength;

  if (charsToRemove <= 0) {
    return {
      result: originalText,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  try {
    const userPrompt = `${originalText}

上記の文章から「早く」「大声で」「ちゃんと」など、副詞的なワードを1つ削ることで、${targetLength - 1}文字の文章にしてください。必要であれば2ワード以上削ってもいいです。最後は「。」または「？」で終わること。そしてその文章だけを返してください。`;

    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: userPrompt }],
      temperature: 0.7,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    const shortenedText = content.trim();

    if (shortenedText.length < originalText.length) {
      console.log(
        `  ✅ ${problemIndex}問目: 選択肢を縮めました（${originalText.length}文字 → ${shortenedText.length}文字）`,
      );
      return {
        result: shortenedText,
        tokenUsage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
      };
    } else {
      return {
        result: originalText,
        tokenUsage: {
          input_tokens: response.usage?.input_tokens ?? 0,
          output_tokens: response.usage?.output_tokens ?? 0,
        },
      };
    }
  } catch {
    return {
      result: originalText,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

/**
 * incorrectOptionsの長さをチェックし、必要に応じて調整する
 */
async function adjustIncorrectOptionsLength(
  incorrectOptions: string[],
  japaneseSentence: string,
  problemIndex: number,
): Promise<{
  result: string[];
  tokenUsage: TokenUsage;
}> {
  const japaneseSentenceLength = japaneseSentence.length;

  const allShorter = incorrectOptions.every((opt) => opt.length < japaneseSentenceLength);
  const allLonger = incorrectOptions.every((opt) => opt.length > japaneseSentenceLength);

  if (!allShorter && !allLonger) {
    return {
      result: incorrectOptions,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  if (allShorter) {
    console.log(
      `  ⚠️ ${problemIndex}問目: incorrectOptionsが全て短いため、調整します（基準: ${japaneseSentenceLength}文字）`,
    );

    incorrectOptions.sort((a, b) => a.length - b.length);
    const shortest = incorrectOptions.shift()!;
    console.log(`  📌 ${problemIndex}問目: 選択肢（${shortest.length}文字）を伸ばします`);

    const targetLength = japaneseSentenceLength + 3;
    const extendResult = await extendShortOption(shortest, targetLength, problemIndex);

    return {
      result: [...incorrectOptions, extendResult.result],
      tokenUsage: extendResult.tokenUsage,
    };
  }

  // allLonger: 全て長い → 最長のものを縮める
  console.log(
    `  ⚠️ ${problemIndex}問目: incorrectOptionsが全て長いため、調整します（基準: ${japaneseSentenceLength}文字）`,
  );

  incorrectOptions.sort((a, b) => b.length - a.length);
  const longest = incorrectOptions.shift()!;
  console.log(`  📌 ${problemIndex}問目: 選択肢（${longest.length}文字）を縮めます`);

  const targetLength = Math.max(japaneseSentenceLength - 3, 5);
  const shortenResult = await shortenLongOption(longest, targetLength, problemIndex);

  return {
    result: [...incorrectOptions, shortenResult.result],
    tokenUsage: shortenResult.tokenUsage,
  };
}

/**
 * OpenAI APIを使って誤答選択肢を生成
 */
const SILLY_OPTION_WORDS = [
  'ペンギン',
  'タコ',
  'カバ',
  'ナマケモノ',
  'アルマジロ',
  'フラミンゴ',
  'カモノハシ',
  'ハリネズミ',
  'プレーリードッグ',
  'ナポレオンフィッシュ',
  'コアラ',
  'ビーバー',
  'カピバラ',
  'チンチラ',
  'ウォンバット',
  '妖精',
  'ドラゴン',
  '河童',
  '雪女',
  '座敷童',
  '竜巻',
  '虹',
  '流れ星',
  'オーロラ',
  'ブラックホール',
  'たい焼き',
  '肉まん',
  'わらび餅',
  'ずんだもち',
  'かりんとう',
  'おせんべい',
  '大福',
  'シュークリーム',
  'チョコフォンデュ',
  'バウムクーヘン',
  '三味線',
  '尺八',
  'ハーモニカ',
  'カスタネット',
  'タンバリン',
  '将棋',
  '囲碁',
  'けん玉',
  'コマ',
  'あやとり',
  'ゴム跳び',
  '竹馬',
  '風呂敷',
  '羅針盤',
  'そろばん',
];

/**
 * OpenAI APIを使って誤答選択肢を生成
 */
async function createIncorrectOptions(
  japaneseSentence: string,
  isKids = false,
): Promise<{
  result: string[];
  tokenUsage: TokenUsage;
} | null> {
  console.log(`  🎯 誤答選択肢を生成中...`);

  const sillyWord = SILLY_OPTION_WORDS[Math.floor(Math.random() * SILLY_OPTION_WORDS.length)];

  const prompt = `以下の「正解の日本語文」に対して、誤答選択肢を3つ生成してください。クイズ用に使用します。

【正解の日本語文】
${japaneseSentence}

【誤答選択肢の構成（必須）】
1つ目: **馬鹿馬鹿しい選択肢**
  - 「${sillyWord}」というワードを必ず含めること
  - 笑ってしまうような、ありえない内容（例: 今日は手のひらサイズの象を食べました。）
  - 失礼すぎて笑ってしまうような内容（例: 貴様のプレゼン資料はゴミ以下ですね！）
  - 正解とは全く関係ない、面白おかしい文（例: たい焼きは本当に鯛を焼いて作っているらしいですが、ご存知でしたか？）
  - 文字数: 正解（${japaneseSentence.length}文字）と同じ

2つ目: **明らかな間違い**
  - 正解と微妙に違う話題。
    - 例: 正解が「いつも夕飯は自分で作るの？」だとしたら「朝食はほとんど食べないの？」など
  - 文字数: 正解（${japaneseSentence.length}文字）と同じ

3つ目: **明らかな間違い**
  - かなり無関係な内容
  - 文字数: 正解（${japaneseSentence.length}文字）と同じ

【重要ルール】
${!isKids && `- 文字数が全然足りないのは禁止。少し冗長な言い回しにしてでも（${japaneseSentence.length}文字）と同じ文字数にすること。`}
- 正解の日本語文が疑問文の場合、3つとも全て疑問文を生成すること
- 正解の文と似たような意味に取れる文は作らないこと。（それではクイズにならないため）
- 3つとも、バラバラの単語から始まる文であること。ただし頭に「まずは」「実は」「ちなみに」「ところで」などを加えて誤魔化すのは禁止。自然に別の単語から始まる文を作ること。
- 最後は「。」または「？」で終わること。

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
[
  "馬鹿馬鹿しい選択肢（1つ目）",
  "微妙に違う話題（2つ目）",
  "明らかな間違い（3つ目）"
]
\`\`\``;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    if (response.status === 'incomplete') {
      throw new Error('GPTからのレスポンスが完了しませんでした');
    }

    const content = response.output_text;
    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    // JSONを抽出
    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch || !jsonMatch[1]) {
      throw new Error('JSON形式のレスポンスが見つかりませんでした');
    }

    const result = JSON.parse(jsonMatch[1]) as string[];

    // 型チェック
    if (!Array.isArray(result) || result.length !== 3) {
      throw new Error('誤答選択肢は3つの配列である必要があります');
    }

    if (!result.every((opt) => typeof opt === 'string' && opt.trim().length > 0)) {
      throw new Error('誤答選択肢の各要素は空でない文字列である必要があります');
    }

    return {
      result,
      tokenUsage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error(
      `  ❌ 誤答選択肢生成に失敗しました:`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

type ScenePromptProblemInput = Parameters<typeof createScenePrompt>[0];

function toScenePromptInputFromRow(
  row: SentenceBilingualDraft,
  expression: string,
): ScenePromptProblemInput {
  return {
    when: row.when,
    how: row.how,
    word: expression,
    sender: {
      role: row.senderRole,
      voice: row.senderVoice,
      where: row.where,
      englishSentence: row.englishSentence,
      japaneseSentence: row.japaneseSentence,
    },
    receiver: {
      role: row.receiverRole,
      voice: row.receiverVoice,
      where: row.where,
      englishReply: row.englishReply,
      japaneseReply: row.japaneseReply,
    },
  };
}

async function enrichSentenceRowToSeedProblemData(
  row: SentenceBilingualDraft,
  expression: string,
  problemIndex: number,
  isKids = false,
): Promise<SeedProblemData | null> {
  const sceneRes = await createScenePrompt(toScenePromptInputFromRow(row, expression));
  if (!sceneRes) {
    return null;
  }

  const incorrectRes = await createIncorrectOptions(row.japaneseSentence, isKids);
  if (!incorrectRes) {
    return null;
  }

  const adjusted = await adjustIncorrectOptionsLength(
    incorrectRes.result,
    row.japaneseSentence,
    problemIndex,
  );

  return {
    place: row.where,
    senderRole: row.senderRole,
    senderVoice: row.senderVoice,
    receiverRole: row.receiverRole,
    receiverVoice: row.receiverVoice,
    englishSentence: row.englishSentence,
    japaneseSentence: row.japaneseSentence,
    englishReply: row.englishReply,
    japaneseReply: row.japaneseReply,
    scenePrompt: sceneRes.result.scenePrompt,
    senderVoiceInstruction: null,
    receiverVoiceInstruction: null,
    incorrectOptions: adjusted.result,
    difficultyLevel: isKids ? 1 : null,
  };
}

const PROBLEM_LENGTHS: ProblemLength[] = ['kids', 'short', 'medium', 'long'];

/**
 * 次の problem ファイル番号を取得（create-problems.ts の getNextProblemNumber と同じ）
 */
function getNextProblemNumber(): number {
  const problemDir = path.join(process.cwd(), 'problemData');

  if (!fs.existsSync(problemDir)) {
    fs.mkdirSync(problemDir, { recursive: true });
    return 1;
  }

  const files = fs.readdirSync(problemDir).filter((file) => file.match(/^problem(\d+)\.ts$/));

  if (files.length === 0) {
    return 1;
  }

  const numbers = files.map((file) => {
    const match = file.match(/^problem(\d+)\.ts$/);
    return match ? parseInt(match[1], 10) : 0;
  });

  return Math.max(...numbers) + 1;
}

/** problemData/problem{N}.ts と同じ形式で SeedProblemData を書き出す */
function writeProblemDataTsFile(
  seedProblems: SeedProblemData[],
  outRelativePath: string,
  meta: { expression: string; wordCountLength: ProblemLength | 'all' | 'nonKids' },
): void {
  const abs = path.resolve(process.cwd(), outRelativePath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });

  const safeExpr = meta.expression.replace(/\*\//g, '').replace(/\n/g, ' ');
  const fileNumMatch = outRelativePath.match(/problem(\d+)\.ts$/);
  const problemDataLabel = fileNumMatch ? fileNumMatch[1] : '?';

  const fileBody = `import { SeedProblemData } from '../src/types/problem';

/**
 * 問題データ ${problemDataLabel}
 * Generated by create-problems2.ts (${seedProblems.length} problems)
 * expression: ${safeExpr}, wordCountLength: ${meta.wordCountLength}
 */
const problemData: SeedProblemData[] = ${JSON.stringify(seedProblems, null, 2)};

export default problemData;
`;

  fs.writeFileSync(abs, fileBody, 'utf8');
  console.error(
    `\n💾 SeedProblemData を ${outRelativePath} に保存しました（${seedProblems.length} 件）`,
  );
}

type ProblemLengthMode = ProblemLength | 'all' | 'nonKids';

const ALL_PROBLEM_LENGTHS: ProblemLength[] = ['kids', 'short', 'medium', 'long'];

/** kids 以外（short / medium / long）をまとめて回す */
const NON_KIDS_PROBLEM_LENGTHS: ProblemLength[] = ['short', 'medium', 'long'];

function tryParseCliArgs(): {
  expression: string;
  wordCountLength: ProblemLength;
  outPath?: string;
} | null {
  const expression = process.argv[2];
  if (expression === undefined || expression.startsWith('-')) {
    return null;
  }
  const rawLength = process.argv[3];
  if (rawLength !== undefined && !(PROBLEM_LENGTHS as readonly string[]).includes(rawLength)) {
    return null;
  }
  const wordCountLength: ProblemLength =
    rawLength !== undefined && (PROBLEM_LENGTHS as readonly string[]).includes(rawLength)
      ? (rawLength as ProblemLength)
      : 'short';
  return {
    expression,
    wordCountLength,
    outPath: process.argv[4],
  };
}

const BATCH_MODES: readonly ProblemLengthMode[] = [
  'all',
  'kids',
  'short',
  'medium',
  'long',
  'nonKids',
];

/**
 * CI / 非対話用: `tsx scripts/create-problems2.ts --batch --mode=short --count=5 [--seed] [--no-remove-words]`
 */
function parseBatchCliArgs(): {
  mode: ProblemLengthMode;
  wordCount: number;
  seed: boolean;
  noRemoveWords: boolean;
} | null {
  const args = process.argv.slice(2);
  if (!args.includes('--batch')) {
    return null;
  }

  let mode: ProblemLengthMode = 'short';
  let wordCount = 5;
  let seed = false;
  let noRemoveWords = false;

  for (const arg of args) {
    if (arg.startsWith('--mode=')) {
      const v = arg.slice('--mode='.length);
      if ((BATCH_MODES as readonly string[]).includes(v)) {
        mode = v as ProblemLengthMode;
      } else {
        console.error(`⚠️ 未対応の --mode=${v}。short を使います`);
      }
    } else if (arg.startsWith('--count=')) {
      const n = parseInt(arg.slice('--count='.length), 10);
      if (!Number.isNaN(n) && n >= 1) {
        wordCount = Math.min(n, words.length);
      }
    } else if (arg === '--seed') {
      seed = true;
    } else if (arg === '--no-remove-words') {
      noRemoveWords = true;
    }
  }

  return { mode, wordCount, seed, noRemoveWords };
}

/**
 * DB の LATEST_USED_WORD から語を取り、モードに従い seed を収集する（対話 / --batch 共通）
 */
async function collectSeedsForWordsFromDbCursor(options: {
  mode: ProblemLengthMode;
  wordCount: number;
}): Promise<{
  allSeeds: SeedProblemData[];
  selectedWords: string[];
  mode: ProblemLengthMode;
} | null> {
  const { mode, wordCount } = options;

  const startAfter = await getLatestUsedWord();
  if (startAfter) {
    console.error(`📍 LATEST_USED_WORD: "${startAfter}"`);
  } else {
    console.error('📍 LATEST_USED_WORD: 未設定（先頭から使用）');
  }
  const startIndex = resolveStartIndex(startAfter);
  if (startIndex > 0) {
    console.error(`📍 開始位置: index ${startIndex}（その語の次から）`);
  }
  const end = Math.min(startIndex + wordCount, words.length);
  const selectedWords = words.slice(startIndex, end);
  if (selectedWords.length === 0) {
    console.error(
      '選択範囲にワードがありません。LATEST_USED_WORD の位置が末尾付近か、語数が0です。',
    );
    return null;
  }
  if (selectedWords.length < wordCount) {
    console.error(
      `⚠️ 要求語数 ${wordCount} に対し、words の終端まで ${selectedWords.length} 語のみ使用します。`,
    );
  }

  const lengths: ProblemLength[] =
    mode === 'all'
      ? [...ALL_PROBLEM_LENGTHS]
      : mode === 'nonKids'
        ? [...NON_KIDS_PROBLEM_LENGTHS]
        : [mode];

  if (mode === 'all') {
    console.log(`\n📌 全タイプモード: ${selectedWords.length}語 × 4タイプ → 順に生成します\n`);
  } else if (mode === 'nonKids') {
    console.log(
      `\n📌 kids以外モード: ${selectedWords.length}語 × 3タイプ（short / medium / long）→ 順に生成します\n`,
    );
  } else {
    const r = WORD_COUNT_RULES[mode];
    console.log(
      `\n📌 ${mode} モード (${r.min}-${r.max}単語): ${selectedWords.length}語分を生成します\n`,
    );
  }

  const problemIndexCounter = { value: 0 };
  const allSeeds: SeedProblemData[] = [];

  for (const expression of selectedWords) {
    for (const len of lengths) {
      console.error(`\n── 「${expression}」 / ${len} ──`);
      const batch = await buildSeedProblemsForExpression(expression, len, problemIndexCounter);
      if (batch.length === 0) {
        console.error(`  ⚠️ スキップ（${expression} / ${len} で有効な seed が得られませんでした）`);
      } else {
        console.error(`  ✅ ${batch.length} 件を追加（累計 ${allSeeds.length + batch.length} 件）`);
      }
      allSeeds.push(...batch);
    }
  }

  if (allSeeds.length === 0) {
    console.error('seed が1件も得られませんでした');
    return null;
  }

  return { allSeeds, selectedWords, mode };
}

/**
 * create-problems.ts の対話に相当（create-problems2 用の6択 + 使用ワード数）
 */
async function promptCreateProblems2Settings(): Promise<{
  mode: ProblemLengthMode;
  wordCount: number;
}> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n語数タイプを選択してください:');
    console.log('  1. 全て   kids + short + medium + long（各ワードを4タイプずつ生成）');
    console.log(`  2. kids   (${WORD_COUNT_RULES.kids.min}-${WORD_COUNT_RULES.kids.max}単語)`);
    console.log(`  3. short  (${WORD_COUNT_RULES.short.min}-${WORD_COUNT_RULES.short.max}単語)`);
    console.log(`  4. medium (${WORD_COUNT_RULES.medium.min}-${WORD_COUNT_RULES.medium.max}単語)`);
    console.log(`  5. long   (${WORD_COUNT_RULES.long.min}-${WORD_COUNT_RULES.long.max}単語)`);
    console.log('  6. kids以外 short + medium + long（各ワードを3タイプずつ生成）');
    console.log('');

    rl.question('選択してください [1/2/3/4/5/6]: ', (typeAnswer) => {
      const trimmed = typeAnswer.trim();
      let mode: ProblemLengthMode;

      if (trimmed === '1' || trimmed.toLowerCase() === 'all') {
        mode = 'all';
      } else if (trimmed === '2' || trimmed.toLowerCase() === 'kids') {
        mode = 'kids';
      } else if (trimmed === '3' || trimmed.toLowerCase() === 'short') {
        mode = 'short';
      } else if (trimmed === '4' || trimmed.toLowerCase() === 'medium') {
        mode = 'medium';
      } else if (trimmed === '5' || trimmed.toLowerCase() === 'long') {
        mode = 'long';
      } else if (
        trimmed === '6' ||
        trimmed.toLowerCase() === 'nonkids' ||
        trimmed.toLowerCase() === 'non_kids' ||
        trimmed === 'kids以外'
      ) {
        mode = 'nonKids';
      } else {
        console.log('無効な選択です。デフォルトで short を使用します。\n');
        mode = 'short';
      }

      const maxWords = words.length;

      rl.question(`\n何ワード使用しますか？ [最大: ${maxWords}]: `, (countAnswer) => {
        rl.close();

        const countTrimmed = countAnswer.trim();
        let wordCount: number;

        if (countTrimmed === '') {
          wordCount = 1;
        } else {
          const parsed = parseInt(countTrimmed, 10);
          if (isNaN(parsed) || parsed < 1) {
            console.log('無効な入力です。1ワードを使用します。\n');
            wordCount = 1;
          } else if (parsed > maxWords) {
            console.log(`指定が多すぎます。最大値 ${maxWords} を使用します。`);
            wordCount = maxWords;
          } else {
            wordCount = parsed;
          }
        }

        resolve({ mode, wordCount });
      });
    });
  });
}

/**
 * SentenceBilingualDraft のリストをAIで採点し、スコア上位 topN 件だけ返す。
 * enrichSentenceRowToSeedProblemData の前に呼ぶことで、重いAPI呼び出しを上位のみに絞る。
 */
async function scoreAndPickTopRows(
  rows: SentenceBilingualDraft[],
  topN: number,
  expression: string,
): Promise<SentenceBilingualDraft[]> {
  if (rows.length <= topN) return rows;

  console.error(`  🤖 ${rows.length}問を採点中（上位${topN}問を採用）...`);

  const scored = await Promise.all(
    rows.map(async (row) => {
      try {
        const { score, reason } = await scoreProblem({
          expression,
          englishSentence: row.englishSentence,
          japaneseSentence: row.japaneseSentence,
          englishReply: row.englishReply,
          japaneseReply: row.japaneseReply,
        });
        return { row, score, reason };
      } catch (e) {
        console.error(`    ⚠️ 採点エラー（スコア0扱い）: ${e instanceof Error ? e.message : e}`);
        return { row, score: 0, reason: '採点エラー' };
      }
    }),
  );

  const sorted = scored.toSorted((a, b) => b.score - a.score);
  const top = sorted.slice(0, topN);
  const dropped = sorted.slice(topN);

  for (const { row, score, reason } of top) {
    console.error(`    ✅ [${score}点] "${row.englishSentence}"　${reason}`);
  }
  if (dropped.length > 0) {
    console.error(`    🗑️ 捨て ${dropped.length}問（${dropped.map((d) => d.score).join(', ')}点）`);
  }

  return top.map((s) => s.row);
}

async function buildSeedProblemsForExpression(
  expression: string,
  wordCountLength: ProblemLength,
  problemIndexCounter: { value: number },
): Promise<SeedProblemData[]> {
  const isKids = wordCountLength === 'kids';
  const senderVoice: ProblemVoice = Math.random() < 0.5 ? 'male' : 'female';
  const conversationHow = pickRandomHow();

  console.error(`  📞 会話形式: ${conversationHow}`);

  const candidates = await createEnglishSentences(
    expression,
    wordCountLength,
    senderVoice,
    conversationHow,
  );
  if (candidates.length === 0) {
    return [];
  }

  const sentenceReplyDrafts = await buildEnglishReplies(candidates, senderVoice);
  if (sentenceReplyDrafts.length === 0) {
    return [];
  }

  const sentenceContextDrafts = await buildSentenceContextDrafts(
    sentenceReplyDrafts,
    expression,
    senderVoice,
    conversationHow,
  );
  const replyBySentence = new Map(
    sentenceReplyDrafts.map((r) => [r.englishSentence.trim(), r.englishReply]),
  );
  const sentenceRowsBase: SentenceRowDraft[] = sentenceContextDrafts.map((ctx) => ({
    ...ctx,
    englishReply: replyBySentence.get(ctx.englishSentence.trim()) ?? '',
  }));
  const sentenceRows = await buildJapaneseDialogues(sentenceRowsBase);

  // 採点して上位 KEEP_TOP_N 件だけ enrichSentenceRowToSeedProblemData に流す
  const scoredRows = await scoreAndPickTopRows(sentenceRows, KEEP_TOP_N, expression);

  const seedProblems: SeedProblemData[] = [];
  for (let i = 0; i < scoredRows.length; i++) {
    problemIndexCounter.value += 1;
    const seed = await enrichSentenceRowToSeedProblemData(
      scoredRows[i],
      expression,
      problemIndexCounter.value,
      isKids,
    );
    if (seed) {
      seedProblems.push(seed);
    }
  }

  return seedProblems;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY が設定されていません。.env を確認してください。');
    process.exitCode = 1;
    return;
  }

  const batchOpts = parseBatchCliArgs();
  if (batchOpts) {
    console.error('🚀 create-problems2（--batch / CI）');
    if (batchOpts.seed && !process.env.DATABASE_URL) {
      console.error('DATABASE_URL が未設定のため --seed できません');
      process.exitCode = 1;
      return;
    }

    const collected = await collectSeedsForWordsFromDbCursor({
      mode: batchOpts.mode,
      wordCount: batchOpts.wordCount,
    });
    if (!collected) {
      process.exitCode = 1;
      return;
    }

    const { allSeeds, selectedWords, mode } = collected;
    const lastConsumedWord = selectedWords[selectedWords.length - 1]!;

    if (batchOpts.seed) {
      await seedToDatabase(allSeeds, lastConsumedWord);
    } else {
      const outRelativePath = `problemData/problem${getNextProblemNumber()}.ts`;
      const labelExpr =
        selectedWords.length <= 3
          ? selectedWords.join(', ')
          : `${selectedWords.slice(0, 3).join(', ')} 他${selectedWords.length - 3}語`;
      writeProblemDataTsFile(allSeeds, outRelativePath, {
        expression: labelExpr,
        wordCountLength: mode === 'all' ? 'all' : mode === 'nonKids' ? 'nonKids' : mode,
      });
      await persistLatestUsedWordIfKnown(lastConsumedWord);
    }

    if (!batchOpts.noRemoveWords) {
      removeConsumedWordsThrough(lastConsumedWord);
    }

    const modeLabel =
      mode === 'all'
        ? 'kids+short+medium+long'
        : mode === 'nonKids'
          ? 'short+medium+long（kids以外）'
          : mode;
    console.error(
      `\n✅ 完了: 合計 ${allSeeds.length} 問（モード: ${modeLabel}、使用ワード数: ${selectedWords.length}）` +
        (batchOpts.seed ? ' → DB に投入' : ''),
    );
    return;
  }

  const cli = tryParseCliArgs();

  if (cli) {
    const outRelativePath = cli.outPath ?? `problemData/problem${getNextProblemNumber()}.ts`;
    const problemIndexCounter = { value: 0 };
    const seedProblems = await buildSeedProblemsForExpression(
      cli.expression,
      cli.wordCountLength,
      problemIndexCounter,
    );

    if (seedProblems.length === 0) {
      console.error('候補の英文が得られなかったか、seed が生成できませんでした');
      process.exitCode = 1;
      return;
    }

    console.log(
      JSON.stringify(
        {
          expression: cli.expression,
          wordCountLength: cli.wordCountLength,
          outPath: outRelativePath,
          seedProblems,
        },
        null,
        2,
      ),
    );

    writeProblemDataTsFile(seedProblems, outRelativePath, {
      expression: cli.expression,
      wordCountLength: cli.wordCountLength,
    });
    await persistLatestUsedWordIfKnown(cli.expression);
    if (words.includes(cli.expression)) {
      removeConsumedWordsThrough(cli.expression);
    }
    return;
  }

  console.log('🚀 create-problems2（対話モード）');
  console.log(`📚 docs/words の語数: ${words.length}個\n`);

  const { mode, wordCount } = await promptCreateProblems2Settings();

  const collected = await collectSeedsForWordsFromDbCursor({ mode, wordCount });
  if (!collected) {
    process.exitCode = 1;
    return;
  }

  const { allSeeds, selectedWords, mode: modeResolved } = collected;

  const outRelativePath = `problemData/problem${getNextProblemNumber()}.ts`;
  const labelExpr =
    selectedWords.length <= 3
      ? selectedWords.join(', ')
      : `${selectedWords.slice(0, 3).join(', ')} 他${selectedWords.length - 3}語`;

  writeProblemDataTsFile(allSeeds, outRelativePath, {
    expression: labelExpr,
    wordCountLength:
      modeResolved === 'all' ? 'all' : modeResolved === 'nonKids' ? 'nonKids' : modeResolved,
  });

  const lastConsumedWord = selectedWords[selectedWords.length - 1]!;
  await persistLatestUsedWordIfKnown(lastConsumedWord);
  removeConsumedWordsThrough(lastConsumedWord);

  const modeLabel =
    modeResolved === 'all'
      ? 'kids+short+medium+long'
      : modeResolved === 'nonKids'
        ? 'short+medium+long（kids以外）'
        : modeResolved;
  console.error(
    `\n✅ 完了: 合計 ${allSeeds.length} 問 → ${outRelativePath}（モード: ${modeLabel}、使用ワード数: ${selectedWords.length}）`,
  );
}

export {
  createEnglishSentences,
  buildSentenceContextDrafts,
  buildEnglishReplies,
  buildJapaneseDialogues,
  buildSeedProblemsForExpression,
  createScenePrompt,
  extendShortOption,
  shortenLongOption,
  adjustIncorrectOptionsLength,
  createIncorrectOptions,
  enrichSentenceRowToSeedProblemData,
  writeProblemDataTsFile,
  getNextProblemNumber,
  promptCreateProblems2Settings,
  main,
};
export type {
  ProblemLength,
  ProblemVoice,
  SentenceContextDraft,
  SentenceReplyDraft,
  SentenceRowDraft,
  SentenceBilingualDraft,
  ProblemLengthMode,
};

const isThisScript = process.argv[1]?.includes('create-problems2');
if (isThisScript) {
  void main()
    .then(() => {
      process.exit(process.exitCode ?? 0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}
