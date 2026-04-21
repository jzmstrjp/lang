#!/usr/bin/env tsx

/**
 * long問題を分析し、TOEICリスニング問題に出てきそうだが
 * 現在不足している単語・イディオムを提案するスクリプト
 *
 * 使用例:
 *   npm run suggest:toeic-vocabulary
 */

import { prisma } from '../src/lib/prisma';
import { WORD_COUNT_RULES } from '../src/config/problem';
import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import { words as existingWords } from '../docs/words';
import { TEXT_MODEL } from '@/const';

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
 * 問題文を分析してTOEICに必要だが不足している語彙を提案
 */
async function suggestToeicVocabulary(
  problems: Problem[],
): Promise<{ vocabulary: string[]; tokenUsage: TokenUsage }> {
  console.log(`  ${problems.length}問を分析中...`);

  // 問題文のリストを作成
  const problemTexts = problems.map((p, idx) => {
    return `${idx + 1}. 問題文: ${p.englishSentence}\n   返答: ${p.englishReply}`;
  });

  const prompt = `以下の英会話問題を分析してください。

これらの問題を見て、TOEICリスニングセクション（Part 1-4）に頻出するが、これらの問題群にはまだ十分にカバーされていない単語・イディオムを提案してください。

【提案すべき語彙の条件】
- TOEICのListening SectionやReading Sectionで頻出する語彙
- できるだけ難しい単語・イディオム
- 実際のTOEIC試験対策として学習価値が高いもの
- 以下の問題群で既に扱われている語彙は避けること

【問題リスト】
${problemTexts.join('\n\n')}

【出力形式】
TOEICリスニング対策として追加すべき単語・イディオムをJSON配列形式で出力してください。
30〜50個程度を目安に提案してください。
出力例: ["invoice", "itinerary", "reimbursement", "is eligible for", "make arrangements"]

JSON配列のみを出力し、説明文は不要です。`;

  try {
    const response = await openai.chat.completions.create({
      model: TEXT_MODEL,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3, // 少し創造性を持たせる
    });

    const content = response.choices[0].message.content?.trim() || '[]';

    // JSON部分のみを抽出
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

    console.log(`  ✓ ${vocabulary.length}個の語彙を提案`);
    console.log(
      `  📊 トークン: ${tokenUsage.totalTokens} (入力: ${tokenUsage.promptTokens}, 出力: ${tokenUsage.completionTokens})`,
    );

    return { vocabulary, tokenUsage };
  } catch (error) {
    console.error(`  ❌ 提案エラー:`, error);
    return {
      vocabulary: [],
      tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    };
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

async function main() {
  try {
    console.log('🎯 TOEICリスニング対策語彙提案ツール\n');

    const longRule = WORD_COUNT_RULES.long;
    console.log(`📏 long問題の定義: ${longRule.min}〜${longRule.max}語\n`);

    // long問題を全て取得
    const longProblems = await prisma.problem.findMany({
      where: {
        wordCount: {
          gte: longRule.min,
          lte: longRule.max,
        },
      },
      select: {
        id: true,
        englishSentence: true,
        englishReply: true,
        wordCount: true,
      },
    });

    console.log(`📊 ${longProblems.length}個のlong問題を取得しました\n`);

    if (longProblems.length === 0) {
      console.log('⚠️  long問題が見つかりませんでした');
      return;
    }

    // バッチ処理（50問ずつ）
    const batchSize = 50;
    const batches: Problem[][] = [];

    for (let i = 0; i < longProblems.length; i += batchSize) {
      batches.push(longProblems.slice(i, i + batchSize));
    }

    console.log(`📦 バッチサイズ: ${batchSize}問/バッチ`);
    console.log(`🤖 OpenAI APIでTOEIC語彙を提案中... (${batches.length}バッチ)\n`);

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

      const result = await suggestToeicVocabulary(batch);
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

    // long問題に既に登場している語彙を除外
    console.log('\n🔍 long問題に既に登場している語彙をチェック中...\n');

    // longの全テキストを結合（検索用）
    const longTexts = longProblems
      .map((p) => `${p.englishSentence} ${p.englishReply}`)
      .join(' ')
      .toLowerCase();

    // longに登場していない語彙のみをフィルタリング
    const notInLong = Array.from(allVocabulary).filter((vocab) => {
      const pattern = vocab.toLowerCase();
      return !longTexts.includes(pattern);
    });

    console.log(`📊 提案された語彙: ${allVocabulary.size}個`);
    console.log(`❌ long問題に既に存在: ${allVocabulary.size - notInLong.length}個`);
    console.log(`✅ 本当に不足している語彙: ${notInLong.length}個\n`);

    // 結果をソート
    const sortedVocabulary = notInLong.toSorted((a, b) => {
      // 単語数でソート（単語→フレーズの順）
      const aWordCount = a.split(' ').length;
      const bWordCount = b.split(' ').length;
      if (aWordCount !== bWordCount) {
        return aWordCount - bWordCount;
      }
      // アルファベット順
      return a.localeCompare(b);
    });

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
    console.log('📋 本当に不足しているTOEIC語彙一覧:\n');
    console.log(JSON.stringify(sortedVocabulary, null, 2));

    // カテゴリ別に集計
    const singleWords = sortedVocabulary.filter((v) => !v.includes(' '));
    const phrases = sortedVocabulary.filter((v) => v.includes(' '));

    console.log('\n📊 カテゴリ別統計:');
    console.log(`  単語: ${singleWords.length}個`);
    console.log(`  イディオム: ${phrases.length}個`);

    // docs/words.ts に保存
    console.log('\n💾 docs/words.ts への保存を準備中...');
    console.log(`📂 既存の語彙数: ${existingWords.length}個`);

    // 既存の語彙と新規の語彙を統合（重複排除、末尾に追加）
    const existingWordsSet = new Set(existingWords);
    const newWords = sortedVocabulary.filter((word) => !existingWordsSet.has(word));
    const allWords = [...existingWords, ...newWords];

    const newWordsCount = allWords.length - existingWords.length;
    console.log(`➕ 新規追加: ${newWordsCount}個`);
    console.log(`📊 合計: ${allWords.length}個`);

    // 語数の少ない順でソート（単語→イディオム、同じ語数ならアルファベット順）
    const sortedAllWords = allWords.toSorted((a, b) => {
      const aWordCount = a.split(' ').length;
      const bWordCount = b.split(' ').length;
      if (aWordCount !== bWordCount) {
        return aWordCount - bWordCount;
      }
      return a.localeCompare(b);
    });

    // 保存
    saveWords(sortedAllWords);
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
