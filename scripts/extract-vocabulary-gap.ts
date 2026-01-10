#!/usr/bin/env tsx

/**
 * 問題から中学2年生レベルを超える単語・イディオムを抽出し、
 * より簡単な問題セットに登場しない語彙のギャップを分析するスクリプト
 *
 * 使用例:
 *   npm run extract:vocabulary-gap
 *   → ターミナルで選択肢を選んで実行
 */

import { prisma } from '../src/lib/prisma';
import { WORD_COUNT_RULES, type ProblemLength } from '../src/config/problem';
import OpenAI from 'openai';
import * as readline from 'readline/promises';
import * as fs from 'fs';
import * as path from 'path';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type Problem = {
  id: string;
  englishSentence: string;
  englishReply: string;
  wordCount: number;
};

type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

/**
 * ユーザーに選択肢を表示して選ばせる
 */
async function promptChoice(
  question: string,
  choices: { value: string; label: string }[],
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`\n${question}`);
  choices.forEach((choice, index) => {
    console.log(`  ${index + 1}. ${choice.label}`);
  });

  let answer: string | undefined;
  while (!answer) {
    const input = await rl.question('\n選択してください (番号): ');
    const index = parseInt(input.trim(), 10) - 1;

    if (index >= 0 && index < choices.length) {
      answer = choices[index].value;
    } else {
      console.log('❌ 無効な選択です。もう一度入力してください。');
    }
  }

  rl.close();
  return answer;
}

/**
 * docs/words.ts から既存の語彙配列を読み込む
 */
function loadExistingWords(): string[] {
  const wordsFilePath = path.join(process.cwd(), 'docs', 'words.ts');

  if (!fs.existsSync(wordsFilePath)) {
    return [];
  }

  const content = fs.readFileSync(wordsFilePath, 'utf-8');

  // export const words: string[] = [...]; の配列部分を抽出
  const match = content.match(/export const words: string\[\] = (\[[\s\S]*?\]);/);
  if (!match) {
    return [];
  }

  try {
    // JSON.parseで配列を取得
    const arrayStr = match[1];
    return JSON.parse(arrayStr) as string[];
  } catch (error) {
    console.warn('⚠️  既存のwords.tsの読み込みに失敗しました。空の配列として扱います。');
    return [];
  }
}

/**
 * docs/words.ts に語彙配列を保存する
 */
function saveWords(words: string[]): void {
  const wordsFilePath = path.join(process.cwd(), 'docs', 'words.ts');

  // 配列をフォーマット（インデント付き）
  const formattedArray = JSON.stringify(words, null, 2);

  const content = `export const words: string[] = ${formattedArray};\n`;

  fs.writeFileSync(wordsFilePath, content, 'utf-8');
  console.log(`\n💾 docs/words.ts に保存しました（${words.length}個の語彙）`);
}

/**
 * 問題文から中学2年生レベルを超える単語・イディオムを抽出
 */
async function extractAdvancedVocabulary(
  problems: Problem[],
): Promise<{ vocabulary: string[]; tokenUsage: TokenUsage }> {
  console.log(`  ${problems.length}問を処理中...`);

  // 問題文のリストを作成
  const problemTexts = problems.map((p, idx) => {
    return `${idx + 1}. 問題文: ${p.englishSentence}\n   返答: ${p.englishReply}`;
  });

  const prompt = `以下の英会話問題から、日本の中学2年生レベルを超える（高校生以上で学ぶ）単語・イディオムを全て抽出してください。

【判定基準】
- 中学2年生までに習う基本的な単語（be動詞、一般動詞、基本名詞など）は除外
- 高校英語以上で学ぶ単語、熟語、イディオムのみを抽出
- イディオムは意味のある単位で抽出（例: "take care of", "on behalf of"）
- イディオムは実際に出現した形のまま抽出すること（基本形に変換しない）
  例: "He is in charge of" → "is in charge of" （"be in charge of" ではない）
  例: "They are aware of" → "are aware of" （"be aware of" ではない）
- 単語も実際に出現した形のまま抽出すること
  例: "goes" → "goes" （"go" に変換しない）
  例: "running" → "running" （"run" に変換しない）
- 冠詞（a, an, the）、前置詞単体、接続詞単体は除外

【問題リスト】
${problemTexts.join('\n\n')}

【出力形式】
中学2年生レベルを超える単語・イディオムのみをJSON配列形式で出力してください。
実際に出現した形のまま抽出し、重複は除外してください。
出力例: ["abandon", "accomplishes", "is aware of", "is in charge of", "took advantage of"]

JSON配列のみを出力し、説明文は不要です。`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1,
    });

    const content = response.choices[0].message.content?.trim() || '[]';

    // JSON部分のみを抽出（```json ... ``` で囲まれている場合に対応）
    let jsonContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    } else {
      const arrayMatch = content.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        jsonContent = arrayMatch[0];
      }
    }

    const vocabulary = JSON.parse(jsonContent) as string[];

    // トークン使用量を取得
    const tokenUsage: TokenUsage = {
      promptTokens: response.usage?.prompt_tokens || 0,
      completionTokens: response.usage?.completion_tokens || 0,
      totalTokens: response.usage?.total_tokens || 0,
    };

    console.log(`  ✓ ${vocabulary.length}個の語彙を抽出`);
    console.log(
      `  📊 トークン: ${tokenUsage.totalTokens} (入力: ${tokenUsage.promptTokens}, 出力: ${tokenUsage.completionTokens})`,
    );

    return { vocabulary, tokenUsage };
  } catch (error) {
    console.error(`  ❌ 抽出エラー:`, error);
    return {
      vocabulary: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
  }
}

async function main() {
  try {
    console.log('🔍 語彙ギャップ分析ツール\n');

    // パターンを選択
    const pattern = await promptChoice('どのパターンで分析しますか？', [
      { value: 'long-medium', label: 'long → medium（longの語彙でmediumに未登場のもの）' },
      { value: 'medium-short', label: 'medium → short（mediumの語彙でshortに未登場のもの）' },
    ]);

    let source: ProblemLength;
    let target: ProblemLength;

    if (pattern === 'long-medium') {
      source = 'long';
      target = 'medium';
    } else {
      source = 'medium';
      target = 'short';
    }

    console.log(`🔍 ${source}問題から語彙を抽出し、${target}に未登場のものを分析します...\n`);

    const sourceRule = WORD_COUNT_RULES[source];
    const targetRule = WORD_COUNT_RULES[target];
    console.log(`📏 ${source}問題の定義: ${sourceRule.min}〜${sourceRule.max}語`);
    console.log(`📏 ${target}問題の定義: ${targetRule.min}〜${targetRule.max}語\n`);

    // source問題を全て取得
    const sourceProblems = await prisma.problem.findMany({
      where: {
        wordCount: {
          gte: sourceRule.min,
          lte: sourceRule.max,
        },
      },
      select: {
        id: true,
        englishSentence: true,
        englishReply: true,
        wordCount: true,
      },
    });

    console.log(`📊 ${sourceProblems.length}個の${source}問題を取得しました\n`);

    if (sourceProblems.length === 0) {
      console.log(`⚠️  ${source}問題が見つかりませんでした`);
      return;
    }

    // バッチ処理（問題タイプに応じて最適化）
    const batchSize = source === 'long' ? 50 : 70; // longは30問、medium/shortは70問
    const batches: Problem[][] = [];

    for (let i = 0; i < sourceProblems.length; i += batchSize) {
      batches.push(sourceProblems.slice(i, i + batchSize));
    }

    console.log(`📦 バッチサイズ: ${batchSize}問/バッチ`);

    console.log(`🤖 OpenAI APIで語彙を抽出中... (${batches.length}バッチ)\n`);

    // Setで重複を自動排除
    const allVocabulary = new Set<string>();
    const totalTokenUsage: TokenUsage = {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
    };

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`📦 バッチ ${i + 1}/${batches.length}:`);

      const result = await extractAdvancedVocabulary(batch);
      result.vocabulary.forEach((word) => allVocabulary.add(word));

      // トークン使用量を累積
      totalTokenUsage.promptTokens += result.tokenUsage.promptTokens;
      totalTokenUsage.completionTokens += result.tokenUsage.completionTokens;
      totalTokenUsage.totalTokens += result.tokenUsage.totalTokens;

      // API rate limitを考慮して少し待機
      if (i < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    // 結果をソート
    const sortedVocabulary = Array.from(allVocabulary).sort((a, b) => {
      // 単語数でソート（単語→フレーズの順）
      const aWordCount = a.split(' ').length;
      const bWordCount = b.split(' ').length;
      if (aWordCount !== bWordCount) {
        return aWordCount - bWordCount;
      }
      // アルファベット順
      return a.localeCompare(b);
    });

    console.log(`\n✅ 中学2年生レベルを超える語彙: ${sortedVocabulary.length}個（重複排除済み）\n`);

    // トークン使用量の統計
    console.log('📊 トークン使用量統計:');
    console.log(`  入力トークン: ${totalTokenUsage.promptTokens.toLocaleString()}`);
    console.log(`  出力トークン: ${totalTokenUsage.completionTokens.toLocaleString()}`);
    console.log(`  合計トークン: ${totalTokenUsage.totalTokens.toLocaleString()}`);

    const inputCost = (totalTokenUsage.promptTokens / 1_000_000) * 1.75;
    const outputCost = (totalTokenUsage.completionTokens / 1_000_000) * 14.0;
    const totalCost = inputCost + outputCost;

    console.log(
      `  推定コスト (gpt-5.2): $${totalCost.toFixed(4)} (約${Math.ceil(totalCost * 150)}円)\n`,
    );

    // 結果を出力
    console.log('📋 抽出された語彙一覧:\n');
    console.log(JSON.stringify(sortedVocabulary, null, 2));

    // カテゴリ別に集計
    const singleWords = sortedVocabulary.filter((v) => !v.includes(' '));
    const phrases = sortedVocabulary.filter((v) => v.includes(' '));

    console.log('\n📊 カテゴリ別統計:');
    console.log(`  単語: ${singleWords.length}個`);
    console.log(`  イディオム: ${phrases.length}個`);

    // targetの問題に登場しない語彙を抽出
    console.log(`\n🔍 ${target}の問題をチェック中...\n`);

    const targetProblems = await prisma.problem.findMany({
      where: {
        wordCount: {
          gte: targetRule.min,
          lte: targetRule.max,
        },
      },
      select: {
        englishSentence: true,
        englishReply: true,
      },
    });

    console.log(`📊 ${targetProblems.length}個の${target}問題を取得しました\n`);

    // targetの全テキストを結合（検索用）
    const targetTexts = targetProblems
      .map((p) => `${p.englishSentence} ${p.englishReply}`)
      .join(' ')
      .toLowerCase();

    // targetに登場しない語彙をフィルタリング
    const notInTarget = sortedVocabulary.filter((vocab) => {
      const pattern = vocab.toLowerCase();
      return !targetTexts.includes(pattern);
    });

    console.log(
      `✅ ${target}に登場しない語彙: ${notInTarget.length}個 / ${sortedVocabulary.length}個\n`,
    );

    // 結果を出力
    console.log(`📋 ${target}に登場しない語彙一覧:\n`);
    console.log(JSON.stringify(notInTarget, null, 2));

    // 統計
    const notInTargetSingleWords = notInTarget.filter((v) => !v.includes(' '));
    const notInTargetPhrases = notInTarget.filter((v) => v.includes(' '));

    console.log(`\n📊 ${target}に登場しない語彙の統計:`);
    console.log(`  単語: ${notInTargetSingleWords.length}個`);
    console.log(`  イディオム: ${notInTargetPhrases.length}個`);

    // docs/words.ts に保存
    console.log('\n💾 docs/words.ts への保存を準備中...');

    const existingWords = loadExistingWords();
    console.log(`📂 既存の語彙数: ${existingWords.length}個`);

    // 既存の語彙と新規の語彙を統合（重複排除）
    const allWordsSet = new Set([...existingWords, ...notInTarget]);
    const allWords = Array.from(allWordsSet).sort((a, b) => {
      // 単語数でソート（単語→フレーズの順）
      const aWordCount = a.split(' ').length;
      const bWordCount = b.split(' ').length;
      if (aWordCount !== bWordCount) {
        return aWordCount - bWordCount;
      }
      // アルファベット順
      return a.localeCompare(b);
    });

    const newWordsCount = allWords.length - existingWords.length;
    console.log(`➕ 新規追加: ${newWordsCount}個`);
    console.log(`📊 合計: ${allWords.length}個`);

    // 保存
    saveWords(allWords);
  } catch (error) {
    console.error('❌ 処理中にエラーが発生しました:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

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
