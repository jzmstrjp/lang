#!/usr/bin/env tsx

/**
 * OpenAI GPT APIを使って問題データを生成するスクリプト
 */

import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import { places } from '../docs/for-prompt/scenes';

// 環境変数を読み込み
dotenv.config();

// OpenAIクライアントを初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROBLEMS_PER_ROUND = 3;
const DEFAULT_TOTAL_PROBLEMS = 30;

/**
 * 配列から重複なしでランダムに要素を取得
 */
function pickRandomUniqueItems<T>(source: T[], count: number): T[] {
  if (count > source.length) {
    throw new Error('ランダム抽出数が配列の要素数を超えています');
  }

  const shuffled = [...source];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, count);
}

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
 * words.mdに含まれる語彙リストを読み込む
 */
function loadWordsList(): string {
  const wordsPath = path.join(process.cwd(), 'docs', 'words.md');

  if (!fs.existsSync(wordsPath)) {
    throw new Error(`語彙リストが見つかりません: ${wordsPath}`);
  }

  return fs.readFileSync(wordsPath, 'utf-8');
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
    const formattedMessages = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await openai.responses.create({
      model: 'gpt-5',
      input: formattedMessages,
      // temperature: 0.7,
    });

    if (response.status === 'incomplete') {
      const detail = response.incomplete_details?.reason ?? 'unknown';
      console.error('raw_response', JSON.stringify(response, null, 2));
      throw new Error(`GPTからのレスポンスが完了しませんでした（reason: ${detail}）`);
    }

    const content = response.output_text;

    if (!content) {
      console.error('raw_response', JSON.stringify(response, null, 2));
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
 * 複数回のAPI呼び出しで問題を生成（3問ずつレビュー付き）
 */
async function generateMultipleProblems(initialPrompt: string, rounds: number): Promise<string[]> {
  const allCodes: string[] = [];
  let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
    {
      role: 'user',
      content: initialPrompt,
    },
  ];

  for (let i = 1; i <= rounds; i++) {
    const isFirstRound = i === 1;
    const totalGenerated = i * PROBLEMS_PER_ROUND;

    console.log(`🤖 ${i}回目: ${isFirstRound ? '最初の3問を生成中...' : 'さらに3問を生成中...'}`);
    const generationResult = await generateProblemsWithHistory(messages);
    messages = generationResult.messages;

    const draftCode = extractTypeScriptCode(generationResult.content);
    validateGeneratedCode(draftCode);

    console.log('🧐 レビュー依頼中...');
    messages.push({
      role: 'user',
      content: `以下の観点で批判的レビューをして、修正したJSONをください。
        
1. englishSentence: その場面でその役割の人が、本当にそんなセリフを言うか？もっと自然で適切な言い回しがあるのでは？
2. japaneseSentence: 場面や役割も考えて、englishSentenceの日本語訳として自然か？日本人ならもっと別の言い方をするのでは？
3. englishReply: その場面でその役割の人が、englishSentenceに対して本当にそんなセリフを返すか？もっと自然で適切な言い回しがあるのでは？
4. japaneseReply: 場面や役割も考えて、englishReplyの日本語訳として自然か？日本人ならもっと別の言い方をするのでは？
5. incorrectOptions: それぞれのセリフが、必ず異なる語から始まっているか？同じ語で始まる文は禁止です。

指摘点を踏まえた最終稿を、TypeScriptのコードブロックで3問分の配列要素だけ返してください。
        `,
    });

    const reviewResult = await generateProblemsWithHistory(messages);
    messages = reviewResult.messages;

    const reviewedCode = extractTypeScriptCode(reviewResult.content);
    validateGeneratedCode(reviewedCode);
    allCodes.push(reviewedCode);

    console.log(`✅ ${i}回目完了 (累計${totalGenerated}問)\n`);

    if (i < rounds) {
      messages.push({
        role: 'user',
        content: 'さらに3問お願いします。同じ条件と語彙リストを守ってください。',
      });

      // API制限を考慮して少し待機
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

    console.log('\n📝 短い選択肢ばっか！:');
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

    console.log('\n📝 長い選択肢ばっか！:');
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
    // コマンドライン引数から生成回数を取得（デフォルト: 約30問分を確保する回数）
    const roundsArg = process.argv[2];
    const rounds = roundsArg
      ? parseInt(roundsArg, 10)
      : Math.ceil(DEFAULT_TOTAL_PROBLEMS / PROBLEMS_PER_ROUND);

    // バリデーション
    if (isNaN(rounds) || rounds < 1) {
      throw new Error('生成回数は1以上の整数を指定してください');
    }

    const totalProblems = rounds * PROBLEMS_PER_ROUND;

    console.log('🚀 問題生成スクリプト開始\n');
    console.log(`📌 ${totalProblems}問（${PROBLEMS_PER_ROUND}問×${rounds}回）を生成します\n`);

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
    const wordsList = loadWordsList();
    const requiredPlaceCount = 3;

    if (PROBLEMS_PER_ROUND < requiredPlaceCount) {
      throw new Error(
        'PROBLEMS_PER_ROUNDは少なくとも3である必要があります（最初の3問の場所指定のため）。',
      );
    }

    const initialPlaces = pickRandomUniqueItems(places, requiredPlaceCount);
    const placeInstructionLines = initialPlaces
      .map((place, index) => `${index + 1}問目: ${place}`)
      .join('\n');
    const placeInstruction = `最初の3問のplaceは必ず次の場所を順番に設定してください。\n${placeInstructionLines}\n4問目以降のplaceは従来の条件を守りつつ自由に設定してください。`;

    const promptWithWords = `${prompt.trim()}\n\n${placeInstruction}\n\n以下はdocs/words.mdに記載された重要な単語・熟語の一覧です。各問題で可能な限りこれらの語彙を活用してください:\n${wordsList}`;
    console.log('✅ プロンプト読み込み完了\n');
    console.log('🎯 最初の3問で使用する場所:');
    initialPlaces.forEach((place, index) => {
      console.log(`  ${index + 1}問目: ${place}`);
    });
    console.log('');

    // 次のファイル番号を取得
    const fileNumber = getNextProblemNumber();
    console.log(`📝 生成ファイル: problem${fileNumber}.ts\n`);

    // 複数回APIを呼び出して問題を生成
    console.log('🔄 生成処理開始...\n');
    const allCodes = await generateMultipleProblems(promptWithWords, rounds);

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
