#!/usr/bin/env tsx

import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as readline from 'readline';
import { words } from '../docs/words';
import { TEXT_MODEL } from '@/const';
import type { SeedProblemData } from '@/types/problem';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';

// 環境変数を読み込み
dotenv.config();

// OpenAIクライアントを初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type TokenUsage = {
  input_tokens: number;
  output_tokens: number;
};

type SceneDraft = {
  when: string;
  how: string;
  word: string;
  sender: {
    role: string;
    where: string;
    why: string;
  };
  receiver: {
    role: string;
    where: string;
    why: string;
  };
};

type SceneDraftWithVoice = {
  when: string;
  how: string;
  word: string;
  sender: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    why: string;
  };
  receiver: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    why: string;
  };
};

/**
 * OpenAI APIを使って英文の会話を生成
 */
async function createEnglishConversation(
  sceneDraft: SceneDraftWithVoice,
  wordCountRange: { min: number; max: number; note?: string },
): Promise<{
  result: {
    englishSentence: string;
    englishReply: string;
  };
  tokenUsage: TokenUsage;
}> {
  console.log(`  💬 「${sceneDraft.word}」の英会話生成中...`);

  const noteInstruction = wordCountRange.note ? `\n   - **注意: ${wordCountRange.note}**` : '';

  const prompt = `以下のシーン設定に基づいて、自然な英語の会話を作成してください。TOEICのリスニング問題に出てきそうな会話にしてください。

【シーン設定】
- いつ: ${sceneDraft.when}
- どのように: ${sceneDraft.how}
- 使用する単語: ${sceneDraft.word}

【送信者（英文を話す人）】
- 役割: ${sceneDraft.sender.role}
- 性別: ${sceneDraft.sender.voice === 'male' ? '男性' : '女性'}
- 場所: ${sceneDraft.sender.where}
- 意図: ${sceneDraft.sender.why}

【受信者（返答する人）】
- 役割: ${sceneDraft.receiver.role}
- 性別: ${sceneDraft.receiver.voice === 'male' ? '男性' : '女性'}
- 場所: ${sceneDraft.receiver.where}

【重要な要件】
1. englishSentence: 送信者が話す英文。「${sceneDraft.word}」という表現を必ず使用すること。
   - **重要: ${wordCountRange.min}〜${wordCountRange.max}単語の範囲内で作成すること**${noteInstruction}
2. englishReply: 受信者の返答。簡潔で適切な応答（12語以内が望ましい）。無駄に話題を広げないこと。ただし「へぇ、そうなんだ。なんか面白そうだね。」といった当たり障りのない内容は禁止です。具体的にenglishSentenceの内容に言及してください。
3. 両方とも自然な口語表現で、実際の会話らしくすること。
4. 文脈に合った適切な内容にすること。

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "englishSentence": "The meeting has been postponed until next week.",
  "englishReply": "Got it. I'll update my calendar."
}
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

    const result = JSON.parse(jsonMatch[1]) as {
      englishSentence: string;
      englishReply: string;
    };

    // 型チェック
    if (!result.englishSentence || !result.englishReply) {
      throw new Error('englishSentenceまたはenglishReplyが見つかりません');
    }

    // wordが含まれているか確認
    if (!result.englishSentence.toLowerCase().includes(sceneDraft.word.toLowerCase())) {
      console.warn(`  ⚠️ englishSentenceに「${sceneDraft.word}」が含まれていません`);
    }

    return {
      result,
      tokenUsage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error(`  ⚠️ 英会話生成に失敗しました:`, error instanceof Error ? error.message : error);
    // エラーの場合はデフォルト値を返す
    return {
      result: {
        englishSentence: `Can you use ${sceneDraft.word} in this context?`,
        englishReply: 'Sure, I understand.',
      },
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

/**
 * OpenAI APIを使って日本語の会話を生成
 */
async function createJapaneseConversation(problemData: {
  when: string;
  how: string;
  word: string;
  sender: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    why: string;
    englishSentence: string;
  };
  receiver: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    why: string;
    englishReply: string;
  };
}): Promise<{
  result: {
    japaneseSentence: string;
    japaneseReply: string;
  };
  tokenUsage: TokenUsage;
}> {
  console.log(`  🇯🇵 「${problemData.word}」の日本語会話生成中...`);

  const prompt = `以下の英会話を自然な日本語に翻訳してください。

【シーン情報】
- いつ: ${problemData.when}
- どのように: ${problemData.how}
- 単語: ${problemData.word}

【送信者】
- 役割: ${problemData.sender.role}
- 場所: ${problemData.sender.where}
- 英文: "${problemData.sender.englishSentence}"
- 性別: ${problemData.sender.voice === 'male' ? '男性' : '女性'}
- 動機: ${problemData.sender.why}

【受信者】
- 役割: ${problemData.receiver.role}
- 場所: ${problemData.receiver.where}
- 英文: "${problemData.receiver.englishReply}"
- 性別: ${problemData.receiver.voice === 'male' ? '男性' : '女性'}
- 動機: ${problemData.receiver.why}

【重要な要件】
1. japaneseSentence: 送信者の英文を自然な日本語に翻訳
2. japaneseReply: 受信者の英文を自然な日本語に翻訳
3. シーンや役割に合った適切な日本語表現にすること
4. 口語的で自然な会話になるようにすること

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "japaneseSentence": "会議は来週まで延期になりました。",
  "japaneseReply": "了解しました。カレンダーを更新します。"
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
      japaneseSentence: string;
      japaneseReply: string;
    };

    // 型チェック
    if (!result.japaneseSentence || !result.japaneseReply) {
      throw new Error('japaneseSentenceまたはjapaneseReplyが見つかりません');
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
      `  ⚠️ 日本語会話生成に失敗しました:`,
      error instanceof Error ? error.message : error,
    );
    // エラーの場合はデフォルト値を返す
    return {
      result: {
        japaneseSentence: problemData.sender.englishSentence,
        japaneseReply: problemData.receiver.englishReply,
      },
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

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
    why: string;
    englishSentence: string;
    japaneseSentence: string;
  };
  receiver: {
    role: string;
    voice: 'male' | 'female';
    where: string;
    why: string;
    englishReply: string;
    japaneseReply: string;
  };
}): Promise<{
  result: {
    scenePrompt: string;
  };
  tokenUsage: TokenUsage;
}> {
  console.log(`  🎨 「${problemData.word}」のシーンプロンプト生成中...`);

  const prompt = `以下の会話シーンについて、画像生成AIに渡すための場面説明を200文字程度の日本語で作成してください。

【シーン情報】
- いつ: ${problemData.when}
- どのように: ${problemData.how}

【話しかける人（${problemData.sender.voice === 'male' ? '男性' : '女性'}・${problemData.sender.role}）】
- 場所: ${problemData.sender.where}
- 目的: ${problemData.sender.why}
- 最初のセリフ: 「${problemData.sender.japaneseSentence}」

【返答する人（${problemData.receiver.voice === 'male' ? '男性' : '女性'}・${problemData.receiver.role}）】
- 場所: ${problemData.receiver.where}
- 返答のセリフ: 「${problemData.receiver.japaneseReply}」

【要件】
1. **200文字程度**で簡潔に
2. ストーリーと場所の様子を説明。まず対面なのか電話なのかビデオ通話なのか書くこと。ストーリーにはセリフそのものは含めず、画像の生成に必要な背景の情報などを描くこと。
3. 「まだ〜していない」など、やっていないことも明記(例: まだコーヒーは届いていない、まだテーブルには何もない)
4. 1コマ目と2コマ目で何が起こるかを簡潔に
5. プロパティ名（sender/receiver/englishSentence等）は使わず、自然な日本語で

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "scenePrompt": "ビデオ通話での会話。火曜の夕方、女性の同僚が自宅のリビングでパソコンの前に座り、ビデオ通話で男性の同僚に納期の注意を伝えている。1コマ目は女性が真剣な表情で話している。2コマ目では男性がオフィスの会議室でPCのモニタを見ながら自信ありげに返答している。まだ資料は完成していない。"
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
      `  ⚠️ シーンプロンプト生成に失敗しました:`,
      error instanceof Error ? error.message : error,
    );
    // エラーの場合はデフォルト値を返す
    return {
      result: {
        scenePrompt: `${problemData.sender.role}が${problemData.receiver.role}に話しかけている場面。`,
      },
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
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

  // 3つ全てがjapaneseSentenceより短いかチェック
  const allShorter = incorrectOptions.every((opt) => opt.length < japaneseSentenceLength);

  if (!allShorter) {
    return {
      result: incorrectOptions,
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }

  console.log(
    `  ⚠️ ${problemIndex}問目: incorrectOptionsが全て短いため、調整します（基準: ${japaneseSentenceLength}文字）`,
  );

  // 短い順にソートして先頭を取り出す
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

/**
 * OpenAI APIを使って誤答選択肢を生成
 */
async function createIncorrectOptions(japaneseSentence: string): Promise<{
  result: string[];
  tokenUsage: TokenUsage;
}> {
  console.log(`  🎯 誤答選択肢を生成中...`);

  const prompt = `以下の日本語文に対して、誤答選択肢を3つ生成してください。

【正解の日本語文】
${japaneseSentence}

【誤答選択肢の構成（必須）】
1つ目: **馬鹿馬鹿しい選択肢**
  - 笑ってしまうような、ありえない内容
  - 正解とは全く関係ない、面白おかしい誤訳
  - 文字数: 正解（${japaneseSentence.length}文字）とほぼ同じ

2つ目: **明らかな間違い**
  - 似たようなテーマだが真逆のことを言っている
  - 文字数: 正解（${japaneseSentence.length}文字）とほぼ同じ

3つ目: **明らかな間違い**
  - かなり無関係な内容
  - 文字数: 正解（${japaneseSentence.length}文字）とほぼ同じ

【重要ルール】
- 文字数が全然足りないのは禁止。冗長な言い回しにしてでも文字数を稼ぐこと
- 正解の日本語文が疑問文の場合、3つ目とも全て疑問文を生成すること
- 全て「明らかに正解ではない」とわかる内容にすること
- 1つ目は必ず馬鹿馬鹿しい内容にすること

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
[
  "馬鹿馬鹿しい選択肢（1つ目）",
  "真逆の内容（2つ目）",
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
      `  ⚠️ 誤答選択肢生成に失敗しました:`,
      error instanceof Error ? error.message : error,
    );
    // エラーの場合はデフォルト値を返す
    return {
      result: ['ダミー選択肢1', 'ダミー選択肢2', 'ダミー選択肢3'],
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

/**
 * OpenAI APIを使ってシーンの下書きを作成
 */
async function createSceneDraft({
  value,
  genre,
}: {
  value: string;
  genre: 'ビジネス' | '日常生活';
}): Promise<{
  result: SceneDraft;
  tokenUsage: TokenUsage;
}> {
  console.log(`  🎬 「${value}」のシーン生成中...`);

  const prompt = `「${value}」というワード・フレーズを使って、${genre}系の会話シーンを作成してください。TOEICのリスニング問題に出てきそうなシーンにしてください。

【要件】
- sender: 送信者の情報（こちらが「${value}」というワードを使用する人物）
  - why: なぜこの発言をするのか（20文字程度）「${value}」という表現から必然的に導かれる動機を設定してください。
  - role: 役割（例: 上司、同僚、友人、家族）
  - where: どこにいるか具体的に（例: オフィスの自席、駅の券売機前、病院の受付）（対面での会話の場合は、receiverと同じ場所または近い場所にすること）
- receiver: 受信者の情報
  - role: 役割
  - where: どこにいるか具体的に（例: オフィスの自席、駅の券売機前、病院の受付）（対面での会話の場合は、senderと同じ場所または近い場所にすること）
- when: いつ会話するか（例: 金曜の午後、平日の夕方、深夜、平日の昼）
- how: どのように会話するか（例: 対面、電話、ビデオ通話。基本的には対面を想定しているが、シーンにあった手段を設定してください）**音声会話のみ想定。チャット、メール、LINEなどの文字ベースは禁止**
- word: 使用する単語・フレーズ（必ず「${value}」を設定）

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
{
  "word": "remote work",
  "sender": {
    "why": "リモートワークが可能だということを部下に伝えたい"
    "role": "上司",
    "where": "オフィスの自席",
  },
  "receiver": {
    "role": "部下",
    "where": "上司の自席の近く"
  },
  "when": "月曜の午後",
  "how": "対面"
}
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

    const result = JSON.parse(jsonMatch[1]) as SceneDraft;

    // 型チェック
    if (
      !result.when ||
      !result.how ||
      !result.word ||
      !result.sender?.role ||
      !result.sender?.where ||
      !result.sender?.why ||
      !result.receiver?.role ||
      !result.receiver?.where
    ) {
      throw new Error('レスポンスの形式が正しくありません');
    }

    // receiver.whyを固定値で上書き
    result.receiver.why = '相手の言葉を受け取って、簡潔に適切な応答を返したい';

    return {
      result,
      tokenUsage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error(`  ⚠️ シーン生成に失敗しました:`, error instanceof Error ? error.message : error);
    // エラーの場合はデフォルト値を返す
    return {
      result: {
        when: genre === 'ビジネス' ? '平日の午後' : '週末の午前',
        how: genre === 'ビジネス' ? '電話' : '対面',
        word: value,
        sender: {
          role: genre === 'ビジネス' ? '上司' : '友人',
          where: genre === 'ビジネス' ? 'オフィス' : '自宅',
          why: '相手に情報を伝えたい',
        },
        receiver: {
          role: genre === 'ビジネス' ? '同僚' : '友人',
          where: genre === 'ビジネス' ? 'オフィス' : '自宅',
          why: '相手の言葉を受け取って、簡潔に適切な応答を返したい',
        },
      },
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

/**
 * OpenAI APIを使って単語をジャンル分けする
 */
async function wordsToGenres(words: string[]): Promise<{
  result: { value: string; genre: 'ビジネス' | '日常生活' }[];
  tokenUsage: TokenUsage;
}> {
  if (words.length === 0) {
    return { result: [], tokenUsage: { input_tokens: 0, output_tokens: 0 } };
  }

  console.log('🤖 OpenAI APIで単語のジャンル分けを実行中...');

  const prompt = `以下の英語の単語・フレーズが「ビジネス」シーンで使われるか「日常生活」シーンで使われるかを判定してください。できれば均等に。でも明らかなビジネス用語を「日常生活」に分類しないこと。

単語リスト:
${words.map((word, index) => `${index + 1}. ${word}`).join('\n')}

【判定基準】
- ビジネス: 仕事、会議、オフィス、ビジネスメールなどで主に使われる
- 日常生活: 友人や家族との会話、プライベートな場面で主に使われる

【重要】以下のJSON形式で必ず回答してください:

\`\`\`json
[
  { "value": "単語1", "genre": "ビジネス" },
  { "value": "単語2", "genre": "日常生活" }
]
\`\`\``;

  try {
    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: [{ role: 'user', content: prompt }],
      temperature: 0.3,
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

    const result = JSON.parse(jsonMatch[1]);

    if (!Array.isArray(result)) {
      throw new Error('レスポンスが配列ではありません');
    }

    // 型チェック
    for (const item of result) {
      if (typeof item.value !== 'string') {
        throw new Error('レスポンスの形式が正しくありません');
      }
    }

    console.log('✅ ジャンル分け完了');
    return {
      result,
      tokenUsage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error('⚠️ ジャンル分けに失敗しました:', error instanceof Error ? error.message : error);
    // エラーの場合はデフォルトで日常生活として返す
    return {
      result: words.map((word) => ({ value: word, genre: '日常生活' })),
      tokenUsage: { input_tokens: 0, output_tokens: 0 },
    };
  }
}

/**
 * ユーザーに問題タイプと問題数を選択させる
 */
async function promptProblemSettings(): Promise<{ type: ProblemLength; count: number }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n問題の英文の語数タイプを選択してください:');
    console.log(`  1. short  (${WORD_COUNT_RULES.short.min}-${WORD_COUNT_RULES.short.max}単語)`);
    console.log(`  2. medium (${WORD_COUNT_RULES.medium.min}-${WORD_COUNT_RULES.medium.max}単語)`);
    console.log(`  3. long   (${WORD_COUNT_RULES.long.min}-${WORD_COUNT_RULES.long.max}単語)`);
    console.log('');

    rl.question('選択してください [1/2/3]: ', (typeAnswer) => {
      const trimmed = typeAnswer.trim();
      let selectedType: ProblemLength;

      if (trimmed === '1' || trimmed.toLowerCase() === 'short') {
        selectedType = 'short';
      } else if (trimmed === '2' || trimmed.toLowerCase() === 'medium') {
        selectedType = 'medium';
      } else if (trimmed === '3' || trimmed.toLowerCase() === 'long') {
        selectedType = 'long';
      } else {
        console.log('無効な選択です。デフォルトの medium を使用します。\n');
        selectedType = 'medium';
      }

      rl.question(`\n何問生成しますか？ [最大: ${words.length}]: `, (countAnswer) => {
        rl.close();

        const countTrimmed = countAnswer.trim();
        let count: number;

        if (countTrimmed === '') {
          count = 1;
        } else {
          const parsed = parseInt(countTrimmed, 10);
          if (isNaN(parsed) || parsed < 1) {
            console.log('無効な入力です。1問を使用します。\n');
            count = 1;
          } else if (parsed > words.length) {
            console.log(`指定された数が多すぎます。最大値 ${words.length} を使用します。`);
            count = words.length;
          } else {
            count = parsed;
          }
        }

        resolve({ type: selectedType, count });
      });
    });
  });
}

/**
 * ユーザーに取得する単語数を聞く
 */
/**
 * 次のproblemファイル番号を取得
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

/**
 * completeResultsをSeedProblemDataに変換
 */
function convertToSeedProblemData(
  completeResults: Array<{
    when: string;
    how: string;
    word: string;
    scenePrompt: string;
    sender: {
      role: string;
      voice: 'male' | 'female';
      where: string;
      why: string;
      englishSentence: string;
      japaneseSentence: string;
    };
    receiver: {
      role: string;
      voice: 'male' | 'female';
      where: string;
      why: string;
      englishReply: string;
      japaneseReply: string;
    };
    incorrectOptions: string[];
  }>,
): SeedProblemData[] {
  return completeResults.map((result) => {
    // placeを生成
    let place: string;
    if (result.sender.where === result.receiver.where) {
      // 同じ場所の場合
      place = result.sender.where;
    } else {
      // 異なる場所の場合（電話やビデオ通話）
      place = `【1コマ目】${result.sender.where}、【2コマ目】${result.receiver.where}`;
    }

    return {
      place,
      senderRole: result.sender.role,
      senderVoice: result.sender.voice,
      receiverRole: result.receiver.role,
      receiverVoice: result.receiver.voice,
      englishSentence: result.sender.englishSentence,
      japaneseSentence: result.sender.japaneseSentence,
      englishReply: result.receiver.englishReply,
      japaneseReply: result.receiver.japaneseReply,
      scenePrompt: result.scenePrompt,
      senderVoiceInstruction: null,
      receiverVoiceInstruction: null,
      incorrectOptions: result.incorrectOptions,
      difficultyLevel: null,
    };
  });
}

/**
 * 問題ファイルを保存
 */
function saveProblemFile(seedProblems: SeedProblemData[], fileNumber: number): string {
  const problemDir = path.join(process.cwd(), 'problemData');
  const fileName = `problem${fileNumber}.ts`;
  const filePath = path.join(problemDir, fileName);

  // オブジェクトをTypeScriptコードとして整形
  const problemsCode = seedProblems
    .map((problem) => {
      return JSON.stringify(problem, null, 2)
        .replace(/"([^"]+)":/g, '$1:') // キーのクォートを削除
        .replace(/: "([^"]*)"/g, (match, value) => {
          // 値のクォートをシングルクォートに変更
          return `: '${value.replace(/'/g, "\\'")}'`;
        })
        .replace(/: null/g, ': null'); // nullはそのまま
    })
    .join(',\n');

  // ファイル内容を構築
  const fileContent = `import { SeedProblemData } from '../src/types/problem';

/**
 * 問題データ ${fileNumber}
 * Generated by create-problems.ts (${seedProblems.length} problems)
 */
const problemData: SeedProblemData[] = [
${problemsCode}
];

export default problemData;
`;

  // ファイルを保存
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  return filePath;
}

/**
 * 使用済み語彙をwords.tsから除外
 */
function removeUsedWordsFromWordList(wordsToRemove: readonly string[]): void {
  if (wordsToRemove.length === 0) {
    return;
  }

  const wordsPath = path.join(process.cwd(), 'docs', 'words.ts');

  if (!fs.existsSync(wordsPath)) {
    console.warn(`⚠️ 語彙ファイルが見つからないため削除をスキップします: ${wordsPath}`);
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
    console.warn(
      `⚠️ 次の語彙はwords.tsで見つからず削除できませんでした: ${Array.from(remainingWords).join(', ')}`,
    );
  }

  const updatedContent = updatedLines.join('\n');
  if (updatedContent !== originalContent) {
    fs.writeFileSync(wordsPath, updatedContent, 'utf-8');
    console.log('✅ words.tsから使用済み語彙を削除しました');
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('🚀 単語取得スクリプト開始');
    console.log(`📚 現在の単語数: ${words.length}個\n`);

    // OpenAI API Keyの確認
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY環境変数が設定されていません。\n' +
          '.envファイルにOPENAI_API_KEY=your_api_keyを設定してください。',
      );
    }

    // ユーザーに問題タイプと問題数を聞く
    const { type: problemType, count } = await promptProblemSettings();
    const wordRange = WORD_COUNT_RULES[problemType];

    console.log(
      `\n📌 ${problemType} モード (${wordRange.min}-${wordRange.max}単語): ${count}問を生成します\n`,
    );

    // 指定された数の単語を取得
    const selectedWords = words.slice(0, count);

    // ジャンル分けを実行
    const { result: wordsWithGenres, tokenUsage } = await wordsToGenres(selectedWords);

    console.log(`\n📝 取得した${count}個の単語:\n`);

    // シーンドラフトを生成
    console.log('🎬 シーンドラフト生成開始...\n');
    const sceneDraftResults: {
      result: SceneDraftWithVoice;
      tokenUsage: TokenUsage;
    }[] = [];
    for (const wordWithGenre of wordsWithGenres) {
      const sceneDraftResult = await createSceneDraft(wordWithGenre);

      // voiceをランダムに設定
      const senderVoice: 'male' | 'female' = Math.random() < 0.5 ? 'male' : 'female';
      const receiverVoice: 'male' | 'female' = senderVoice === 'male' ? 'female' : 'male';

      const sceneDraftWithVoice = {
        ...sceneDraftResult,
        result: {
          ...sceneDraftResult.result,
          sender: {
            ...sceneDraftResult.result.sender,
            voice: senderVoice,
          },
          receiver: {
            ...sceneDraftResult.result.receiver,
            voice: receiverVoice,
          },
        },
      };

      console.log(JSON.stringify(sceneDraftWithVoice, null, 2));
      sceneDraftResults.push(sceneDraftWithVoice);
    }

    // 英会話を生成してマージ
    console.log('💬 英会話生成開始...\n');
    const mergedResults: {
      when: string;
      how: string;
      word: string;
      sender: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishSentence: string;
      };
      receiver: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishReply: string;
      };
    }[] = [];
    let totalInputTokens = tokenUsage.input_tokens;
    let totalOutputTokens = tokenUsage.output_tokens;

    for (const [, sceneDraftResult] of sceneDraftResults.entries()) {
      const conversationResult = await createEnglishConversation(
        sceneDraftResult.result,
        wordRange,
      );

      // シーンドラフトと英会話をマージ
      const merged = {
        when: sceneDraftResult.result.when,
        how: sceneDraftResult.result.how,
        word: sceneDraftResult.result.word,
        sender: {
          ...sceneDraftResult.result.sender,
          englishSentence: conversationResult.result.englishSentence,
        },
        receiver: {
          ...sceneDraftResult.result.receiver,
          englishReply: conversationResult.result.englishReply,
        },
      };

      mergedResults.push(merged);

      // トークン使用量を合算
      totalInputTokens += sceneDraftResult.tokenUsage.input_tokens;
      totalOutputTokens += sceneDraftResult.tokenUsage.output_tokens;
      totalInputTokens += conversationResult.tokenUsage.input_tokens;
      totalOutputTokens += conversationResult.tokenUsage.output_tokens;
    }

    // 日本語会話を生成してマージ
    console.log('🇯🇵 日本語会話生成開始...\n');
    const finalResults: {
      when: string;
      how: string;
      word: string;
      sender: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishSentence: string;
        japaneseSentence: string;
      };
      receiver: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishReply: string;
        japaneseReply: string;
      };
    }[] = [];

    for (const [, mergedResult] of mergedResults.entries()) {
      const japaneseResult = await createJapaneseConversation(mergedResult);

      // 日本語会話をマージ
      const final = {
        when: mergedResult.when,
        how: mergedResult.how,
        word: mergedResult.word,
        sender: {
          ...mergedResult.sender,
          japaneseSentence: japaneseResult.result.japaneseSentence,
        },
        receiver: {
          ...mergedResult.receiver,
          japaneseReply: japaneseResult.result.japaneseReply,
        },
      };

      finalResults.push(final);

      // トークン使用量を合算
      totalInputTokens += japaneseResult.tokenUsage.input_tokens;
      totalOutputTokens += japaneseResult.tokenUsage.output_tokens;
    }

    // シーンプロンプトを生成してマージ
    console.log('🎨 シーンプロンプト生成開始...\n');
    const completeResults: {
      when: string;
      how: string;
      word: string;
      scenePrompt: string;
      sender: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishSentence: string;
        japaneseSentence: string;
      };
      receiver: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishReply: string;
        japaneseReply: string;
      };
    }[] = [];

    for (const [, finalResult] of finalResults.entries()) {
      const scenePromptResult = await createScenePrompt(finalResult);

      // シーンプロンプトをマージ
      const complete = {
        ...finalResult,
        scenePrompt: scenePromptResult.result.scenePrompt,
      };

      completeResults.push(complete);

      // トークン使用量を合算
      totalInputTokens += scenePromptResult.tokenUsage.input_tokens;
      totalOutputTokens += scenePromptResult.tokenUsage.output_tokens;
    }

    // 誤答選択肢を生成してマージ
    console.log('🎯 誤答選択肢生成開始...\n');
    const finalResultsWithOptions: {
      when: string;
      how: string;
      word: string;
      scenePrompt: string;
      sender: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishSentence: string;
        japaneseSentence: string;
      };
      receiver: {
        role: string;
        voice: 'male' | 'female';
        where: string;
        why: string;
        englishReply: string;
        japaneseReply: string;
      };
      incorrectOptions: string[];
    }[] = [];

    for (const [index, completeResult] of completeResults.entries()) {
      const problemIndex = index + 1;
      const incorrectOptionsResult = await createIncorrectOptions(
        completeResult.sender.japaneseSentence,
      );

      // incorrectOptionsの長さを調整（必要に応じて）
      const adjustedOptionsResult = await adjustIncorrectOptionsLength(
        incorrectOptionsResult.result,
        completeResult.sender.japaneseSentence,
        problemIndex,
      );

      // 誤答選択肢をマージ
      const finalWithOptions = {
        ...completeResult,
        incorrectOptions: adjustedOptionsResult.result,
      };

      finalResultsWithOptions.push(finalWithOptions);

      // トークン使用量を合算
      totalInputTokens += incorrectOptionsResult.tokenUsage.input_tokens;
      totalOutputTokens += incorrectOptionsResult.tokenUsage.output_tokens;
      totalInputTokens += adjustedOptionsResult.tokenUsage.input_tokens;
      totalOutputTokens += adjustedOptionsResult.tokenUsage.output_tokens;
    }

    // incorrectOptionsの長さをチェック
    let allLongerCount = 0;
    let allShorterCount = 0;

    for (const result of finalResultsWithOptions) {
      const japaneseSentenceLength = result.sender.japaneseSentence.length;
      const allLonger = result.incorrectOptions.every(
        (option) => option.length > japaneseSentenceLength,
      );
      const allShorter = result.incorrectOptions.every(
        (option) => option.length < japaneseSentenceLength,
      );

      if (allLonger) allLongerCount++;
      if (allShorter) allShorterCount++;
    }

    // トークン使用量を表示
    if (totalInputTokens > 0 || totalOutputTokens > 0) {
      console.log('\n📊 トークン使用量:');
      console.log(`  入力トークン（合計）: ${totalInputTokens}`);
      console.log(`  出力トークン（合計）: ${totalOutputTokens}`);

      // 1問あたりの平均トークン数
      const avgInputTokens = Math.round(totalInputTokens / count);
      const avgOutputTokens = Math.round(totalOutputTokens / count);

      console.log(`\n  📊 1問あたりの平均:`);
      console.log(`    入力トークン: ${avgInputTokens}`);
      console.log(`    出力トークン: ${avgOutputTokens}`);
    }

    // incorrectOptionsの統計を表示
    console.log('\n📏 incorrectOptionsの長さチェック:');
    console.log(`  長い選択肢ばっか！: ${allLongerCount}件`);
    console.log(`  短い選択肢ばっか！: ${allShorterCount}件`);
    console.log(`  適切な長さ: ${count - allLongerCount - allShorterCount}件`);

    // SeedProblemDataに変換
    console.log('\n📦 SeedProblemDataに変換中...');
    const seedProblems = convertToSeedProblemData(finalResultsWithOptions);

    // ファイルを保存
    const fileNumber = getNextProblemNumber();
    console.log(`💾 ファイルを保存中... (problem${fileNumber}.ts)`);
    const savedPath = saveProblemFile(seedProblems, fileNumber);
    console.log(`✅ 保存完了: ${savedPath}\n`);

    console.log('🧹 使用済み語彙をwords.tsから削除中...');

    // ファイルから削除
    removeUsedWordsFromWordList(selectedWords);

    console.log(`\n🎉 完了！${count}個の単語を処理しました`);
    console.log(`📚 残りの単語数: ${words.length - count}個`);
    console.log(`\n次のステップ:`);
    console.log(`  1. 生成されたファイルを確認してください`);
    console.log(`  2. npm run db:seed ${savedPath} でデータベースに登録できます`);
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { main };
