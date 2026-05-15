#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { TEXT_MODEL } from '@/const';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { buildEnglishReplyPrompt, buildJapaneseConversationRules } from '@/lib/problem-generator';
import type { SeedProblemData } from '@/types/problem';
import { buildSceneText } from '@/lib/scene-utils';
import {
  type Voice,
  type How,
  voiceMap,
  toggleVoice,
  buildEnglishSentenceOnlyPrompt,
} from '@/lib/english-sentence-prompt';
import { buildSceneInfoPrompt, type SceneInfo } from '@/lib/scene-info-prompt';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const createEnglishReply = async ({
  sentence,
  senderName,
  receiverName,
  voice,
  _wordCountLength,
}: {
  sentence: SceneInfo;
  senderName: string;
  receiverName: string;
  voice: Voice;
  _wordCountLength: ProblemLength;
}): Promise<string | null> => {
  const prompt =
    buildEnglishReplyPrompt({
      senderName,
      receiverName,
      who: sentence.senderRole,
      whom: sentence.receiverRole,
      senderGender: voiceMap[voice] as '男性' | '女性',
      receiverGender: voiceMap[toggleVoice(voice)] as '男性' | '女性',
      englishSentence: sentence.englishSentence,
      when: sentence.when,
      where: sentence.where,
      receiverPlace: sentence.receiverWhere,
      why: sentence.why,
      how: sentence.how,
    }) +
    `
【重要】英語の台詞のみを出力してください。JSONや説明は不要です。
`;

  // console.log(prompt);

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.7,
    });

    const content = response.output_text?.trim();
    if (!content) throw new Error('レスポンスが空です');

    return content;
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

type JapaneseConversationResult = {
  japaneseSentence: string;
  japaneseReply: string;
};

const createJapaneseConversation = async ({
  sentence,
  senderName,
  receiverName,
  englishReply,
  voice,
  how,
}: {
  sentence: SceneInfo;
  senderName: string;
  receiverName: string;
  englishReply: string;
  voice: Voice;
  how: How;
}): Promise<JapaneseConversationResult | null> => {
  const prompt = `
  【翻訳すべき英文】
  englishSentence: ${sentence.englishSentence}
  englishReply: ${englishReply}
  
  ${buildJapaneseConversationRules({
    senderRole: sentence.senderRole,
    senderName,
    senderGender: voiceMap[voice],
    receiverRole: sentence.receiverRole,
    receiverName,
    receiverGender: voiceMap[toggleVoice(voice)],
    englishSentence: sentence.englishSentence,
    englishReply,
    how,
  })}

【シーン情報】
${buildSceneText({
  senderName,
  receiverName,
  how,
  senderWhen: sentence.when,
  place: sentence.where,
  senderRole: sentence.senderRole,
  senderVoice: voice,
  receiverPlace: sentence.receiverWhere,
  receiverRole: sentence.receiverRole,
  receiverVoice: toggleVoice(voice),
  senderWhy: sentence.why,
  senderWant: sentence.want,
})}

以下のJSON形式で必ず回答してください。

\`\`\`json
{
  "japaneseSentence": "発言の日本語訳",
  "japaneseReply": "返答の日本語訳"
}
\`\`\`
  `;

  // console.log(prompt);

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    const content = response.output_text;
    if (!content) throw new Error('レスポンスが空です');

    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');

    return JSON.parse(jsonMatch[1]) as JapaneseConversationResult;
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

const maleNames = [
  'シンジ',
  'ケン',
  'カイト',
  'リョウ',
  'ユウキ',
  'タカシ',
  'ハルト',
  'ソウタ',
  'コウキ',
  'ダイスケ',
  'ナオキ',
  'ショウ',
  'ヒロキ',
  'ツバサ',
  'レン',
  'Liam',
  'Noah',
  'Ethan',
  'Mason',
  'Lucas',
  'Oliver',
  'James',
  'Benjamin',
  'Henry',
  'Alexander',
  'William',
  'Sebastian',
  'Jack',
  'Owen',
  'Daniel',
];

const femaleNames = [
  'アスカ',
  'サクラ',
  'レイ',
  'アオイ',
  'ユイ',
  'ハナ',
  'ミサト',
  'リナ',
  'ナナ',
  'サツキ',
  'コトネ',
  'アカリ',
  'ノゾミ',
  'ユナ',
  'ユズキ',
  'Emma',
  'Sophia',
  'Chloe',
  'Mia',
  'Zoe',
  'Olivia',
  'Ava',
  'Isabella',
  'Charlotte',
  'Amelia',
  'Harper',
  'Evelyn',
  'Luna',
  'Lily',
  'Grace',
];

const voiceNamesMap: Record<Voice, string[]> = {
  male: maleNames,
  female: femaleNames,
};

const getRandomVoiceName = (voice: Voice): string => {
  return voiceNamesMap[voice][Math.floor(Math.random() * voiceNamesMap[voice].length)];
};

const createEnglishSentence = async ({
  phrase,
  phraseJa,
  voice,
  how,
  rule,
  usedSentences = [],
  additionalInstruction = '',
  senderName,
  receiverName,
}: {
  phrase: string;
  phraseJa: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  usedSentences?: string[];
  additionalInstruction?: string;
  senderName: string;
  receiverName: string;
}): Promise<SceneInfo | null> => {
  try {
    // 1回目: 英文のみ生成
    const sentencePrompt = buildEnglishSentenceOnlyPrompt({
      phrase,
      phraseJa,
      voice,
      how,
      rule,
      usedSentences,
      additionalInstruction,
      senderName,
      receiverName,
    });

    const sentenceResponse = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: sentencePrompt }],
      temperature: 0.7,
    });

    const sentenceRaw = sentenceResponse.output_text?.trim();
    if (!sentenceRaw) throw new Error('英文レスポンスが空です');

    const englishSentence = sentenceRaw.replace(/^```[\w]*\n?|```$/g, '').trim();
    if (!englishSentence) throw new Error('英文が見つかりませんでした');

    console.log(`  英文: ${englishSentence}`);

    // 2回目: シーン情報を生成
    const scenePrompt = buildSceneInfoPrompt({
      senderName,
      receiverName,
      englishSentence,
      voice,
      how,
    });

    const sceneResponse = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: scenePrompt }],
      temperature: 0.7,
    });

    const sceneContent = sceneResponse.output_text;
    if (!sceneContent) throw new Error('シーン情報レスポンスが空です');

    const jsonMatch = sceneContent.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');

    const scene = JSON.parse(jsonMatch[1]) as Omit<SceneInfo, 'englishSentence' | 'how'>;
    return { englishSentence, how, ...scene };
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

// ─── DB ユーティリティ ────────────────────────────────────────────────────────

const prismaClient = new PrismaClient({ log: ['error'] });

async function fetchWordsFromDB(
  isKids: boolean,
): Promise<{ expression: string; expressionJa: string }[]> {
  const rows = await prismaClient.word.findMany({
    where: { isKids },
    orderBy: { createdAt: 'asc' },
    select: { expression: true, expressionJa: true },
  });
  return rows as { expression: string; expressionJa: string }[];
}

async function replenishWordsIfNeeded(
  isKids: boolean,
  currentWords: { expression: string; expressionJa: string }[],
  needed: number,
): Promise<{ expression: string; expressionJa: string }[]> {
  if (currentWords.length >= needed) return currentWords;

  console.error(
    `⚠️ ${isKids ? 'kids' : 'non-kids'} のワードが不足（${currentWords.length}件 < ${needed}件）。AI で補充します...`,
  );

  const { suggestWordsForCategory } = await import('@/lib/word-suggester');

  const [existingExpressions, existingWords, sampleSentences] = await Promise.all([
    prismaClient.problem
      .findMany({ select: { expression: true } })
      .then((rows) => [...new Set(rows.map((r) => r.expression))]),
    prismaClient.word.findMany({
      select: { expression: true, expressionJa: true, isKids: true },
    }) as Promise<{ expression: string; expressionJa: string; isKids: boolean }[]>,
    prismaClient.$queryRaw<{ englishSentence: string }[]>`
      SELECT "englishSentence" FROM problems ORDER BY RANDOM() LIMIT 100
    `.then((rows) => rows.map((r) => r.englishSentence)),
  ]);

  const suggestions = await suggestWordsForCategory(
    isKids,
    existingExpressions,
    existingWords,
    sampleSentences,
  );

  if (suggestions.length === 0) {
    console.error(`⚠️ AI による補充候補が0件でした。現在のワードのみで続行します。`);
    return currentWords;
  }

  await prismaClient.word.createMany({
    data: suggestions.map(({ expression, expressionJa }) => ({ expression, expressionJa, isKids })),
    skipDuplicates: true,
  });
  console.error(`✅ ${suggestions.length}件を DB に追加しました`);

  // 改めてDBから取得し直す
  return fetchWordsFromDB(isKids);
}

async function deleteWordsFromDB(
  words: { expression: string; expressionJa: string }[],
): Promise<void> {
  if (words.length === 0) return;
  const result = await prismaClient.word.deleteMany({
    where: {
      OR: words.map((w) => ({ expression: w.expression, expressionJa: w.expressionJa })),
    },
  });
  console.error(`🧹 使用済み語彙をDBから削除しました（${result.count}件）`);
}

function getNextProblemNumber(): number {
  const problemDir = path.join(process.cwd(), 'problemData');
  if (!fs.existsSync(problemDir)) {
    fs.mkdirSync(problemDir, { recursive: true });
    return 1;
  }
  const files = fs.readdirSync(problemDir).filter((f) => f.match(/^problem(\d+)\.ts$/));
  if (files.length === 0) return 1;
  const numbers = files.map((f) => parseInt(f.match(/^problem(\d+)\.ts$/)![1], 10));
  return Math.max(...numbers) + 1;
}

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
 * Generated by create-problems3.ts (${seedProblems.length} problems)
 * expression: ${safeExpr}, wordCountLength: ${meta.wordCountLength}
 */
const problemData: SeedProblemData[] = ${JSON.stringify(seedProblems, null, 2)};

export default problemData;
`;
  fs.writeFileSync(abs, fileBody, 'utf8');
  console.log(`\n💾 ${outRelativePath} に保存しました（${seedProblems.length} 件）`);
}

// ─── 誤答選択肢生成 ──────────────────────────────────────────────────────────

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

async function createIncorrectOptions(japaneseSentence: string): Promise<string[] | null> {
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
  - 正解と関連性がある話題だが、明らかに違う内容。
    - 例: 正解が「いつも夕飯は自分で作るの？」だとしたら「朝食はほとんど食べないの？」など
  - 文字数: 正解（${japaneseSentence.length}文字）と同じ

3つ目: **明らかな間違い**
  - かなり無関係な内容
  - 文字数: 正解（${japaneseSentence.length}文字）と同じ

【重要ルール】
- 文字数が全然足りないのは禁止。少し冗長な言い回しにしてでも（${japaneseSentence.length}文字）と同じ文字数にすること。
- 正解の日本語文が疑問文の場合、3つとも全て疑問文を生成すること
- 正解の文と似たような意味に取れる文は作らないこと。（それではクイズにならないため）
- 3つとも、バラバラの単語から始まる文であること。ただし頭に「まずは」「実は」「ちなみに」「ところで」などを加えて誤魔化すのは禁止。自然に別の単語から始まる文を作ること。
  - 冒頭の「サラ、」「マイク、」「シンジ、」などの呼びかけ部分は正解と同じにしてOK。
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
    const content = response.output_text;
    if (!content) throw new Error('レスポンスが空です');
    const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
    if (!jsonMatch?.[1]) throw new Error('JSON形式のレスポンスが見つかりませんでした');
    const result = JSON.parse(jsonMatch[1]) as string[];
    if (!Array.isArray(result) || result.length !== 3) throw new Error('誤答選択肢は3つ必要です');
    if (!result.every((opt) => typeof opt === 'string' && opt.trim().length > 0)) {
      throw new Error('誤答選択肢の各要素は空でない文字列である必要があります');
    }
    return result;
  } catch (e) {
    console.error('createIncorrectOptions エラー:', e);
    return null;
  }
}

// ─── 誤答の長さ調整 ──────────────────────────────────────────────────────────

async function extendShortOption(originalText: string, targetLength: number): Promise<string> {
  const additionalChars = targetLength - originalText.length;
  if (additionalChars <= 0) return originalText;
  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [
        {
          role: 'user',
          content: `${originalText}\n\n上記の文章を冗長な言い回しに変えることで、確実に${additionalChars}文字だけ長い文章にしてください。そしてその文章だけを返してください。`,
        },
      ],
      temperature: 0.7,
    });
    const result = response.output_text?.trim() ?? originalText;
    if (result.length > originalText.length) {
      console.log(`  ✅ 選択肢を伸ばしました（${originalText.length}文字 → ${result.length}文字）`);
      return result;
    }
    return originalText;
  } catch {
    return originalText;
  }
}

async function shortenLongOption(originalText: string, targetLength: number): Promise<string> {
  const charsToRemove = originalText.length - targetLength;
  if (charsToRemove <= 0) return originalText;
  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [
        {
          role: 'user',
          content: `${originalText}\n\n上記の文章から「早く」「大声で」「ちゃんと」など、副詞的なワードを1つ削ることで、${targetLength - 1}文字の文章にしてください。必要であれば2ワード以上削ってもいいです。最後は「。」または「？」で終わること。そしてその文章だけを返してください。`,
        },
      ],
      temperature: 0.7,
    });
    const result = response.output_text?.trim() ?? originalText;
    if (result.length < originalText.length) {
      console.log(`  ✅ 選択肢を縮めました（${originalText.length}文字 → ${result.length}文字）`);
      return result;
    }
    return originalText;
  } catch {
    return originalText;
  }
}

async function adjustIncorrectOptionsLength(
  incorrectOptions: string[],
  japaneseSentence: string,
): Promise<string[]> {
  const baseLen = japaneseSentence.length;
  const allShorter = incorrectOptions.every((opt) => opt.length < baseLen);
  const allLonger = incorrectOptions.every((opt) => opt.length > baseLen);

  if (!allShorter && !allLonger) return incorrectOptions;

  const opts = [...incorrectOptions];
  if (allShorter) {
    console.log(`  ⚠️ incorrectOptionsが全て短いため調整します（基準: ${baseLen}文字）`);
    opts.sort((a, b) => a.length - b.length);
    const shortest = opts.shift()!;
    const extended = await extendShortOption(shortest, baseLen + 3);
    return [...opts, extended];
  }

  // allLonger
  console.log(`  ⚠️ incorrectOptionsが全て長いため調整します（基準: ${baseLen}文字）`);
  opts.sort((a, b) => b.length - a.length);
  const longest = opts.shift()!;
  const shortened = await shortenLongOption(longest, Math.max(baseLen - 3, 5));
  return [...opts, shortened];
}

// ─── 1問分をまとめて SeedProblemData に変換 ──────────────────────────────────

async function enrichToSeedProblemData({
  sentence,
  englishReply,
  japaneseSentence,
  japaneseReply,
  voice,
  senderName,
  receiverName,
  expression,
  expressionJa,
  how,
  wordCountLength,
}: {
  sentence: SceneInfo;
  englishReply: string;
  japaneseSentence: string;
  japaneseReply: string;
  voice: Voice;
  senderName: string;
  receiverName: string;
  expression: string;
  expressionJa: string;
  how: How;
  wordCountLength: ProblemLength;
}): Promise<SeedProblemData | null> {
  const senderRole = sentence.senderRole;
  const receiverRole = sentence.receiverRole;
  const senderVoice = voice;
  const receiverVoice = toggleVoice(voice);

  const incorrectOptions = await createIncorrectOptions(japaneseSentence);
  if (!incorrectOptions) return null;

  const adjustedOptions = await adjustIncorrectOptionsLength(incorrectOptions, japaneseSentence);

  return {
    place: sentence.where,
    senderRole,
    senderVoice,
    senderName,
    receiverRole,
    receiverVoice,
    receiverName,
    englishSentence: sentence.englishSentence,
    japaneseSentence,
    englishReply,
    japaneseReply,
    how,
    senderWhen: sentence.when,
    receiverPlace: sentence.receiverWhere,
    senderWhy: sentence.why,
    senderWant: sentence.want,
    incorrectOptions: adjustedOptions,
    difficultyLevel: wordCountLength === 'kids' ? 1 : null,
    expression,
    expressionJa,
  };
}

const NON_KIDS_PROBLEM_LENGTHS: ProblemLength[] = ['short', 'medium', 'long'];

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function generateForPhrase(
  phrase: string,
  phraseJa: string,
  wordCountLength: ProblemLength,
  voice: Voice,
  how: How,
  usedSentences: string[] = [],
): Promise<SeedProblemData | null> {
  const senderName = getRandomVoiceName(voice);
  const receiverName = getRandomVoiceName(toggleVoice(voice));

  const sentence = await createEnglishSentence({
    phrase,
    phraseJa,
    voice,
    how,
    rule: WORD_COUNT_RULES[wordCountLength],
    usedSentences,
    senderName,
    receiverName,
  });
  if (!sentence) {
    console.log('  ⚠️ スキップ（英文生成失敗）');
    return null;
  }

  const englishReply = await createEnglishReply({
    sentence,
    voice,
    _wordCountLength: wordCountLength,
    senderName,
    receiverName,
  });
  if (!englishReply) {
    console.log('  ⚠️ スキップ（返答生成失敗）');
    return null;
  }

  const conversation = await createJapaneseConversation({
    sentence,
    senderName,
    receiverName,
    englishReply,
    voice,
    how,
  });
  if (!conversation) {
    console.log('  ⚠️ スキップ（和訳生成失敗）');
    return null;
  }

  const seed = await enrichToSeedProblemData({
    sentence,
    englishReply,
    japaneseSentence: conversation.japaneseSentence,
    japaneseReply: conversation.japaneseReply,
    voice,
    senderName,
    receiverName,
    expression: phrase,
    expressionJa: phraseJa,
    how,
    wordCountLength,
  });
  if (!seed) {
    console.log('  ⚠️ スキップ（seed生成失敗）');
    return null;
  }

  console.log(`  ✅ "${sentence.englishSentence}"`);
  return seed;
}

const main = async () => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log('🚀 create-problems3（対話モード）');

  // --- 語数タイプ選択 ---
  console.log('\n語数タイプを選択してください:');
  console.log('  1. 全て   kids + short + medium + long（各ワードを4タイプずつ生成）');
  console.log(`  2. kids   (${WORD_COUNT_RULES.kids.min}-${WORD_COUNT_RULES.kids.max}単語)`);
  console.log(`  3. short  (${WORD_COUNT_RULES.short.min}-${WORD_COUNT_RULES.short.max}単語)`);
  console.log(`  4. medium (${WORD_COUNT_RULES.medium.min}-${WORD_COUNT_RULES.medium.max}単語)`);
  console.log(`  5. long   (${WORD_COUNT_RULES.long.min}-${WORD_COUNT_RULES.long.max}単語)`);
  console.log('  6. kids以外 short + medium + long（各ワードを3タイプずつ生成）');
  console.log('');

  const typeAnswer = await ask(rl, '選択してください [1/2/3/4/5/6]: ');
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

  // --- モードに応じてワードリストを決定 ---
  const isKidsOnly = mode === 'kids';
  const isAll = mode === 'all';

  // --- DBからワードを取得 ---
  type WordEntry = { expression: string; expressionJa: string };
  const [allNonKidsWords, allKidsWords] = await Promise.all([
    isKidsOnly ? Promise.resolve([] as WordEntry[]) : fetchWordsFromDB(false),
    isAll
      ? fetchWordsFromDB(true)
      : isKidsOnly
        ? fetchWordsFromDB(true)
        : Promise.resolve([] as WordEntry[]),
  ]);
  const activeWordList = isKidsOnly ? allKidsWords : allNonKidsWords;

  // --- 使用ワード数 ---
  const maxWords = isAll
    ? Math.max(allNonKidsWords.length, allKidsWords.length)
    : activeWordList.length;
  const countAnswer = await ask(rl, `\n何ワード使用しますか？ [最大: ${maxWords}]: `);
  rl.close();

  const wordCount = (() => {
    const countTrimmed = countAnswer.trim();
    if (!countTrimmed) return 1;
    const parsed = parseInt(countTrimmed, 10);
    if (isNaN(parsed) || parsed < 1) {
      console.log('無効な入力です。1ワードを使用します。\n');
      return 1;
    }
    if (parsed > maxWords) {
      console.log(`指定が多すぎます。最大値 ${maxWords} を使用します。`);
      return maxWords;
    }
    return parsed;
  })();

  // --- 必要数に満たない場合は AI で自動補充 ---
  const replenishedKidsWords =
    isAll || isKidsOnly
      ? await replenishWordsIfNeeded(true, allKidsWords, wordCount)
      : allKidsWords;
  const replenishedNonKidsWords = !isKidsOnly
    ? await replenishWordsIfNeeded(false, allNonKidsWords, wordCount)
    : allNonKidsWords;

  // --- 先頭N件を選択 ---
  const selectedKidsWords = isAll || isKidsOnly ? replenishedKidsWords.slice(0, wordCount) : [];
  const selectedWords = isKidsOnly ? [] : replenishedNonKidsWords.slice(0, wordCount);

  if (isAll && selectedWords.length === 0 && selectedKidsWords.length === 0) {
    console.error(`選択範囲にワードがありません。`);
    return;
  }
  if (!isAll && isKidsOnly && selectedKidsWords.length === 0) {
    console.error(`選択範囲にワードがありません。`);
    return;
  }
  if (!isAll && !isKidsOnly && selectedWords.length === 0) {
    console.error(`選択範囲にワードがありません。`);
    return;
  }

  if (mode === 'all') {
    console.log(
      `\n📌 全タイプモード: kids ${selectedKidsWords.length}語 + non-kids ${selectedWords.length}語（short/medium/long）× 3問 → 順に生成します\n`,
    );
  } else if (mode === 'nonKids') {
    console.log(
      `\n📌 kids以外モード: ${selectedWords.length}語 × 3タイプ（short / medium / long）× 3問 → 順に生成します\n`,
    );
  } else {
    const r = WORD_COUNT_RULES[mode];
    console.log(
      `\n📌 ${mode} モード (${r.min}-${r.max}単語): ${isKidsOnly ? selectedKidsWords.length : selectedWords.length}語分を生成します\n`,
    );
  }

  const seedProblems: SeedProblemData[] = [];
  const PROBLEMS_PER_PHRASE = 3;

  if (isAll) {
    // kids は kids_words から（casual 固定）
    for (const word of selectedKidsWords) {
      const usedSentences: string[] = [];
      for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
        const voice: Voice = (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
        const how: How = hows[Math.floor(Math.random() * 2)];
        console.log(
          `\n── 「${word.expression}（${word.expressionJa}）」 / kids (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`,
        );
        const seed = await generateForPhrase(
          word.expression,
          word.expressionJa,
          'kids',
          voice,
          how,
          usedSentences,
        );
        if (seed) {
          usedSentences.push(seed.englishSentence);
          seedProblems.push(seed);
        }
      }
    }
    // short / medium / long は words から（phrase ごとに1回分類）
    for (const word of selectedWords) {
      console.log(`\n📂 「${word.expression}（${word.expressionJa}）」`);
      for (const len of NON_KIDS_PROBLEM_LENGTHS) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice: Voice = (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
          const how: How = hows[Math.floor(Math.random() * 2)];
          console.log(
            `\n── 「${word.expression}（${word.expressionJa}）」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`,
          );
          const seed = await generateForPhrase(
            word.expression,
            word.expressionJa,
            len,
            voice,
            how,
            usedSentences,
          );
          if (seed) {
            usedSentences.push(seed.englishSentence);
            seedProblems.push(seed);
          }
        }
      }
    }
  } else {
    const lengths: ProblemLength[] =
      mode === 'nonKids' ? [...NON_KIDS_PROBLEM_LENGTHS] : [mode as ProblemLength];
    const isKidsMode = mode === 'kids';
    for (const word of isKidsMode ? selectedKidsWords : selectedWords) {
      if (!isKidsMode) console.log(`\n📂 「${word.expression}（${word.expressionJa}）」`);
      for (const len of lengths) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice: Voice = (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
          const how: How = hows[Math.floor(Math.random() * 2)];
          console.log(
            `\n── 「${word.expression}（${word.expressionJa}）」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`,
          );
          const seed = await generateForPhrase(
            word.expression,
            word.expressionJa,
            len,
            voice,
            how,
            usedSentences,
          );
          if (seed) {
            usedSentences.push(seed.englishSentence);
            seedProblems.push(seed);
          }
        }
      }
    }
  }

  if (seedProblems.length === 0) {
    console.log('\n⚠️ 有効な問題が1件も生成できませんでした');
    return;
  }

  const outRelativePath = `problemData/problem${getNextProblemNumber()}.ts`;
  const allUsedWords = isAll ? [...selectedKidsWords, ...selectedWords] : selectedWords;
  const labelExpr =
    allUsedWords.length <= 3
      ? allUsedWords.map((w) => `${w.expression}（${w.expressionJa}）`).join(', ')
      : `${allUsedWords
          .slice(0, 3)
          .map((w) => w.expression)
          .join(', ')} 他${allUsedWords.length - 3}語`;
  const wordCountLength: ProblemLength | 'all' | 'nonKids' =
    mode === 'all' ? 'all' : mode === 'nonKids' ? 'nonKids' : mode;
  writeProblemDataTsFile(seedProblems, outRelativePath, { expression: labelExpr, wordCountLength });

  if (isAll) {
    if (selectedKidsWords.length > 0) await deleteWordsFromDB(selectedKidsWords);
    if (selectedWords.length > 0) await deleteWordsFromDB(selectedWords);
  } else if (isKidsOnly) {
    await deleteWordsFromDB(selectedKidsWords);
  } else {
    await deleteWordsFromDB(selectedWords);
  }

  const modeLabel =
    mode === 'all'
      ? 'kids+short+medium+long'
      : mode === 'nonKids'
        ? 'short+medium+long（kids以外）'
        : mode;
  console.error(
    `\n✅ 完了: 合計 ${seedProblems.length} 問 → ${outRelativePath}（モード: ${modeLabel}、使用ワード数: ${allUsedWords.length}）`,
  );
};

// ─── --batch / CI 用 ──────────────────────────────────────────────────────────

type ProblemLengthMode = ProblemLength | 'all' | 'nonKids';
const BATCH_MODES = ['kids', 'short', 'medium', 'long', 'all', 'nonKids'] as const;

async function seedToDatabase(seedProblems: SeedProblemData[]): Promise<void> {
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
        audioEnUrl: null,
        audioJaUrl: null,
        audioEnReplyUrl: null,
        imageUrl: null,
      };
    });
    const result = await (acceleratedPrisma as PrismaClient).problem.createMany({
      data: createData,
      skipDuplicates: true,
    });
    console.error(
      `✅ DB投入完了: ${result.count}件挿入 (重複スキップ: ${createData.length - result.count}件)`,
    );
  } finally {
    await rawPrisma.$disconnect();
  }
}

function parseBatchCliArgs(): {
  mode: ProblemLengthMode;
  wordCount: number;
  seed: boolean;
  noRemoveWords: boolean;
} | null {
  const args = process.argv.slice(2);
  if (!args.includes('--batch')) return null;

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
      if (!Number.isNaN(n) && n >= 1) wordCount = n;
    } else if (arg === '--seed') {
      seed = true;
    } else if (arg === '--no-remove-words') {
      noRemoveWords = true;
    }
  }
  return { mode, wordCount, seed, noRemoveWords };
}

const hows = ['対面', '対面', '対面', '対面', '対面', '電話'] as const satisfies How[];

async function runBatch(opts: ReturnType<typeof parseBatchCliArgs> & {}): Promise<void> {
  console.error('🚀 create-problems3（--batch / CI）');
  if (opts.seed && !process.env.DATABASE_URL) {
    console.error('DATABASE_URL が未設定のため --seed できません');
    process.exitCode = 1;
    return;
  }

  // --- モードに応じてワードリストを決定 ---
  const isKidsOnly = opts.mode === 'kids';
  const isAll = opts.mode === 'all';

  // --- DBからワードを取得 ---
  type WordEntry = { expression: string; expressionJa: string };
  const [allNonKidsWords, allKidsWordsForBatch] = await Promise.all([
    isKidsOnly ? Promise.resolve([] as WordEntry[]) : fetchWordsFromDB(false),
    isAll || isKidsOnly ? fetchWordsFromDB(true) : Promise.resolve([] as WordEntry[]),
  ]);

  // --- 必要数に満たない場合は AI で自動補充 ---
  const replenishedKidsWords =
    isAll || isKidsOnly
      ? await replenishWordsIfNeeded(true, allKidsWordsForBatch, opts.wordCount)
      : allKidsWordsForBatch;
  const replenishedNonKidsWords = !isKidsOnly
    ? await replenishWordsIfNeeded(false, allNonKidsWords, opts.wordCount)
    : allNonKidsWords;

  // --- 先頭N件を選択 ---
  const selectedKidsWords =
    isAll || isKidsOnly ? replenishedKidsWords.slice(0, opts.wordCount) : [];
  const selectedWords = isKidsOnly ? [] : replenishedNonKidsWords.slice(0, opts.wordCount);

  if (isAll && selectedWords.length === 0 && selectedKidsWords.length === 0) {
    console.error('選択範囲にワードがありません。');
    process.exitCode = 1;
    return;
  }
  if (!isAll && isKidsOnly && selectedKidsWords.length === 0) {
    console.error('選択範囲にワードがありません。');
    process.exitCode = 1;
    return;
  }
  if (!isAll && !isKidsOnly && selectedWords.length === 0) {
    console.error('選択範囲にワードがありません。');
    process.exitCode = 1;
    return;
  }

  const seedProblems: SeedProblemData[] = [];
  const PROBLEMS_PER_PHRASE = 3;
  const voices = ['male', 'female'] as const satisfies Voice[];

  if (isAll) {
    // kids は kids_words から（casual 固定）
    for (const word of selectedKidsWords) {
      const usedSentences: string[] = [];
      for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
        const voice = voices[Math.floor(Math.random() * voices.length)];
        const how = hows[Math.floor(Math.random() * hows.length)];
        console.error(
          `\n── 「${word.expression}（${word.expressionJa}）」 / kids (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`,
        );
        const seed = await generateForPhrase(
          word.expression,
          word.expressionJa,
          'kids',
          voice,
          how,
          usedSentences,
        );
        if (seed) {
          usedSentences.push(seed.englishSentence);
          seedProblems.push(seed);
        }
      }
    }
    // short / medium / long は words から（phrase ごとに1回分類）
    for (const word of selectedWords) {
      console.error(`\n📂 「${word.expression}（${word.expressionJa}）」`);
      for (const len of NON_KIDS_PROBLEM_LENGTHS) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice = voices[Math.floor(Math.random() * voices.length)];
          const how = hows[Math.floor(Math.random() * hows.length)];
          console.error(
            `\n── 「${word.expression}（${word.expressionJa}）」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`,
          );
          const seed = await generateForPhrase(
            word.expression,
            word.expressionJa,
            len,
            voice,
            how,
            usedSentences,
          );
          if (seed) {
            usedSentences.push(seed.englishSentence);
            seedProblems.push(seed);
          }
        }
      }
    }
  } else {
    const lengths: ProblemLength[] =
      opts.mode === 'nonKids' ? NON_KIDS_PROBLEM_LENGTHS : [opts.mode as ProblemLength];
    const isKidsMode = opts.mode === 'kids';
    for (const word of isKidsMode ? selectedKidsWords : selectedWords) {
      if (!isKidsMode) console.error(`\n📂 「${word.expression}（${word.expressionJa}）」`);
      for (const len of lengths) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice = voices[Math.floor(Math.random() * voices.length)];
          const how = hows[Math.floor(Math.random() * hows.length)];
          console.error(
            `\n── 「${word.expression}（${word.expressionJa}）」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`,
          );
          const seed = await generateForPhrase(
            word.expression,
            word.expressionJa,
            len,
            voice,
            how,
            usedSentences,
          );
          if (seed) {
            usedSentences.push(seed.englishSentence);
            seedProblems.push(seed);
          }
        }
      }
    }
  }

  if (seedProblems.length === 0) {
    console.error('\n⚠️ 有効な問題が1件も生成できませんでした');
    process.exitCode = 1;
    return;
  }

  const allUsedWords = isAll ? [...selectedKidsWords, ...selectedWords] : selectedWords;

  if (opts.seed) {
    if (isAll) {
      if (selectedKidsWords.length > 0) {
        await seedToDatabase(seedProblems.filter((p) => p.difficultyLevel === 1));
        if (!opts.noRemoveWords) await deleteWordsFromDB(selectedKidsWords);
      }
      if (selectedWords.length > 0) {
        await seedToDatabase(seedProblems.filter((p) => p.difficultyLevel !== 1));
        if (!opts.noRemoveWords) await deleteWordsFromDB(selectedWords);
      }
    } else {
      await seedToDatabase(seedProblems);
      if (!opts.noRemoveWords)
        await deleteWordsFromDB(isKidsOnly ? selectedKidsWords : selectedWords);
    }
  } else {
    const outRelativePath = `problemData/problem${getNextProblemNumber()}.ts`;
    const labelExpr =
      allUsedWords.length <= 3
        ? allUsedWords.join(', ')
        : `${allUsedWords.slice(0, 3).join(', ')} 他${allUsedWords.length - 3}語`;
    writeProblemDataTsFile(seedProblems, outRelativePath, {
      expression: labelExpr,
      wordCountLength:
        opts.mode === 'all' ? 'all' : opts.mode === 'nonKids' ? 'nonKids' : opts.mode,
    });
    if (isAll) {
      if (selectedKidsWords.length > 0 && !opts.noRemoveWords)
        await deleteWordsFromDB(selectedKidsWords);
      if (selectedWords.length > 0 && !opts.noRemoveWords) await deleteWordsFromDB(selectedWords);
    } else if (isKidsOnly) {
      if (!opts.noRemoveWords) await deleteWordsFromDB(selectedKidsWords);
    } else {
      if (!opts.noRemoveWords) await deleteWordsFromDB(selectedWords);
    }
  }

  console.error(
    `\n✅ 完了: 合計 ${seedProblems.length} 問（モード: ${opts.mode}、使用ワード数: ${allUsedWords.length}）`,
  );
}

const batchOpts = parseBatchCliArgs();
const entryFn = batchOpts ? runBatch(batchOpts) : main();
entryFn.finally(() => prismaClient.$disconnect());
