#!/usr/bin/env tsx

import fs from 'fs';
import path from 'path';
import * as readline from 'readline';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';
import { words } from '../docs/words';
import { words as kidsWords } from '../docs/kids_words';
import { TEXT_MODEL } from '@/const';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';
import { buildEnglishReplyPrompt } from '@/lib/problem-generator';
import type { SeedProblemData } from '@/types/problem';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Voice = 'male' | 'female';
type How = '対面' | '電話';

const voiceMap: Record<Voice, string> = {
  male: '男性',
  female: '女性',
};

const toggleVoice = (voice: Voice) => {
  return voice === 'male' ? 'female' : 'male';
};

const howNoteMap: Record<How, string> = {
  対面: '',
  電話: '電話なので、お互いに相手のことは見えません。',
};

const createEnglishSentencePrompt = ({
  phrase,
  voice,
  how,
  rule,
  usedSentences,
}: {
  phrase: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  usedSentences: string[];
}): string => {
  const usedBlock =
    usedSentences.length > 0
      ? `\n以下の英文はすでに使用済みです。これらと被らない英文の台詞を作成してください。\n${usedSentences.map((s) => `- ${s}`).join('\n')}\n`
      : '';
  return `
${usedBlock}
「${phrase}」というフレーズを使って、ある${voiceMap[voice]}がある${voiceMap[toggleVoice(voice)]}に${how}で話しかけるとしたら、どんな英文があり得えますか？
※S・V・O などは、それぞれ実際の Subject（主語）・Verb（動詞）・Object（目的語）などに置き換えてください。
ネイティブが実際に会話で使うような、ごく自然な英文の台詞を作成してください。
${phrase.includes(' ') ? '指定されたフレーズが慣用句の場合は、文字通りの意味で使わず慣用句として使うべし。' : ''}
${howNoteMap[how]}
英文法は正確に、文法の間違いがないようにしてください。
${rule.min}語以上${rule.max}語以下の英文を作成してください。
${'note' in rule ? rule.note : ''}
いつ、どこで、誰が、誰に対して、何がきっかけで、どうなりたくてその台詞で話しかけるのかも書いてください。
この情報を元にAIが画像を作成できるほど具体的に書いてください。
why や want なしで englishSentence だけを読んでもある程度の状況が分かるように具体的な台詞にしてください。

以下のJSON形式で必ず回答してください。

\`\`\`json
${JSON.stringify(englishSentenceResultDifinition, null, 2)}
\`\`\`

## 例
以下の例を参考にしてください。

${Object.entries(englishSentenceResultSamples)
  .map(
    ([key, sample]) =>
      `フレーズが「${key}」の場合:\n\`\`\`json\n${JSON.stringify(sample, null, 2)}\n\`\`\``,
  )
  .join('\n\n')}
  `;
};

type EnglishSentenceResult = {
  englishSentence: string;
  how: How;
  when: string;
  where: string;
  receiverWhere: string;
  who: string;
  whom: string;
  why: string;
  want: string;
};

const englishSentenceResultDifinition: Omit<EnglishSentenceResult, 'how'> & { how: string } = {
  englishSentence: 'ここに英文が入る',
  how: '対面または電話',
  when: 'いつ',
  where: '話しかける人がいる場所',
  receiverWhere: '話しかける相手がいる場所',
  who: '話しかける人の役割',
  whom: '話しかける相手の役割',
  why: '話しかけようと思ったきっかけ',
  want: 'それを話すことでどうなりたいか',
};

const englishSentenceResultSamples: Record<string, EnglishSentenceResult> = {
  'pass me the O': {
    englishSentence: 'Could you please pass me the salt?',
    how: '対面',
    when: '夕食前の調理中',
    where: 'キッチン',
    receiverWhere: 'キッチン',
    who: '夫',
    whom: '妻',
    why: '料理を作りたいが、塩が手元にない',
    want: '妻が塩を手元に持ってくれる',
  },
  'was I supposed to': {
    englishSentence: 'Which floor was I supposed to go to again?',
    how: '対面',
    when: 'エスカレーターで移動中',
    where: 'ショッピングモールのエスカレーター',
    receiverWhere: 'ショッピングモールのエスカレーター',
    who: '友人',
    whom: '友人',
    why: '目的の店が何階にあるのかを忘れてしまった',
    want: '相手が目的の店のフロアを教えてくれる',
  },
  'followed through': {
    englishSentence: 'I heard Emma followed through on that difficult project.',
    how: '対面',
    when: '同僚と雑談している時',
    where: 'オフィスの休憩スペース',
    receiverWhere: 'オフィスの休憩スペース',
    who: '同僚',
    whom: '同僚',
    why: 'エマの活躍を知って感心し、誰かに共有したくなった',
    want: '相手にも、エマの実績に感心してほしい',
  },
  'move forward': {
    englishSentence:
      "Hi, I'm calling because we'd like to formally move forward with a contract with your company.",
    how: '電話',
    when: 'IT会社の業務中',
    where: '自分のデスク',
    receiverWhere: 'パートナー企業のデスク',
    who: 'システムエンジニア',
    whom: 'パートナー企業の担当者',
    why: 'パートナー企業の提案内容を見て、正式に契約を結びたいと思った',
    want: '相手と正式な契約を締結する',
  },
};

const createEnglishReply = async ({
  sentence,
  voice,
  wordCountLength,
}: {
  sentence: EnglishSentenceResult;
  voice: Voice;
  wordCountLength: ProblemLength;
}): Promise<string | null> => {
  const prompt =
    buildEnglishReplyPrompt({
      who: sentence.who,
      whom: sentence.whom,
      senderGender: voiceMap[voice] as '男性' | '女性',
      receiverGender: voiceMap[toggleVoice(voice)] as '男性' | '女性',
      englishSentence: sentence.englishSentence,
      when: sentence.when,
      where: sentence.where,
      why: sentence.why,
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
  englishReply,
  voice,
  how,
}: {
  sentence: EnglishSentenceResult;
  englishReply: string;
  voice: Voice;
  how: How;
}): Promise<JapaneseConversationResult | null> => {
  const prompt = `
  【翻訳すべき英文】
  englishSentence: ${sentence.englishSentence}
  englishReply: ${englishReply}
  
  ${sentence.who}（${voiceMap[voice]}）が${how}で「${sentence.englishSentence}」と話しかけ、
  ${sentence.whom}（${voiceMap[toggleVoice(voice)]}）が「${englishReply}」と返答しました。
  この会話を自然な日本語のセリフに翻訳してください。
  二人の関係性を考慮して、自然な口調のセリフに翻訳してください。
  慣用句は単語通りに直訳せず、慣用句として翻訳してください。
  英語に含まれる内容はできるだけ省略せずに日本語に翻訳してください。
  相手のことを「○○さん」「XXXさん」などと伏せ字で翻訳せず「あなた」「君」もしくは「部長」などの呼び方を使ってください。
  女性のセリフを「〜だわ」「〜なのよ」と翻訳するのは古臭いので禁止です。

【シーン】
- いつ: ${sentence.when}
- どこで: ${sentence.where}

【参考情報】
${sentence.whom}（${voiceMap[toggleVoice(voice)]}）は知らないかもしれない情報です。
- ${sentence.who}（${voiceMap[voice]}）が話しかけようと思ったきっかけ: ${sentence.why}
- ${sentence.who}（${voiceMap[voice]}）が話しかけた目的: ${sentence.want}

※あくまで参考情報です。英文に含まれていない内容は日本語訳に含めないでください。英文に含まれている内容のみを日本語に訳してください。

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

const createEnglishSentence = async ({
  phrase,
  voice,
  how,
  rule,
  usedSentences = [],
}: {
  phrase: string;
  voice: Voice;
  how: How;
  rule: (typeof WORD_COUNT_RULES)[keyof typeof WORD_COUNT_RULES];
  usedSentences?: string[];
}): Promise<EnglishSentenceResult | null> => {
  const prompt = createEnglishSentencePrompt({ phrase, voice, how, rule, usedSentences });

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

    const parsed = JSON.parse(jsonMatch[1]) as EnglishSentenceResult;
    return { ...parsed, how };
  } catch (e) {
    console.error('エラー:', e);
    return null;
  }
};

// ─── ファイル保存ユーティリティ ───────────────────────────────────────────────

function resolveStartIndex(startAfter: string | null, wordList: string[]): number {
  if (!startAfter) return 0;
  const idx = wordList.indexOf(startAfter);
  if (idx === -1) {
    console.error(
      `⚠️ LATEST_USED_WORD "${startAfter}" が words に見つかりません。先頭から使用します。`,
    );
    return 0;
  }
  return idx + 1;
}

async function getLatestUsedWord(key: string): Promise<string | null> {
  if (!process.env.DATABASE_URL) return null;
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    const config = await prisma.appConfig.findUnique({ where: { key } });
    return config?.value ?? null;
  } catch (e) {
    console.error(`⚠️ ${key} の取得に失敗しました:`, e instanceof Error ? e.message : e);
    return null;
  } finally {
    await prisma.$disconnect();
  }
}

async function updateLatestUsedWord(key: string, word: string): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(`⚠️ DATABASE_URL が未設定のため ${key} を更新できません`);
    return;
  }
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    await prisma.appConfig.upsert({
      where: { key },
      update: { value: word },
      create: { key, value: word },
    });
    console.error(`🔖 ${key} を "${word}" に更新しました`);
  } finally {
    await prisma.$disconnect();
  }
}

async function persistLatestUsedWordIfKnown(
  key: string,
  word: string,
  wordList: string[],
): Promise<void> {
  if (!wordList.includes(word)) {
    console.error(`⚠️ ${key} を更新しません（語彙ファイルに含まれないため: "${word}"）`);
    return;
  }
  try {
    await updateLatestUsedWord(key, word);
  } catch (e) {
    console.error(`⚠️ ${key} の更新に失敗しました:`, e instanceof Error ? e.message : e);
  }
}

function removeUsedWordsFromWordList(
  wordsToRemove: readonly string[],
  wordsFilePath: string,
): void {
  if (wordsToRemove.length === 0) return;
  const wordsPath = path.join(process.cwd(), wordsFilePath);
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
    if (!match) return true;
    const wordValue = match[2];
    if (remainingWords.has(wordValue)) {
      remainingWords.delete(wordValue);
      return false;
    }
    return true;
  });
  if (remainingWords.size > 0) {
    console.error(
      `⚠️ 次の語彙は${wordsFilePath}で見つからず削除できませんでした: ${Array.from(remainingWords).join(', ')}`,
    );
  }
  const updatedContent = updatedLines.join('\n');
  if (updatedContent !== originalContent) {
    fs.writeFileSync(wordsPath, updatedContent, 'utf-8');
    console.error(`✅ ${wordsFilePath}から使用済み語彙を削除しました`);
  }
}

function removeConsumedWordsThrough(
  lastWord: string,
  wordList: string[],
  wordsFilePath: string,
): void {
  const lastIdx = wordList.indexOf(lastWord);
  if (lastIdx === -1) {
    console.error(
      `⚠️ "${lastWord}" が words 配列に見つからないため、${wordsFilePath} からの一括削除をスキップします`,
    );
    return;
  }
  console.error(`🧹 使用済み語彙を${wordsFilePath}から削除中...`);
  removeUsedWordsFromWordList(wordList.slice(0, lastIdx + 1), wordsFilePath);
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

// ─── シーンプロンプト生成 ────────────────────────────────────────────────────

function createScenePrompt(data: {
  when: string;
  how: string;
  sender: { role: string; voice: Voice; where: string; why: string; want: string };
  receiver: { role: string; voice: Voice; where: string };
}): string {
  return `${data.how}。
- タイミング: ${data.when}
- ${data.sender.role}（${voiceMap[data.sender.voice]}）がいる場所（1コマ目）: ${data.sender.where}
- ${data.receiver.role}（${voiceMap[data.receiver.voice]}）がいる場所（2コマ目）: ${data.receiver.where}
- ${data.sender.role}（${voiceMap[data.sender.voice]}）が話しかける理由: ${data.sender.why}
- ${data.sender.role}（${voiceMap[data.sender.voice]}）の期待すること: ${data.sender.want}
`;
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
  - 正解と微妙に違う話題。
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
  expression,
  how,
  wordCountLength,
}: {
  sentence: EnglishSentenceResult;
  englishReply: string;
  japaneseSentence: string;
  japaneseReply: string;
  voice: Voice;
  expression: string;
  how: How;
  wordCountLength: ProblemLength;
}): Promise<SeedProblemData | null> {
  const senderRole = sentence.who;
  const receiverRole = sentence.whom;
  const senderVoice = voice;
  const receiverVoice = toggleVoice(voice);

  const scenePrompt = createScenePrompt({
    when: sentence.when,
    how: `${how}での会話`,
    sender: {
      role: senderRole,
      voice: senderVoice,
      where: sentence.where,
      why: sentence.why,
      want: sentence.want,
    },
    receiver: { role: receiverRole, voice: receiverVoice, where: sentence.receiverWhere },
  });
  console.log(scenePrompt);

  const incorrectOptions = await createIncorrectOptions(japaneseSentence);
  if (!incorrectOptions) return null;

  const adjustedOptions = await adjustIncorrectOptionsLength(incorrectOptions, japaneseSentence);

  return {
    place: sentence.where,
    senderRole,
    senderVoice,
    receiverRole,
    receiverVoice,
    englishSentence: sentence.englishSentence,
    japaneseSentence,
    englishReply,
    japaneseReply,
    scenePrompt,
    senderVoiceInstruction: null,
    receiverVoiceInstruction: null,
    incorrectOptions: adjustedOptions,
    difficultyLevel: wordCountLength === 'kids' ? 1 : null,
    expression,
  };
}

const NON_KIDS_PROBLEM_LENGTHS: ProblemLength[] = ['short', 'medium', 'long'];

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => rl.question(question, (ans) => resolve(ans.trim())));
}

async function generateForPhrase(
  phrase: string,
  wordCountLength: ProblemLength,
  voice: Voice,
  how: How,
  usedSentences: string[] = [],
): Promise<SeedProblemData | null> {
  const sentence = await createEnglishSentence({
    phrase,
    voice,
    how,
    rule: WORD_COUNT_RULES[wordCountLength],
    usedSentences,
  });
  if (!sentence) {
    console.log('  ⚠️ スキップ（英文生成失敗）');
    return null;
  }

  const englishReply = await createEnglishReply({ sentence, voice, wordCountLength });
  if (!englishReply) {
    console.log('  ⚠️ スキップ（返答生成失敗）');
    return null;
  }

  const conversation = await createJapaneseConversation({ sentence, englishReply, voice, how });
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
    expression: phrase,
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
  console.log(`📚 docs/words の語数: ${words.length}個\n`);

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

  // --- モードに応じてワードリスト・appConfig キー・ファイルパスを決定 ---
  const isKidsOnly = mode === 'kids';
  const isAll = mode === 'all';
  const activeWordList = isKidsOnly ? kidsWords : words;
  const activeWordsFilePath = isKidsOnly ? 'docs/kids_words.ts' : 'docs/words.ts';
  const latestUsedWordKey = isKidsOnly ? 'LATEST_USED_WORD_KIDS' : 'LATEST_USED_WORD';

  // --- 使用ワード数 ---
  const maxWords = isAll ? Math.max(words.length, kidsWords.length) : activeWordList.length;
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

  // --- allモード: kids_wordsとwordsから独立して選択 ---
  let selectedKidsWords: string[] = [];
  if (isAll) {
    const kidsStartAfter = await getLatestUsedWord('LATEST_USED_WORD_KIDS');
    if (kidsStartAfter) {
      console.error(`📍 LATEST_USED_WORD_KIDS: "${kidsStartAfter}"`);
    } else {
      console.error(`📍 LATEST_USED_WORD_KIDS: 未設定（先頭から使用）`);
    }
    const kidsStartIndex = resolveStartIndex(kidsStartAfter, kidsWords);
    selectedKidsWords = kidsWords.slice(kidsStartIndex, kidsStartIndex + wordCount);
    if (selectedKidsWords.length === 0) {
      console.error(`⚠️ kids_words の選択範囲にワードがありません。kidsタイプはスキップします。`);
    } else if (selectedKidsWords.length < wordCount) {
      console.error(
        `⚠️ 要求語数 ${wordCount} に対し、kids_words の終端まで ${selectedKidsWords.length} 語のみ使用します。`,
      );
    }
  }

  // --- LATEST_USED_WORD から開始位置を決定 ---
  const startAfter = await getLatestUsedWord(latestUsedWordKey);
  if (startAfter) {
    console.error(`📍 ${latestUsedWordKey}: "${startAfter}"`);
  } else {
    console.error(`📍 ${latestUsedWordKey}: 未設定（先頭から使用）`);
  }
  const startIndex = resolveStartIndex(startAfter, activeWordList);
  const selectedWords = activeWordList.slice(startIndex, startIndex + wordCount);

  if (!isAll && selectedWords.length === 0) {
    console.error(
      `選択範囲にワードがありません。${latestUsedWordKey} の位置が末尾付近か、語数が0です。`,
    );
    return;
  }
  if (!isAll && selectedWords.length < wordCount) {
    console.error(
      `⚠️ 要求語数 ${wordCount} に対し、words の終端まで ${selectedWords.length} 語のみ使用します。`,
    );
  }
  if (isAll && selectedWords.length === 0 && selectedKidsWords.length === 0) {
    console.error(`選択範囲にワードがありません。`);
    return;
  }

  if (mode === 'all') {
    console.log(
      `\n📌 全タイプモード: kids_words ${selectedKidsWords.length}語（kids）+ words ${selectedWords.length}語（short/medium/long）× 3問 → 順に生成します\n`,
    );
  } else if (mode === 'nonKids') {
    console.log(
      `\n📌 kids以外モード: ${selectedWords.length}語 × 3タイプ（short / medium / long）× 3問 → 順に生成します\n`,
    );
  } else {
    const r = WORD_COUNT_RULES[mode];
    console.log(
      `\n📌 ${mode} モード (${r.min}-${r.max}単語): ${selectedWords.length}語分を生成します\n`,
    );
  }

  const seedProblems: SeedProblemData[] = [];
  const PROBLEMS_PER_PHRASE = 3;

  if (isAll) {
    // kids は kids_words から
    for (const phrase of selectedKidsWords) {
      const usedSentences: string[] = [];
      for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
        const voice: Voice = (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
        const how: How = (['対面', '電話'] as const)[Math.floor(Math.random() * 2)];
        console.log(`\n── 「${phrase}」 / kids (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`);
        const seed = await generateForPhrase(phrase, 'kids', voice, how, usedSentences);
        if (seed) {
          usedSentences.push(seed.englishSentence);
          seedProblems.push(seed);
        }
      }
    }
    // short / medium / long は words から
    for (const phrase of selectedWords) {
      for (const len of NON_KIDS_PROBLEM_LENGTHS) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice: Voice = (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
          const how: How = (['対面', '電話'] as const)[Math.floor(Math.random() * 2)];
          console.log(`\n── 「${phrase}」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`);
          const seed = await generateForPhrase(phrase, len, voice, how, usedSentences);
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
    for (const phrase of selectedWords) {
      for (const len of lengths) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice: Voice = (['male', 'female'] as const)[Math.floor(Math.random() * 2)];
          const how: How = (['対面', '電話'] as const)[Math.floor(Math.random() * 2)];
          console.log(`\n── 「${phrase}」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`);
          const seed = await generateForPhrase(phrase, len, voice, how, usedSentences);
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
      ? allUsedWords.join(', ')
      : `${allUsedWords.slice(0, 3).join(', ')} 他${allUsedWords.length - 3}語`;
  const wordCountLength: ProblemLength | 'all' | 'nonKids' =
    mode === 'all' ? 'all' : mode === 'nonKids' ? 'nonKids' : mode;
  writeProblemDataTsFile(seedProblems, outRelativePath, { expression: labelExpr, wordCountLength });

  if (isAll) {
    if (selectedKidsWords.length > 0) {
      const lastKidsWord = selectedKidsWords[selectedKidsWords.length - 1]!;
      await persistLatestUsedWordIfKnown('LATEST_USED_WORD_KIDS', lastKidsWord, kidsWords);
      removeConsumedWordsThrough(lastKidsWord, kidsWords, 'docs/kids_words.ts');
    }
    if (selectedWords.length > 0) {
      const lastNonKidsWord = selectedWords[selectedWords.length - 1]!;
      await persistLatestUsedWordIfKnown('LATEST_USED_WORD', lastNonKidsWord, words);
      removeConsumedWordsThrough(lastNonKidsWord, words, 'docs/words.ts');
    }
  } else {
    const lastConsumedWord = selectedWords[selectedWords.length - 1]!;
    await persistLatestUsedWordIfKnown(latestUsedWordKey, lastConsumedWord, activeWordList);
    removeConsumedWordsThrough(lastConsumedWord, activeWordList, activeWordsFilePath);
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

async function seedToDatabase(
  seedProblems: SeedProblemData[],
  lastWord: string,
  latestUsedWordKey: string,
): Promise<void> {
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
    await rawPrisma.appConfig.upsert({
      where: { key: latestUsedWordKey },
      update: { value: lastWord },
      create: { key: latestUsedWordKey, value: lastWord },
    });
    console.error(`🔖 ${latestUsedWordKey} を "${lastWord}" に更新しました`);
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

async function runBatch(opts: ReturnType<typeof parseBatchCliArgs> & {}): Promise<void> {
  console.error('🚀 create-problems3（--batch / CI）');
  if (opts.seed && !process.env.DATABASE_URL) {
    console.error('DATABASE_URL が未設定のため --seed できません');
    process.exitCode = 1;
    return;
  }

  // --- モードに応じてワードリスト・appConfig キー・ファイルパスを決定 ---
  const isKidsOnly = opts.mode === 'kids';
  const isAll = opts.mode === 'all';
  const activeWordList = isKidsOnly ? kidsWords : words;
  const activeWordsFilePath = isKidsOnly ? 'docs/kids_words.ts' : 'docs/words.ts';
  const latestUsedWordKey = isKidsOnly ? 'LATEST_USED_WORD_KIDS' : 'LATEST_USED_WORD';

  // --- allモード: kids_wordsから独立してkids用ワードを選択 ---
  let selectedKidsWords: string[] = [];
  if (isAll) {
    const kidsStartAfter = await getLatestUsedWord('LATEST_USED_WORD_KIDS');
    if (kidsStartAfter) {
      console.error(`📍 LATEST_USED_WORD_KIDS: "${kidsStartAfter}"`);
    } else {
      console.error(`📍 LATEST_USED_WORD_KIDS: 未設定（先頭から使用）`);
    }
    const kidsStartIndex = resolveStartIndex(kidsStartAfter, kidsWords);
    selectedKidsWords = kidsWords.slice(
      kidsStartIndex,
      Math.min(kidsStartIndex + opts.wordCount, kidsWords.length),
    );
    if (selectedKidsWords.length === 0) {
      console.error(`⚠️ kids_words の選択範囲にワードがありません。kidsタイプはスキップします。`);
    }
  }

  const startAfter = await getLatestUsedWord(latestUsedWordKey);
  if (startAfter) {
    console.error(`📍 ${latestUsedWordKey}: "${startAfter}"`);
  } else {
    console.error(`📍 ${latestUsedWordKey}: 未設定（先頭から使用）`);
  }
  const startIndex = resolveStartIndex(startAfter, activeWordList);
  const end = Math.min(startIndex + opts.wordCount, activeWordList.length);
  const selectedWords = activeWordList.slice(startIndex, end);

  if (!isAll && selectedWords.length === 0) {
    console.error('選択範囲にワードがありません。');
    process.exitCode = 1;
    return;
  }
  if (isAll && selectedWords.length === 0 && selectedKidsWords.length === 0) {
    console.error('選択範囲にワードがありません。');
    process.exitCode = 1;
    return;
  }

  const seedProblems: SeedProblemData[] = [];
  const PROBLEMS_PER_PHRASE = 3;
  const voices = ['male', 'female'] as const satisfies Voice[];
  const hows = ['対面', '対面', '対面', '対面', '電話'] as const satisfies How[];

  if (isAll) {
    // kids は kids_words から
    for (const phrase of selectedKidsWords) {
      const usedSentences: string[] = [];
      for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
        const voice = voices[Math.floor(Math.random() * voices.length)];
        const how = hows[Math.floor(Math.random() * hows.length)];
        console.error(`\n── 「${phrase}」 / kids (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`);
        const seed = await generateForPhrase(phrase, 'kids', voice, how, usedSentences);
        if (seed) {
          usedSentences.push(seed.englishSentence);
          seedProblems.push(seed);
        }
      }
    }
    // short / medium / long は words から
    for (const phrase of selectedWords) {
      for (const len of NON_KIDS_PROBLEM_LENGTHS) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice = voices[Math.floor(Math.random() * voices.length)];
          const how = hows[Math.floor(Math.random() * hows.length)];
          console.error(`\n── 「${phrase}」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`);
          const seed = await generateForPhrase(phrase, len, voice, how, usedSentences);
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
    for (const phrase of selectedWords) {
      for (const len of lengths) {
        const usedSentences: string[] = [];
        for (let i = 0; i < PROBLEMS_PER_PHRASE; i++) {
          const voice = voices[Math.floor(Math.random() * voices.length)];
          const how = hows[Math.floor(Math.random() * hows.length)];
          console.error(`\n── 「${phrase}」 / ${len} (${i + 1}/${PROBLEMS_PER_PHRASE}) ──`);
          const seed = await generateForPhrase(phrase, len, voice, how, usedSentences);
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
        const lastKidsWord = selectedKidsWords[selectedKidsWords.length - 1]!;
        await seedToDatabase(
          seedProblems.filter((p) => p.difficultyLevel === 1),
          lastKidsWord,
          'LATEST_USED_WORD_KIDS',
        );
      }
      if (selectedWords.length > 0) {
        const lastNonKidsWord = selectedWords[selectedWords.length - 1]!;
        await seedToDatabase(
          seedProblems.filter((p) => p.difficultyLevel !== 1),
          lastNonKidsWord,
          'LATEST_USED_WORD',
        );
      }
    } else {
      const lastConsumedWord = selectedWords[selectedWords.length - 1]!;
      await seedToDatabase(seedProblems, lastConsumedWord, latestUsedWordKey);
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
      if (selectedKidsWords.length > 0) {
        const lastKidsWord = selectedKidsWords[selectedKidsWords.length - 1]!;
        await persistLatestUsedWordIfKnown('LATEST_USED_WORD_KIDS', lastKidsWord, kidsWords);
      }
      if (selectedWords.length > 0) {
        const lastNonKidsWord = selectedWords[selectedWords.length - 1]!;
        await persistLatestUsedWordIfKnown('LATEST_USED_WORD', lastNonKidsWord, words);
      }
    } else {
      const lastConsumedWord = selectedWords[selectedWords.length - 1]!;
      await persistLatestUsedWordIfKnown(latestUsedWordKey, lastConsumedWord, activeWordList);
    }
  }

  if (!opts.noRemoveWords) {
    if (isAll) {
      if (selectedKidsWords.length > 0) {
        const lastKidsWord = selectedKidsWords[selectedKidsWords.length - 1]!;
        removeConsumedWordsThrough(lastKidsWord, kidsWords, 'docs/kids_words.ts');
      }
      if (selectedWords.length > 0) {
        const lastNonKidsWord = selectedWords[selectedWords.length - 1]!;
        removeConsumedWordsThrough(lastNonKidsWord, words, 'docs/words.ts');
      }
    } else {
      const lastConsumedWord = selectedWords[selectedWords.length - 1]!;
      removeConsumedWordsThrough(lastConsumedWord, activeWordList, activeWordsFilePath);
    }
  }

  console.error(
    `\n✅ 完了: 合計 ${seedProblems.length} 問（モード: ${opts.mode}、使用ワード数: ${allUsedWords.length}）`,
  );
}

const batchOpts = parseBatchCliArgs();
if (batchOpts) {
  void runBatch(batchOpts);
} else {
  void main();
}
