#!/usr/bin/env tsx

/**
 * OpenAI GPT APIを使って問題データを生成するスクリプト
 */

import { OpenAI } from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import * as readline from 'readline';

import { words } from '../docs/words';
import { TEXT_MODEL } from '@/const';
import { WORD_COUNT_RULES, type ProblemLength } from '@/config/problem';

// 環境変数を読み込み
dotenv.config();

const GENRES = ['ビジネス系', '私生活系'] as const;

/**
 * ジャンルをランダムに選択
 */
function selectRandomGenre(): string {
  return GENRES[Math.floor(Math.random() * GENRES.length)];
}

// OpenAIクライアントを初期化
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const PROBLEMS_PER_ROUND = 1;
const DEFAULT_PROBLEM_COUNT = 30;
const MAX_CODE_ATTEMPTS = 3;

const OUTPUT_FORMAT_INSTRUCTION = `出力形式に関する厳守ルール:
1. TypeScriptのコードブロックで、SeedProblemDataの配列要素のみを${PROBLEMS_PER_ROUND}件出力してください。
2. 各要素は { ... } 形式のオブジェクトで、末尾にカンマを付けてください。
3. コードブロック内に配列リテラル以外の宣言（例: const, export, =, problemData）を含めないでください。ファイル全体やその他の定義を再掲しないでください。

出力例:
\`\`\`ts
{
  // 1問目
},
\`\`\`
`;

const BRUSHUP_PROMPT =
  'さっきの回答は35点です。批判的に自己レビューを行って、100点の完璧な回答を生成し直してください。';

type TokenUsage = {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
};

function logTokenUsage(usage: TokenUsage | undefined, context: string) {
  if (!usage) {
    console.log(`ℹ️ ${context}のトークン情報を取得できませんでした`);
    return;
  }

  const {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: totalTokens,
  } = usage;

  console.log(
    `📊 ${context} トークン使用量: 入力 ${inputTokens ?? '-'} / 出力 ${outputTokens ?? '-'} / 合計 ${totalTokens ?? '-'}`,
  );
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

      rl.question(
        `\n何問生成しますか？ [デフォルト: ${DEFAULT_PROBLEM_COUNT}]: `,
        (countAnswer) => {
          rl.close();

          const countTrimmed = countAnswer.trim();
          let count: number;

          if (countTrimmed === '') {
            count = DEFAULT_PROBLEM_COUNT;
          } else {
            const parsed = parseInt(countTrimmed, 10);
            if (isNaN(parsed) || parsed < 1) {
              console.log(
                `無効な入力です。デフォルトの ${DEFAULT_PROBLEM_COUNT} 問を使用します。\n`,
              );
              count = DEFAULT_PROBLEM_COUNT;
            } else {
              count = parsed;
            }
          }

          resolve({ type: selectedType, count });
        },
      );
    });
  });
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
  context = 'OpenAIレスポンス',
): Promise<{ content: string; messages: Array<{ role: 'user' | 'assistant'; content: string }> }> {
  try {
    const formattedMessages = messages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await openai.responses.create({
      model: TEXT_MODEL,
      input: formattedMessages,
      temperature: 0.7,
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

    logTokenUsage(response.usage, context);

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

function createWordInstruction(
  wordsForRound: readonly string[],
  globalOffset: number,
  isFirstRound: boolean,
  wordCountRange: { min: number; max: number },
  genres: readonly string[],
): string {
  const problemCount = wordsForRound.length;

  if (problemCount === 0) {
    throw new Error('語彙割り当てが空です');
  }

  const header = isFirstRound
    ? `${problemCount}問を生成してください。以下の語彙を、それぞれ対応する問題のenglishSentenceに自然に組み込んでください。`
    : `さらに${problemCount}問生成してください。以下の語彙を、それぞれ対応する問題のenglishSentenceに自然に組み込んでください。`;

  const wordCountInstruction = `\n\n【重要】各問題のenglishSentenceは${wordCountRange.min}〜${wordCountRange.max}単語の範囲内で作成してください。`;

  const assignments = wordsForRound
    .map((word, index) => {
      const genre = genres[index];
      return `${globalOffset + index + 1}問目: ${word} (できれば${genre}の会話を生成してください。難しければ、ワードに合わせた場面の会話でいいです。)`;
    })
    .join('\n');

  return `${header}${wordCountInstruction}\n\n${assignments}`;
}

function createFormatRetryInstruction(errorMessage: string): string {
  return [
    '出力形式に問題があります。次のルールを守り、同じコードブロック形式で修正版を再出力してください。',
    OUTPUT_FORMAT_INSTRUCTION,
    `前回のエラー内容: ${errorMessage}`,
  ].join('\n\n');
}

/**
 * 複数回のAPI呼び出しで問題を生成（1問ずつ）
 */
async function generateMultipleProblems(
  initialPrompt: string,
  rounds: number,
  wordAssignments: readonly string[],
  wordCountRange: { min: number; max: number },
): Promise<string[]> {
  const allCodes: string[] = [];

  for (let i = 1; i <= rounds; i++) {
    const isFirstRound = i === 1;
    const totalGenerated = i * PROBLEMS_PER_ROUND;
    const roundStartIndex = (i - 1) * PROBLEMS_PER_ROUND;
    const roundWords = wordAssignments.slice(roundStartIndex, roundStartIndex + PROBLEMS_PER_ROUND);

    if (roundWords.length === 0) {
      throw new Error('語彙割り当てが不足しています');
    }

    // 各問題にランダムなジャンルを割り当て
    const roundGenres = roundWords.map(() => selectRandomGenre());

    console.log(`🤖 ${i}回目: ${isFirstRound ? '最初の1問を生成中...' : 'さらに1問を生成中...'}`);
    console.log('🗂️ 今回指定する語彙:');
    roundWords.forEach((word, index) => {
      console.log(`  ${roundStartIndex + index + 1}問目: ${word} (${roundGenres[index]})`);
    });

    let generatedCodeForRound: string | null = null;
    let lastValidationError: Error | null = null;
    const baseMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      {
        role: 'user',
        content: initialPrompt,
      },
      {
        role: 'user',
        content: createWordInstruction(
          roundWords,
          roundStartIndex,
          isFirstRound,
          wordCountRange,
          roundGenres,
        ),
      },
    ];
    let messages: Array<{ role: 'user' | 'assistant'; content: string }> = [...baseMessages];

    for (let attempt = 1; attempt <= MAX_CODE_ATTEMPTS; attempt++) {
      const attemptLabel =
        attempt === 1 ? `${i}回目の生成` : `${i}回目の生成 (再試行${attempt - 1})`;

      const generationResult = await generateProblemsWithHistory(messages, attemptLabel);

      const candidateCode = extractTypeScriptCode(generationResult.content);

      try {
        validateGeneratedCode(candidateCode);
        generatedCodeForRound = candidateCode;
        break;
      } catch (error) {
        lastValidationError = error instanceof Error ? error : new Error(String(error));
        console.warn(
          `⚠️ ${attemptLabel}でフォーマット検証に失敗しました: ${lastValidationError.message}`,
        );

        if (attempt === MAX_CODE_ATTEMPTS) {
          throw new Error(
            `${attemptLabel}で有効なコードを取得できませんでした: ${lastValidationError.message}`,
          );
        }

        const latestAssistantMessage =
          generationResult.messages[generationResult.messages.length - 1];
        if (!latestAssistantMessage || latestAssistantMessage.role !== 'assistant') {
          throw new Error('最新のアシスタントメッセージを取得できませんでした');
        }

        messages = [
          ...baseMessages,
          latestAssistantMessage,
          {
            role: 'user',
            content: createFormatRetryInstruction(lastValidationError.message),
          },
        ];
      }
    }

    if (!generatedCodeForRound) {
      throw lastValidationError ?? new Error('コード生成に失敗しました');
    }

    // ブラッシュアップ処理
    console.log(`🎨 ${i}回目の回答をブラッシュアップ中...`);
    let brushedUpCode = generatedCodeForRound;
    let brushupMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [
      ...baseMessages,
      {
        role: 'assistant',
        content: `\`\`\`ts\n${generatedCodeForRound}\n\`\`\``,
      },
      {
        role: 'user',
        content: BRUSHUP_PROMPT,
      },
    ];

    for (let brushupAttempt = 1; brushupAttempt <= MAX_CODE_ATTEMPTS; brushupAttempt++) {
      const brushupLabel = `${i}回目のブラッシュアップ${brushupAttempt === 1 ? '' : ` (再試行${brushupAttempt - 1})`}`;

      try {
        const brushupResult = await generateProblemsWithHistory(brushupMessages, brushupLabel);
        const brushedUpCandidate = extractTypeScriptCode(brushupResult.content);

        validateGeneratedCode(brushedUpCandidate);
        brushedUpCode = brushedUpCandidate;
        console.log(`✨ ${i}回目のブラッシュアップ完了`);
        break;
      } catch (error) {
        const brushupError = error instanceof Error ? error : new Error(String(error));
        console.warn(`⚠️ ${brushupLabel}でエラー: ${brushupError.message}`);

        if (brushupAttempt === MAX_CODE_ATTEMPTS) {
          console.log(`ℹ️ ブラッシュアップに失敗したため、元の回答を使用します`);
          break;
        }

        // エラーがあった場合は修正を依頼
        brushupMessages = [
          ...brushupMessages,
          {
            role: 'user',
            content: createFormatRetryInstruction(brushupError.message),
          },
        ];
      }
    }

    allCodes.push(brushedUpCode);

    console.log(`✅ ${i}回目完了 (累計${totalGenerated}問)\n`);

    if (i < rounds) {
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
  const trimmed = code.trim();

  if (!trimmed) {
    throw new Error('コードブロックが空です');
  }

  const lines = trimmed.split('\n');
  const firstContentLine = lines.find((line) => !/^\s*(\/\/.*)?$/.test(line));

  if (!firstContentLine) {
    throw new Error('有効なデータ行が見つかりません');
  }

  if (!firstContentLine.trim().startsWith('{')) {
    throw new Error('最初のオブジェクトが { で始まっていません');
  }

  const forbiddenLine = lines.find((line) => /^\s*(const|let|var|export)\b/.test(line));
  if (forbiddenLine) {
    throw new Error('配列要素以外の宣言が含まれています');
  }

  const lastContentLine = [...lines].reverse().find((line) => !/^\s*(\/\/.*)?$/.test(line));
  if (!lastContentLine) {
    throw new Error('有効なデータ行が見つかりません');
  }

  const trimmedLast = lastContentLine.trim();
  if (!/^\},?(?:\s*\/\/.*)?$/.test(trimmedLast)) {
    throw new Error('最後の行が } または }, で終わっていません');
  }

  const placeCount = (trimmed.match(/\bplace\s*:/g) ?? []).length;
  if (placeCount !== PROBLEMS_PER_ROUND) {
    throw new Error(`place フィールドの数が${PROBLEMS_PER_ROUND}件ではありません`);
  }

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
    if (!trimmed.includes(field)) {
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
  // 各コードブロックの末尾のカンマと空白を削除してから結合
  const trimmedCodes = codes.map((code) => code.trim().replace(/,\s*$/, ''));
  return trimmedCodes.join(',\n');
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
    const match = trimmed.match(/^(['"])(.+)\1,\s*$/);
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
  }
}

/**
 * メイン処理
 */
async function main() {
  try {
    console.log('🚀 問題生成スクリプト開始');

    // 常にインタラクティブモード
    const settings = await promptProblemSettings();
    const { type: problemType, count: totalProblems } = settings;

    const wordRange = WORD_COUNT_RULES[problemType];
    console.log(
      `\n📌 ${problemType} モード (${wordRange.min}-${wordRange.max}単語): ${totalProblems}問を生成します\n`,
    );

    const rounds = Math.ceil(totalProblems / PROBLEMS_PER_ROUND);

    console.log(`🔢 生成ラウンド数: ${rounds}回（1問×${rounds}回）\n`);

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

    if (words.length < totalProblems) {
      throw new Error(
        `語彙リストの語数が不足しています（必要:${totalProblems}語 / 現在:${words.length}語）。`,
      );
    }

    const wordAssignments = words.slice(0, totalProblems);
    const initialPrompt = `${prompt}\n\n${OUTPUT_FORMAT_INSTRUCTION}`;
    console.log('✅ プロンプト読み込み完了\n');
    console.log('📍 place設定方針:');
    console.log('');
    console.log('🧠 最初の1問で使用する語彙:');
    wordAssignments.slice(0, PROBLEMS_PER_ROUND).forEach((word, index) => {
      console.log(`  ${index + 1}問目: ${word}`);
    });
    console.log('');

    // 次のファイル番号を取得
    const fileNumber = getNextProblemNumber();
    console.log(`📝 生成ファイル: problem${fileNumber}.ts\n`);

    // 複数回APIを呼び出して問題を生成
    console.log('🔄 生成処理開始...\n');
    const allCodes = await generateMultipleProblems(
      initialPrompt,
      rounds,
      wordAssignments,
      wordRange,
    );

    console.log('✅ すべてのコード生成完了\n');

    // ファイルを保存
    console.log('💾 ファイルを保存中...');
    const savedPath = saveProblemFile(allCodes, fileNumber, totalProblems);
    console.log(`✅ 保存完了: ${savedPath}\n`);
    console.log('🧹 使用済み語彙をwords.tsから削除中...');
    removeUsedWordsFromWordList(wordAssignments);
    console.log('✅ 語彙リストを更新しました\n');

    console.log(`🎉 問題生成完了！${totalProblems}問を生成しました`);

    // 単語数分布を表示
    await analyzeAndDisplayWordCountDistribution(savedPath);

    console.log('\n次のステップ:');
    console.log('  1. 生成されたファイルを確認してください');
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
      process.exit(0); // 正常終了
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1); // エラー終了
    });
}

export { main };
