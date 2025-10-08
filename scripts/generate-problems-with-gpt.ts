#!/usr/bin/env tsx

/**
 * OpenAI GPT APIを使って問題データを生成するスクリプト
 */

import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// 環境変数を読み込み
dotenv.config();

// OpenAIクライアントを初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * プロンプトファイルを読み込む
 */
function loadPrompt(): string {
  const promptPath = path.join(process.cwd(), 'docs', 'prompt-for-qustion.md');

  if (!fs.existsSync(promptPath)) {
    throw new Error(`プロンプトファイルが見つかりません: ${promptPath}`);
  }

  return fs.readFileSync(promptPath, 'utf-8');
}

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
 * GPT APIを呼び出して問題を生成（会話履歴付き）
 */
async function generateProblemsWithHistory(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
): Promise<{ content: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4.1',
      messages,
      temperature: 0.7,
      max_tokens: 4000,
    });

    const content = response.choices[0]?.message?.content;

    if (!content) {
      throw new Error('GPTからのレスポンスが空です');
    }

    // 会話履歴に追加
    const updatedMessages = [
      ...messages,
      {
        role: 'assistant' as const,
        content,
      },
    ];

    return { content, messages: updatedMessages };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`GPT API呼び出しエラー: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 複数回のAPI呼び出しで30問を生成
 */
async function generateMultipleProblems(
  initialPrompt: string,
  rounds: number = 6,
): Promise<string[]> {
  const allCodes: string[] = [];
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    {
      role: 'user',
      content: initialPrompt,
    },
  ];

  // 最初の5問を生成
  console.log('🤖 1回目: 最初の5問を生成中...');
  let result = await generateProblemsWithHistory(messages);
  messages = result.messages;

  // コードを抽出
  const code1 = extractTypeScriptCode(result.content);
  validateGeneratedCode(code1);
  allCodes.push(code1);
  console.log('✅ 1回目完了 (5問生成)\n');

  // 残りの5回、「さらに5問お願いします」を繰り返す
  for (let i = 2; i <= rounds; i++) {
    console.log(`🤖 ${i}回目: さらに5問を生成中...`);

    // 会話履歴に「さらに5問お願いします」を追加
    messages.push({
      role: 'user',
      content: 'さらに5問お願いします',
    });

    result = await generateProblemsWithHistory(messages);
    messages = result.messages;

    // コードを抽出
    const code = extractTypeScriptCode(result.content);
    validateGeneratedCode(code);
    allCodes.push(code);
    console.log(`✅ ${i}回目完了 (累計${i * 5}問)\n`);

    // API制限を考慮して少し待機
    if (i < rounds) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return allCodes;
}

/**
 * GPTのレスポンスからTypeScriptコードブロックを抽出
 */
function extractTypeScriptCode(response: string): string {
  // TypeScriptまたはtsコードブロックを探す
  const codeBlockRegex = /```(?:typescript|ts)\n([\s\S]*?)```/i;
  const match = response.match(codeBlockRegex);

  if (!match || !match[1]) {
    throw new Error('レスポンスからTypeScriptコードブロックを抽出できませんでした');
  }

  return match[1].trim();
}

/**
 * 生成されたコードを検証
 */
function validateGeneratedCode(code: string): void {
  // 基本的な構文チェック
  if (!code.includes('{') || !code.includes('}')) {
    throw new Error('生成されたコードが不正です（オブジェクト構造が見つかりません）');
  }

  // 必須フィールドの存在確認
  const requiredFields = [
    'place',
    'senderRole',
    'senderVoice',
    'receiverRole',
    'receiverVoice',
    'englishSentence',
    'japaneseSentence',
    'englishReply',
    'japaneseReply',
    'incorrectOptions',
  ];

  for (const field of requiredFields) {
    if (!code.includes(field)) {
      throw new Error(`生成されたコードに必須フィールド "${field}" が見つかりません`);
    }
  }
}

/**
 * 英文の単語数を計算する
 */
function calculateWordCount(englishSentence: string): number {
  // 基本的な単語分割（空白、句読点を考慮）
  const words = englishSentence
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);

  return words.length;
}

/**
 * 保存したファイルから問題データを読み込んで単語数分布を分析
 */
async function analyzeAndDisplayWordCountDistribution(filePath: string): Promise<void> {
  try {
    // 動的にファイルをインポート
    const importedModule = await import(filePath);
    const problemData = importedModule.default || importedModule;

    if (!Array.isArray(problemData) || problemData.length === 0) {
      console.log('⚠️  問題データを読み込めませんでした');
      return;
    }

    const totalProblems = problemData.length;

    // 単語数ごとにカウント
    const wordCountMap = new Map<number, number>();

    problemData.forEach((problem: { englishSentence: string }) => {
      const wordCount = calculateWordCount(problem.englishSentence);
      wordCountMap.set(wordCount, (wordCountMap.get(wordCount) || 0) + 1);
    });

    // ソートして表示
    const sortedCounts = Array.from(wordCountMap.entries()).sort((a, b) => a[0] - b[0]);

    console.log('\n📊 単語数分布:');
    sortedCounts.forEach(([wordCount, count]) => {
      console.log(`  ${wordCount}単語: ${count}問`);
    });

    // 総計を表示
    console.log(`  合計: ${totalProblems}問`);

    // incorrectOptionsが日本文より短い問題数を集計
    const shorterIncorrectOptionsCount = problemData.reduce(
      (acc: number, problem: { japaneseSentence?: string; incorrectOptions?: string[] }) => {
        if (typeof problem.japaneseSentence !== 'string') {
          return acc;
        }

        if (!Array.isArray(problem.incorrectOptions) || problem.incorrectOptions.length === 0) {
          return acc;
        }

        const japaneseLength = problem.japaneseSentence.length;
        const allShorter = problem.incorrectOptions.every(
          (option) => typeof option === 'string' && option.length < japaneseLength,
        );

        return allShorter ? acc + 1 : acc;
      },
      0,
    );

    console.log('\n📝 incorrectOptionsが日本文より短い問題:');
    console.log(`  ${shorterIncorrectOptionsCount}件 / ${totalProblems}件`);

    const longerIncorrectOptionsCount = problemData.reduce(
      (acc: number, problem: { japaneseSentence?: string; incorrectOptions?: string[] }) => {
        if (typeof problem.japaneseSentence !== 'string') {
          return acc;
        }

        if (!Array.isArray(problem.incorrectOptions) || problem.incorrectOptions.length === 0) {
          return acc;
        }

        const japaneseLength = problem.japaneseSentence.length;
        const allLonger = problem.incorrectOptions.every(
          (option) => typeof option === 'string' && option.length > japaneseLength,
        );

        return allLonger ? acc + 1 : acc;
      },
      0,
    );

    console.log('\n📝 incorrectOptionsが日本文より長い問題:');
    console.log(`  ${longerIncorrectOptionsCount}件 / ${totalProblems}件`);
  } catch (error) {
    console.log(
      '⚠️  単語数分布の分析に失敗しました:',
      error instanceof Error ? error.message : error,
    );
  }
}

/**
 * 複数のコードブロックを結合
 */
function mergeProblemCodes(codes: string[]): string {
  return codes.join(',\n');
}

/**
 * 問題ファイルを保存
 */
function saveProblemFile(codes: string[], fileNumber: number, totalProblems: number): string {
  const problemDir = path.join(process.cwd(), 'problemData');
  const fileName = `problem${fileNumber}.ts`;
  const filePath = path.join(problemDir, fileName);

  const mergedCode = mergeProblemCodes(codes);

  // ファイル内容を構築
  const fileContent = `import { SeedProblemData } from '../src/types/problem';

/**
 * 問題データ ${fileNumber}
 * Generated by GPT API (${totalProblems} problems)
 */
const problemData: SeedProblemData[] = [
${mergedCode}
];

export default problemData;
`;

  // ファイルを保存
  fs.writeFileSync(filePath, fileContent, 'utf-8');

  return filePath;
}

/**
 * メイン処理
 */
async function main() {
  try {
    // コマンドライン引数から生成回数を取得（デフォルト: 6）
    const roundsArg = process.argv[2];
    const rounds = roundsArg ? parseInt(roundsArg, 10) : 6;

    // バリデーション
    if (isNaN(rounds) || rounds < 1) {
      throw new Error('生成回数は1以上の整数を指定してください');
    }

    const totalProblems = rounds * 5;

    console.log('🚀 問題生成スクリプト開始\n');
    console.log(`📌 ${totalProblems}問（5問×${rounds}回）を生成します\n`);

    // OpenAI API Keyの確認
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        'OPENAI_API_KEY環境変数が設定されていません。\n' +
          '.envファイルにOPENAI_API_KEY=your_api_keyを設定してください。',
      );
    }

    // プロンプトを読み込み
    console.log('📖 プロンプトを読み込み中...');
    const prompt = loadPrompt();
    console.log('✅ プロンプト読み込み完了\n');

    // 次のファイル番号を取得
    const fileNumber = getNextProblemNumber();
    console.log(`📝 生成ファイル: problem${fileNumber}.ts\n`);

    // 複数回APIを呼び出して問題を生成
    console.log('🔄 生成処理開始...\n');
    const allCodes = await generateMultipleProblems(prompt, rounds);

    console.log('✅ すべてのコード生成完了\n');

    // ファイルを保存
    console.log('💾 ファイルを保存中...');
    const savedPath = saveProblemFile(allCodes, fileNumber, totalProblems);
    console.log(`✅ 保存完了: ${savedPath}\n`);

    console.log(`🎉 問題生成完了！${totalProblems}問を生成しました`);

    // 単語数分布を表示
    await analyzeAndDisplayWordCountDistribution(savedPath);

    console.log('\n次のステップ:');
    console.log('  1. 生成されたファイルを確認してください');
    console.log(`  2. npm run db:seed ${savedPath} でデータベースに登録できます`);
    console.log('\n💡 ヒント:');
    console.log('  - 生成回数を変更: npm run generate:problems <回数>');
    console.log('  - 例: npm run generate:problems 10 (50問生成)');
  } catch (error) {
    console.error('\n❌ エラーが発生しました:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

// スクリプトが直接実行された場合のみmainを実行
if (require.main === module) {
  main()
    .then(() => {
      process.exit(0); // 正常終了
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1); // エラー終了
    });
}

export { main };
