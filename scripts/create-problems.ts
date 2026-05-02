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
import { PrismaClient } from '@prisma/client';
import { withAccelerate } from '@prisma/extension-accelerate';

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
    gender: 'male' | 'female';
  };
  receiver: {
    role: string;
    where: string;
    why: string;
    /** sender.gender と必ず逆 */
    gender: 'male' | 'female';
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
  isKids = false,
): Promise<{
  result: {
    englishSentence: string;
    englishReply: string;
  };
  tokenUsage: TokenUsage;
} | null> {
  console.log(`  💬 「${sceneDraft.word}」の英会話生成中...`);

  const noteInstruction = wordCountRange.note ? `\n   - **注意: ${wordCountRange.note}**` : '';

  const prompt = isKids
    ? `以下のシーン設定に基づいて、中学1年生の英語の教科書に出てきそうな、とても短くて簡単な英語の会話を作成してください。

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
- 意図: ${sceneDraft.receiver.why}

【重要な要件】
1. englishSentence: 送信者が話す英文。「${sceneDraft.word}」という表現を必ず使用すること。この文だけ読めば、文脈を知らなくても意図や状況が分かるような文が好ましい。
   - **最重要: 必ず${wordCountRange.max}単語以内の短い文にすること。長い文は絶対に禁止。**${noteInstruction}
   - 良い例: "Do you like cats?" (4単語), "Can you swim?" (3単語), "I like pizza." (3単語)
   - 悪い例: "Do you want to go to the park with me after school?" (長すぎる)
2. englishReply: 受信者の返答。englishSentenceに対する、要点を押さえつつできるだけ短い回答であること。目安は8単語以内。englishReplyを読めばenglishSentenceの内容が想像できるような、具体的な言及を含む文がいい。
  - 例: "Can you play the guitar?" に対して "Yeah, but I can only play a few songs."
  - 例: "Are you hungry?" に対して "Yes, I want some pizza."
  - 「こう返答したってことは、きっとこう話しかけられたんだろうな」と推測できるような内容にすること。
3. 使用する文法は be動詞、一般動詞の現在形・過去形、can、疑問文(Do you/Is this/Can you/Did you)程度に限定すること。関係代名詞、仮定法、完了形、受動態は使わないこと。
4. 両方とも自然な口語表現で、実際の会話らしくすること。
5. 文脈に合った適切な内容にすること。
  - 「こう話しかけられたら、こう返答するのは自然だよなあ」と感じる内容にすること。

【重要】以下のJSON形式で必ず回答してください

\`\`\`json
{
  "englishSentence": "ここに英文が入る。",
  "englishReply": "ここに返答の英文が入る。"
}
\`\`\``
    : `以下のシーン設定に基づいて、自然な英語の会話を作成してください。TOEICのリスニング問題に出てきそうな会話にしてください。

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
- 意図: ${sceneDraft.receiver.why}

【重要な要件】
1. englishSentence: 送信者が話す英文。「${sceneDraft.word}」という表現を必ず使用すること。この文だけ読めば、文脈を知らなくても意図や状況が分かるような文が好ましい。
   - **重要: ${wordCountRange.min}〜${wordCountRange.max}単語の範囲内で作成すること**${noteInstruction}
2. englishReply: 受信者の返答。englishSentence対する、要点を押さえつつできるだけ短い回答であること。目安は8単語以内。englishReplyを読めばenglishSentenceの内容が想像できるような、具体的な言及を含む文がいい。
  - 例: "So much red tape here." に対して "Yeah, it's a lot of unnecessary paperwork."
  - 例: "Is this your bag?" に対して "No, I think it might belong to Mr. Yamada."
  - 「こう返答したってことは、きっとこう話しかけられたんだろうな」と推測できるような内容にすること。
3. 両方とも自然な口語表現で、実際の会話らしくすること。
4. 文脈に合った適切な内容にすること。
  - 「こう話しかけられたら、こう返答するのは自然だよなあ」と感じる内容にすること。

【重要】以下のJSON形式で必ず回答してください

\`\`\`json
{
  "englishSentence": "ここに英文が入る。",
  "englishReply": "ここに返答の英文が入る。"
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
    console.error(`  ❌ 英会話生成に失敗しました:`, error instanceof Error ? error.message : error);
    return null;
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
} | null> {
  console.log(`  🇯🇵 「${problemData.word}」の日本語会話生成中...`);

  const prompt = `以下の英会話を自然な日本語に翻訳してください。
  機械音声で読み上げるための日本語文なので、括弧書きは含めないでください。
  最後は「。」または「？」で終わること。

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
5. 動機に含まれていても、英文に含まれていない情報は日本語訳に含めないこと。
6. 英文に含まれている単語の意味は、日本語にも省略せず含めること。ただし省略しないと不自然な場合は省略してもいい。
7. カタカナ英語は避け、ちゃんと日本語に翻訳すること。ただし、日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。

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
      `  ❌ 日本語会話生成に失敗しました:`,
      error instanceof Error ? error.message : error,
    );
    return null;
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
} | null> {
  console.log(`  🎨 「${problemData.word}」のシーンプロンプト生成中...`);

  const prompt = `以下の会話シーンについて、画像生成AIを使用して実写の2コマ画像を生成します。画像生成AIに渡すための場面説明を200文字程度の日本語で作成してください。

【シーン情報】
- いつ: ${problemData.when}
- どのように: ${problemData.how}

【1コマ目: 話しかける人（${problemData.sender.voice === 'male' ? '男性' : '女性'}・${problemData.sender.role}）】
- 場所: ${problemData.sender.where}
- 目的: ${problemData.sender.why}
- 最初のセリフ: 「${problemData.sender.japaneseSentence}」

【2コマ目: 返答する人（${problemData.receiver.voice === 'male' ? '男性' : '女性'}・${problemData.receiver.role}）】
- 場所: ${problemData.receiver.where}
- 返答のセリフ: 「${problemData.receiver.japaneseReply}」

【要件】
1. **200文字程度**で簡潔に
2. ストーリーと場所の様子を説明。まず対面なのか電話なのかビデオ通話なのか書くこと。ストーリーにはセリフそのものは含めず、画像の生成に必要な背景の情報などを描くこと。
3. 1コマ目と2コマ目で何が起こるかを簡潔に。画像生成AIが1コマ目に何を描くべきか、2コマ目に何を描くべきか迷わないように明確に言語化すること。
4. 1コマ目と2コマ目で「何が起こらないか」も簡潔に書くこと。(例: まだ男性は塩を持っていない、まだコーヒーは席に届いていない、まだテーブルには何もない)
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
async function createIncorrectOptions(
  japaneseSentence: string,
  isKids = false,
): Promise<{
  result: string[];
  tokenUsage: TokenUsage;
} | null> {
  console.log(`  🎯 誤答選択肢を生成中...`);

  const prompt = `以下の「正解の日本語文」に対して、誤答選択肢を3つ生成してください。クイズ用に使用します。

【正解の日本語文】
${japaneseSentence}

【誤答選択肢の構成（必須）】
1つ目: **馬鹿馬鹿しい選択肢**
  - 笑ってしまうような、ありえない内容
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

/**
 * OpenAI APIを使ってシーンの下書きを作成
 */
async function createSceneDraft(
  {
    value,
    genre,
  }: {
    value: string;
    genre: 'ビジネス' | '日常生活';
  },
  isKids = false,
): Promise<{
  result: SceneDraft;
  tokenUsage: TokenUsage;
} | null> {
  console.log(`  🎬 「${value}」のシーン生成中...`);

  const taimen =
    Math.random() < 0.5
      ? '電話やビデオ通話も積極的に使用して良い。'
      : '基本的には対面を想定しているが、';

  const isDailyLifeGenre = genre === '日常生活';
  const adultRoleExamples = isDailyLifeGenre
    ? '友人、家族、店員、隣人、ルームメイトなど'
    : '上司、同僚、部下、取引先の担当者など';
  const adultWhereExamples = isDailyLifeGenre
    ? '自宅のリビング、駅のホーム、駅の券売機前、カフェ、スーパーのレジ前、病院の受付、公園、学校の教室、教室の前など'
    : 'オフィスの自席、会議室、応接室、取引先のオフィス、社内カフェテリア、会議室の前、オフィスの受付、オフィスの廊下など';

  const adultJsonExample = isDailyLifeGenre
    ? `\`\`\`json
{
  "word": "I'm thirsty",
  "sender": {
    "why": "喉が渇いたので飲み物を買いたいということを伝えたい",
    "role": "友人",
    "gender": "male",
    "where": "コンビニの前"
  },
  "how": "対面",
  "receiver": {
    "role": "友人",
    "gender": "female",
    "where": "コンビニの前"
  },
  "when": "土曜の午後"
}
\`\`\``
    : `\`\`\`json
{
  "word": "remote work",
  "sender": {
    "why": "リモートワークが可能だということを部下に伝えたい",
    "role": "上司",
    "gender": "male",
    "where": "オフィスの自席"
  },
  "how": "対面",
  "receiver": {
    "role": "部下",
    "gender": "female",
    "where": "上司の自席の近く"
  },
  "when": "月曜の午後"
}
\`\`\``;

  const prompt = isKids
    ? `「${value}」というワード・フレーズを使って、日常生活の会話シーンを作成してください。中学1年生の英語の教科書に出てきそうな、簡単で身近なシーンにしてください。

【最重要ルール】
- このシーンから生まれる英文は「${value}」をそのまま使った5単語以内の短い一言になります。
- whyは「${value}」をそのまま口にする理由だけにしてください。余計な状況や追加の意図を盛り込まないこと。
- 例: "good morning" → why: "朝の挨拶をしたい"（○）、why: "朝の挨拶をして、今日の予定を確認したい"（×：余計）

【要件】
- sender: 送信者の情報（こちらが「${value}」というワードを使用する人物）
  - why: なぜこの発言をするのか（15文字程度）「${value}」という表現から必然的に導かれる動機を設定してください。できるだけシンプルに。（例: ワードが"good morning"なら「朝起きたので、挨拶をしたい」）
  - role: 役割（例: 友人、家族、先生、店員、クラスメート、父親、母親）※ビジネスシーンは禁止。**role が示す性別は gender と一致させること**（例: 父親→male、母親→female）
  - gender: 送信者の性別。必ず JSON では \`"male"\` または \`"female"\` のどちらか一方を文字列で設定すること
  - where: どこにいるか具体的に（例: 教室、自宅のリビング、コンビニのレジ前、公園）
- how: どのように会話するか（基本的に対面）**音声会話のみ想定。チャット、メール、LINEなどの文字ベースは禁止**
- receiver: 受信者の情報
  - role: 役割（例: 友人、家族、先生、店員、クラスメート）。**role が示す性別は gender と一致させること**
  - gender: 受信者の性別。必ず JSON では \`"male"\` または \`"female"\` のどちらか。**必ず sender.gender と逆**にすること（sender が male なら female、逆も同様）
  - where: どこにいるか具体的に（対面での会話の場合は、senderと同じ場所または近い場所にすること）
- when: いつ会話するか（例: 放課後、週末の午前、夕食の時間）
- word: 使用する単語・フレーズ（必ず「${value}」を設定）

【重要】以下のJSON形式で必ず回答してください（内容は参考例です）:

\`\`\`json
{
  "word": "good morning",
  "sender": {
    "why": "朝の挨拶をしたい",
    "role": "クラスメート",
    "gender": "male",
    "where": "教室の入り口"
  },
  "how": "対面",
  "receiver": {
    "role": "クラスメート",
    "gender": "female",
    "where": "教室の自分の席"
  },
  "when": "平日の朝"
}
\`\`\``
    : `「${value}」というワード・フレーズを使って、${genre}系の会話シーンを作成してください。TOEICのリスニング問題に出てきそうなシーンにしてください。

【要件】
- sender: 送信者の情報（こちらが「${value}」というワードを使用する人物）
  - why: なぜこの発言をするのか（20文字程度）「${value}」という表現から必然的に導かれる動機を設定してください。
  - role: 役割（例: ${adultRoleExamples}）。**role が示す性別があれば gender と一致させること**（例: 父親なら male、母親なら female、男性の上司なら male）
  - gender: 送信者の性別。必ず JSON では \`"male"\` または \`"female"\` のどちらか一方を文字列で設定すること
  - where: どこにいるか具体的に（例: ${adultWhereExamples}）
- how: どのように会話するか（例: 対面、電話、ビデオ通話。${taimen}シーンにあった手段を設定してください）**音声会話のみ想定。チャット、メール、LINEなどの文字ベースは禁止**
- receiver: 受信者の情報
  - role: 役割（例: ${adultRoleExamples}）。**role が示す性別があれば gender と一致させること**
  - gender: 受信者の性別。必ず JSON では \`"male"\` または \`"female"\` のどちらか。**必ず sender.gender と逆**にすること
  - where: どこにいるか具体的に（例: ${adultWhereExamples}）（対面での会話の場合は、senderと同じ場所または近い場所にすること）
- when: いつ会話するか（例: 金曜の午後、平日の夕方、深夜、平日の昼）
- word: 使用する単語・フレーズ（必ず「${value}」を設定）

【重要】以下のJSON形式で必ず回答してください（内容は参考例です）:

${adultJsonExample}`;

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
      (result.sender.gender !== 'male' && result.sender.gender !== 'female') ||
      !result.receiver?.role ||
      !result.receiver?.where ||
      (result.receiver.gender !== 'male' && result.receiver.gender !== 'female')
    ) {
      throw new Error('レスポンスの形式が正しくありません');
    }

    if (result.sender.gender === result.receiver.gender) {
      throw new Error('sender.gender と receiver.gender は逆の性別である必要があります');
    }

    // receiver.whyを固定値で上書き
    result.receiver.why = '相手の言葉を受け取って、具体的な反応を返したい';

    return {
      result,
      tokenUsage: {
        input_tokens: response.usage?.input_tokens ?? 0,
        output_tokens: response.usage?.output_tokens ?? 0,
      },
    };
  } catch (error) {
    console.error(`  ❌ シーン生成に失敗しました:`, error instanceof Error ? error.message : error);
    return null;
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

  const prompt = `以下の英語の単語・フレーズが「ビジネス」シーンでよく使われる単語か「日常生活」シーンでよく使われる単語かを判定してください。迷ったら「日常生活」に分類してください。

単語リスト:
${words.map((word, index) => `${index + 1}. ${word}`).join('\n')}

【判定基準】
- ビジネス: 仕事、会議、オフィス、ビジネスメールなどで主に使われる
- 日常生活: 友人や家族との会話、食事、旅行、趣味、プライベートな場面で主に使われる

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
    console.log(result);
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
 * シーンドラフトから完成した問題データを生成
 */
async function generateProblemFromSceneDraft(
  sceneDraft: SceneDraftWithVoice,
  wordRange: { min: number; max: number; note?: string },
  problemIndex: number,
  isKids = false,
): Promise<{
  result: {
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
  };
  tokenUsage: TokenUsage;
} | null> {
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  // 1. 英会話生成
  const conversationResult = await createEnglishConversation(sceneDraft, wordRange, isKids);
  if (!conversationResult) {
    console.error(`  ⏭️ 「${sceneDraft.word}」をスキップします（英会話生成失敗）`);
    return null;
  }
  totalInputTokens += conversationResult.tokenUsage.input_tokens;
  totalOutputTokens += conversationResult.tokenUsage.output_tokens;

  const mergedData = {
    when: sceneDraft.when,
    how: sceneDraft.how,
    word: sceneDraft.word,
    sender: {
      ...sceneDraft.sender,
      englishSentence: conversationResult.result.englishSentence,
    },
    receiver: {
      ...sceneDraft.receiver,
      englishReply: conversationResult.result.englishReply,
    },
  };

  // 2. 日本語会話生成
  const japaneseResult = await createJapaneseConversation(mergedData);
  if (!japaneseResult) {
    console.error(`  ⏭️ 「${sceneDraft.word}」をスキップします（日本語会話生成失敗）`);
    return null;
  }
  totalInputTokens += japaneseResult.tokenUsage.input_tokens;
  totalOutputTokens += japaneseResult.tokenUsage.output_tokens;

  const dataWithJapanese = {
    ...mergedData,
    sender: {
      ...mergedData.sender,
      japaneseSentence: japaneseResult.result.japaneseSentence,
    },
    receiver: {
      ...mergedData.receiver,
      japaneseReply: japaneseResult.result.japaneseReply,
    },
  };

  // 3. シーンプロンプト生成
  const scenePromptResult = await createScenePrompt(dataWithJapanese);
  if (!scenePromptResult) {
    console.error(`  ⏭️ 「${sceneDraft.word}」をスキップします（シーンプロンプト生成失敗）`);
    return null;
  }
  totalInputTokens += scenePromptResult.tokenUsage.input_tokens;
  totalOutputTokens += scenePromptResult.tokenUsage.output_tokens;

  const dataWithScenePrompt = {
    ...dataWithJapanese,
    scenePrompt: scenePromptResult.result.scenePrompt,
  };

  // 4. 誤答選択肢生成
  const incorrectOptionsResult = await createIncorrectOptions(
    dataWithScenePrompt.sender.japaneseSentence,
    isKids,
  );
  if (!incorrectOptionsResult) {
    console.error(`  ⏭️ 「${sceneDraft.word}」をスキップします（誤答選択肢生成失敗）`);
    return null;
  }
  totalInputTokens += incorrectOptionsResult.tokenUsage.input_tokens;
  totalOutputTokens += incorrectOptionsResult.tokenUsage.output_tokens;

  // 5. incorrectOptionsの長さを調整
  const adjustedOptionsResult = await adjustIncorrectOptionsLength(
    incorrectOptionsResult.result,
    dataWithScenePrompt.sender.japaneseSentence,
    problemIndex,
  );
  totalInputTokens += adjustedOptionsResult.tokenUsage.input_tokens;
  totalOutputTokens += adjustedOptionsResult.tokenUsage.output_tokens;

  return {
    result: {
      ...dataWithScenePrompt,
      incorrectOptions: adjustedOptionsResult.result,
    },
    tokenUsage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
  };
}

/**
 * 単語リストからシーンドラフトを生成
 */
async function generateSceneDrafts(
  wordsWithGenres: { value: string; genre: 'ビジネス' | '日常生活' }[],
  isKids = false,
): Promise<{
  sceneDrafts: (SceneDraftWithVoice | null)[];
  tokenUsage: TokenUsage;
}> {
  console.log('🎬 シーンドラフト生成開始...\n');

  const sceneDrafts: (SceneDraftWithVoice | null)[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const wordWithGenre of wordsWithGenres) {
    const sceneDraftResult = await createSceneDraft(wordWithGenre, isKids);
    console.log('sceneDraftResult');
    console.log(sceneDraftResult);

    if (!sceneDraftResult) {
      console.error(`  ⏭️ 「${wordWithGenre.value}」のシーン生成に失敗したためスキップします`);
      sceneDrafts.push(null);
      continue;
    }

    const { gender: senderGender, ...senderRest } = sceneDraftResult.result.sender;
    const { gender: receiverGender, ...receiverRest } = sceneDraftResult.result.receiver;

    const sceneDraftWithVoice: SceneDraftWithVoice = {
      ...sceneDraftResult.result,
      sender: {
        ...senderRest,
        voice: senderGender,
      },
      receiver: {
        ...receiverRest,
        voice: receiverGender,
      },
    };

    sceneDrafts.push(sceneDraftWithVoice);
    totalInputTokens += sceneDraftResult.tokenUsage.input_tokens;
    totalOutputTokens += sceneDraftResult.tokenUsage.output_tokens;
  }

  return {
    sceneDrafts,
    tokenUsage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
  };
}

/**
 * 従来モード: 各単語から1問生成
 */
async function generateProblemsInSingleMode(
  sceneDrafts: (SceneDraftWithVoice | null)[],
  problemType: ProblemLength,
  isKids = false,
): Promise<{
  problems: Array<{
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
  }>;
  skippedIndices: Set<number>;
  tokenUsage: TokenUsage;
}> {
  const wordRange = WORD_COUNT_RULES[problemType];
  console.log(`💬 ${problemType} モードで問題生成中...\n`);

  const problems = [];
  const skippedIndices = new Set<number>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (const [index, sceneDraft] of sceneDrafts.entries()) {
    if (!sceneDraft) {
      skippedIndices.add(index);
      continue;
    }

    const problemResult = await generateProblemFromSceneDraft(
      sceneDraft,
      wordRange,
      index + 1,
      isKids,
    );

    if (!problemResult) {
      skippedIndices.add(index);
      continue;
    }

    problems.push(problemResult.result);
    totalInputTokens += problemResult.tokenUsage.input_tokens;
    totalOutputTokens += problemResult.tokenUsage.output_tokens;
  }

  return {
    problems,
    skippedIndices,
    tokenUsage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
  };
}

/**
 * ALLモード: 各単語から3問（short/medium/long）生成
 */
async function generateProblemsInAllMode(sceneDrafts: (SceneDraftWithVoice | null)[]): Promise<{
  problems: Array<{
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
  }>;
  skippedIndices: Set<number>;
  tokenUsage: TokenUsage;
}> {
  console.log('💬 ALL モードで問題生成中（各単語から3問）...\n');

  const problems = [];
  const skippedIndices = new Set<number>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let problemIndex = 1;

  for (const [wordIndex, sceneDraft] of sceneDrafts.entries()) {
    if (!sceneDraft) {
      skippedIndices.add(wordIndex);
      continue;
    }

    console.log(
      `\n========== ${wordIndex + 1}/${sceneDrafts.length}: "${sceneDraft.word}" ==========`,
    );

    const types: ProblemLength[] = ['short', 'medium', 'long'];
    let wordSkipped = false;

    for (const type of types) {
      console.log(`  📝 [${type}] 問題生成中...`);
      const wordRange = WORD_COUNT_RULES[type];

      const problemResult = await generateProblemFromSceneDraft(
        sceneDraft,
        wordRange,
        problemIndex,
      );

      if (!problemResult) {
        wordSkipped = true;
        break;
      }

      problems.push(problemResult.result);
      totalInputTokens += problemResult.tokenUsage.input_tokens;
      totalOutputTokens += problemResult.tokenUsage.output_tokens;
      problemIndex++;

      console.log(`  ✅ [${type}] 完了`);
    }

    if (wordSkipped) {
      skippedIndices.add(wordIndex);
    }
  }

  return {
    problems,
    skippedIndices,
    tokenUsage: {
      input_tokens: totalInputTokens,
      output_tokens: totalOutputTokens,
    },
  };
}

/**
 * 共通の後処理（統計・保存・クリーンアップ）
 */
async function finalizeAndSave(
  problems: Array<{
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
  successfulWords: readonly string[],
  skippedWords: readonly string[],
  tokenUsage: TokenUsage,
  isKids = false,
  useSeed = false,
): Promise<void> {
  const totalProblems = problems.length;

  // incorrectOptionsの長さをチェック
  let allLongerCount = 0;
  let allShorterCount = 0;

  for (const result of problems) {
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
  if (tokenUsage.input_tokens > 0 || tokenUsage.output_tokens > 0) {
    console.log('\n📊 トークン使用量:');
    console.log(`  入力トークン（合計）: ${tokenUsage.input_tokens}`);
    console.log(`  出力トークン（合計）: ${tokenUsage.output_tokens}`);

    // 1問あたりの平均トークン数
    const avgInputTokens = Math.round(tokenUsage.input_tokens / totalProblems);
    const avgOutputTokens = Math.round(tokenUsage.output_tokens / totalProblems);

    console.log(`\n  📊 1問あたりの平均:`);
    console.log(`    入力トークン: ${avgInputTokens}`);
    console.log(`    出力トークン: ${avgOutputTokens}`);
  }

  // incorrectOptionsの統計を表示
  console.log('\n📏 incorrectOptionsの長さチェック:');
  console.log(`  長い選択肢ばっか！: ${allLongerCount}件`);
  console.log(`  短い選択肢ばっか！: ${allShorterCount}件`);
  console.log(`  適切な長さ: ${totalProblems - allLongerCount - allShorterCount}件`);

  // SeedProblemDataに変換
  console.log('\n📦 SeedProblemDataに変換中...');
  const seedProblems = convertToSeedProblemData(problems, isKids);

  const lastWord = successfulWords.length > 0 ? successfulWords[successfulWords.length - 1] : null;

  if (useSeed) {
    // --seed フラグ: ファイルを作らず直接 DB 投入（成功後に LATEST_USED_WORD も更新）
    console.log('🌱 DB に直接投入します...');
    if (lastWord) {
      await seedToDatabase(seedProblems, lastWord);
    }
  } else {
    // 通常モード: ファイルに保存してから手動で db:seed する
    const fileNumber = getNextProblemNumber();
    console.log(`💾 ファイルを保存中... (problem${fileNumber}.ts)`);
    const savedPath = saveProblemFile(seedProblems, fileNumber);
    console.log(`✅ 保存完了: ${savedPath}\n`);

    // LATEST_USED_WORD を DB に保存
    if (lastWord) {
      await updateLatestUsedWord(lastWord);
    }

    console.log(`\n次のステップ:`);
    console.log(`  1. 生成されたファイルを確認してください`);
    console.log(`  2. npm run db:seed ${savedPath} でデータベースに登録できます`);
  }

  // スキップされた単語のサマリー
  if (skippedWords.length > 0) {
    console.log(`\n⚠️ スキップされた単語: ${skippedWords.length}個`);
    for (const word of skippedWords) {
      console.log(`  - ${word}`);
    }
    console.log('  （これらの単語はwords.tsに残されます。次回再実行してください）');
  }

  console.log('🧹 使用済み語彙をwords.tsから削除中...');
  removeUsedWordsFromWordList(successfulWords);

  console.log(`\n🎉 完了！${successfulWords.length}単語から${totalProblems}問を生成しました`);
  if (skippedWords.length > 0) {
    console.log(`⏭️ ${skippedWords.length}単語はAPI失敗のためスキップされました`);
  }
  console.log(`📚 残りの単語数: ${words.length - successfulWords.length}個`);
}

/**
 * CLI 引数をパースする
 * --type=<short|medium|long|all|kids>
 * --count=<n>
 * --seed  生成後に直接 DB 投入する（LATEST_USED_WORD も DB で管理）
 */
function parseCliArgs(): {
  type: ProblemLength | 'all';
  count: number;
  seed: boolean;
} | null {
  const args = process.argv.slice(2);
  const typeArg = args.find((a) => a.startsWith('--type='))?.split('=')[1];
  const countArg = args.find((a) => a.startsWith('--count='))?.split('=')[1];

  if (!typeArg || !countArg) return null;

  const validTypes = ['short', 'medium', 'long', 'all', 'kids'] as const;
  const type = (validTypes.find((t) => t === typeArg) ?? 'medium') as ProblemLength | 'all';
  const count = Math.max(1, parseInt(countArg, 10) || 1);
  const seed = args.includes('--seed');

  return { type, count, seed };
}

/**
 * LATEST_USED_WORD に基づいて words 配列の開始インデックスを返す
 */
function resolveStartIndex(startAfter: string | null): number {
  if (!startAfter) return 0;
  const idx = words.indexOf(startAfter);
  if (idx === -1) {
    console.log(
      `⚠️ LATEST_USED_WORD "${startAfter}" が words に見つかりません。先頭から使用します。`,
    );
    return 0;
  }
  return idx + 1;
}

/**
 * SeedProblemData を直接 DB に投入し、成功後に LATEST_USED_WORD を更新する（--seed フラグ用）
 */
async function seedToDatabase(seedProblems: SeedProblemData[], lastWord: string): Promise<void> {
  // problem.createMany は withAccelerate 経由で、appConfig は生の PrismaClient で操作
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

    console.log(
      `✅ DB投入完了: ${result.count}件挿入 (重複スキップ: ${createData.length - result.count}件)`,
    );

    // 投入成功後に LATEST_USED_WORD を更新
    await rawPrisma.appConfig.upsert({
      where: { key: 'LATEST_USED_WORD' },
      update: { value: lastWord },
      create: { key: 'LATEST_USED_WORD', value: lastWord },
    });
    console.log(`🔖 LATEST_USED_WORD を "${lastWord}" に更新しました`);
  } finally {
    await rawPrisma.$disconnect();
  }
}

/**
 * DB から LATEST_USED_WORD を読む
 */
async function getLatestUsedWord(): Promise<string | null> {
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    const config = await prisma.appConfig.findUnique({
      where: { key: 'LATEST_USED_WORD' },
    });
    return config?.value ?? null;
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * DB に LATEST_USED_WORD を保存する（通常モード用）
 */
async function updateLatestUsedWord(word: string): Promise<void> {
  const prisma = new PrismaClient({ log: ['error'] });
  try {
    await prisma.appConfig.upsert({
      where: { key: 'LATEST_USED_WORD' },
      update: { value: word },
      create: { key: 'LATEST_USED_WORD', value: word },
    });
    console.log(`🔖 LATEST_USED_WORD を "${word}" に更新しました`);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * ユーザーに問題タイプと問題数を選択させる
 */
async function promptProblemSettings(): Promise<{ type: ProblemLength | 'all'; count: number }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('\n問題の英文の語数タイプを選択してください:');
    console.log(`  1. short  (${WORD_COUNT_RULES.short.min}-${WORD_COUNT_RULES.short.max}単語)`);
    console.log(`  2. medium (${WORD_COUNT_RULES.medium.min}-${WORD_COUNT_RULES.medium.max}単語)`);
    console.log(`  3. long   (${WORD_COUNT_RULES.long.min}-${WORD_COUNT_RULES.long.max}単語)`);
    console.log(`  4. all    (short + medium + long を一度に生成)`);
    console.log(
      `  5. kids   (${WORD_COUNT_RULES.kids.min}-${WORD_COUNT_RULES.kids.max}単語 / 中学1年レベルの日常会話のみ)`,
    );
    console.log('');

    rl.question('選択してください [1/2/3/4/5]: ', (typeAnswer) => {
      const trimmed = typeAnswer.trim();
      let selectedType: ProblemLength | 'all';

      if (trimmed === '1' || trimmed.toLowerCase() === 'short') {
        selectedType = 'short';
      } else if (trimmed === '2' || trimmed.toLowerCase() === 'medium') {
        selectedType = 'medium';
      } else if (trimmed === '3' || trimmed.toLowerCase() === 'long') {
        selectedType = 'long';
      } else if (trimmed === '4' || trimmed.toLowerCase() === 'all') {
        selectedType = 'all';
      } else if (trimmed === '5' || trimmed.toLowerCase() === 'kids') {
        selectedType = 'kids';
      } else {
        console.log('無効な選択です。デフォルトの medium を使用します。\n');
        selectedType = 'medium';
      }

      const maxCount = words.length;

      rl.question(`\n何問生成しますか？ [最大: ${maxCount}]: `, (countAnswer) => {
        rl.close();

        const countTrimmed = countAnswer.trim();
        let count: number;

        if (countTrimmed === '') {
          count = 1;
        } else {
          const parsed = parseInt(countTrimmed, 10);
          if (isNaN(parsed) || parsed < 1) {
            console.log(`無効な入力です。1単語を使用します。\n`);
            count = 1;
          } else if (parsed > maxCount) {
            console.log(`指定された数が多すぎます。最大値 ${maxCount} を使用します。`);
            count = maxCount;
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
  isKids = false,
): SeedProblemData[] {
  return completeResults.map((result) => {
    return {
      place: result.sender.where,
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
      difficultyLevel: isKids ? 1 : null,
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

    // 1. 初期設定：CLI引数がある場合はスキップ、なければ対話プロンプト
    const cliArgs = parseCliArgs();
    const { type: problemType, count } = cliArgs ?? (await promptProblemSettings());
    const useSeed = cliArgs?.seed ?? false;

    // DB から LATEST_USED_WORD を読んで開始位置を決める
    const startAfter = await getLatestUsedWord();
    if (startAfter) {
      console.log(`📍 LATEST_USED_WORD: "${startAfter}"`);
    } else {
      console.log('📍 LATEST_USED_WORD: 未設定（先頭から使用）');
    }

    // モード表示
    if (problemType === 'all') {
      console.log(`\n📌 ALL モード: ${count}単語から ${count * 3}問を生成します\n`);
    } else {
      const wordRange = WORD_COUNT_RULES[problemType];
      console.log(
        `\n📌 ${problemType} モード (${wordRange.min}-${wordRange.max}単語): ${count}問を生成します\n`,
      );
    }

    // 指定された数の単語を取得（LATEST_USED_WORD で開始位置を決める）
    const startIndex = resolveStartIndex(startAfter);
    if (startAfter) {
      console.log(`📍 開始位置: index ${startIndex} ("${startAfter}" の次)`);
    }
    const selectedWords = words.slice(startIndex, startIndex + count);
    const isKids = problemType === 'kids';

    // ジャンル分けを実行（kids は全て日常生活に固定）
    let wordsWithGenres: { value: string; genre: 'ビジネス' | '日常生活' }[];
    let genreTokenUsage: TokenUsage;

    if (isKids) {
      wordsWithGenres = selectedWords.map((w) => ({ value: w, genre: '日常生活' as const }));
      genreTokenUsage = { input_tokens: 0, output_tokens: 0 };
      console.log('🧒 kids モード: ジャンル分けをスキップし、全て日常生活に固定します');
    } else {
      const genreResult = await wordsToGenres(selectedWords);
      wordsWithGenres = genreResult.result;
      genreTokenUsage = genreResult.tokenUsage;
    }

    console.log(`\n📝 取得した${count}個の単語:\n`);

    // 2. シーンドラフト生成（共通）
    const { sceneDrafts, tokenUsage: sceneDraftTokenUsage } = await generateSceneDrafts(
      wordsWithGenres,
      isKids,
    );

    let totalInputTokens = genreTokenUsage.input_tokens + sceneDraftTokenUsage.input_tokens;
    let totalOutputTokens = genreTokenUsage.output_tokens + sceneDraftTokenUsage.output_tokens;

    // 3. モード別の問題生成
    let allProblems;
    let problemTokenUsage;
    let skippedIndices: Set<number>;

    if (problemType === 'all') {
      // ALLモード: 各単語から3問
      const result = await generateProblemsInAllMode(sceneDrafts);
      allProblems = result.problems;
      problemTokenUsage = result.tokenUsage;
      skippedIndices = result.skippedIndices;
    } else {
      // 従来モード / kidsモード: 各単語から1問
      const result = await generateProblemsInSingleMode(sceneDrafts, problemType, isKids);
      allProblems = result.problems;
      problemTokenUsage = result.tokenUsage;
      skippedIndices = result.skippedIndices;
    }

    totalInputTokens += problemTokenUsage.input_tokens;
    totalOutputTokens += problemTokenUsage.output_tokens;

    // 成功/スキップの単語を分類
    const successfulWords = selectedWords.filter((_, i) => !skippedIndices.has(i));
    const skippedWords = selectedWords.filter((_, i) => skippedIndices.has(i));

    // 4. 共通の後処理（統計・保存・クリーンアップ）
    await finalizeAndSave(
      allProblems,
      successfulWords,
      skippedWords,
      {
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
      },
      isKids,
      useSeed,
    );
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
