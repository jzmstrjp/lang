# パターン学習モード 詳細実装ガイド

## 目次

1. [データベース設計とパターン表現](#データベース設計とパターン表現)
2. [音声生成の実装](#音声生成の実装)
3. [画像生成の実装](#画像生成の実装)
4. [パターン変数のハイライト表示](#パターン変数のハイライト表示)
5. [実装コード例](#実装コード例)
6. [シード生成スクリプト](#シード生成スクリプト)

---

## データベース設計とパターン表現

### パターンの表現方法

パターン学習では「Can you pass me **the salt**?」のように、変化する部分を明示する必要があります。

#### アプローチ1: highlightWord方式（採用）

**メリット:**

- シンプルで理解しやすい
- 変化する単語を直接指定
- フロントエンドでの処理が簡単

**実装方法:**

```typescript
type PatternExample = {
  id: string;
  patternSetId: string;
  order: number;
  englishSentence: string; // "Can you pass me the salt?"
  japaneseSentence: string; // "お塩を取ってくれませんか？"
  highlightWord: string; // "salt" または "the salt"
  highlightWordJa?: string; // "お塩" (オプション)
  imageUrl?: string;
  audioEnUrl: string;
  audioJaUrl: string;
};
```

**表示ロジック:**

```typescript
// フロントエンドでの使用例
function highlightPattern(sentence: string, highlightWord: string) {
  const regex = new RegExp(`(${highlightWord})`, 'gi');
  return sentence.replace(regex, '<span class="text-blue-600 font-bold">$1</span>');
}

// 使用例
const sentence = 'Can you pass me the salt?';
const highlighted = highlightPattern(sentence, 'salt');
// → "Can you pass me the <span class="text-blue-600 font-bold">salt</span>?"
```

#### アプローチ2: テンプレート方式（将来的な拡張案）

変数を `{variable}` で表現する方法

```typescript
type PatternTemplate = {
  template: string; // "Can you pass me the {object}?"
  variables: {
    object: string[]; // ["salt", "remote", "pen"]
  };
};
```

**現時点では採用しない理由:**

- 複雑度が高い
- 日本語のテンプレート化が難しい（助詞の変化など）
- 初期段階ではオーバーエンジニアリング

### Prismaスキーマの追加

```prisma
// prisma/schema.prisma に追加

model PatternSet {
  id                   String              @id @default(cuid())
  patternName          String              // "Can you pass me X?"
  patternDescription   String              // "物を取ってもらう依頼"
  difficulty           DifficultyLevel     @default(beginner)
  examples             PatternExample[]
  testProblem          PatternTestProblem?
  relatedPatternIds    String[]            // 関連パターンのIDリスト
  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@index([difficulty])
  @@map("pattern_sets")
}

model PatternExample {
  id                String     @id @default(cuid())
  patternSetId      String
  patternSet        PatternSet @relation(fields: [patternSetId], references: [id], onDelete: Cascade)
  order             Int        // 表示順序（1, 2, 3...）

  // 英語文と日本語文
  englishSentence   String
  japaneseSentence  String

  // 変化する部分（ハイライト対象）
  highlightWord     String     // 英語での変化部分 例: "salt"
  highlightWordJa   String?    // 日本語での変化部分 例: "お塩" (オプション)

  // 会話のコンテキスト
  place             String     // 場所 例: "食卓"
  senderRole        String     // 話し手の役割 例: "妻"
  receiverRole      String     // 聞き手の役割 例: "夫"
  senderVoice       VoiceType  // 話し手の声
  receiverVoice     VoiceType  // 聞き手の声

  // 返答（英語と日本語両方）
  englishReply      String     // "Sure, here's the salt."
  japaneseReply     String     // "はい、お塩どうぞ"

  // メディアファイル
  audioEnUrl        String?
  audioJaUrl        String?
  audioEnReplyUrl   String?    // 返答の英語音声
  audioJaReplyUrl   String?    // 返答の日本語音声（既存と重複）
  imageUrl          String?

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@unique([patternSetId, order])
  @@index([patternSetId, order])
  @@map("pattern_examples")
}

model PatternTestProblem {
  id                String     @id @default(cuid())
  patternSetId      String     @unique
  patternSet        PatternSet @relation(fields: [patternSetId], references: [id], onDelete: Cascade)

  // テスト問題
  englishSentence   String
  correctAnswer     String     // 正しい日本語訳
  incorrectOptions  Json       // 不正解の選択肢（配列）

  // テスト問題のコンテキスト
  place             String?
  senderVoice       VoiceType  @default(female)

  // メディアファイル
  audioEnUrl        String?
  imageUrl          String?

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@map("pattern_test_problems")
}

enum DifficultyLevel {
  beginner
  intermediate
  advanced
}
```

### マイグレーションコマンド

```bash
# スキーマ変更後、マイグレーションを生成
npx prisma migrate dev --name add_pattern_learning_tables

# 本番環境へのデプロイ
npx prisma migrate deploy
```

---

## 音声生成の実装

### 既存の音声生成システムの活用

現在のシステムはOpenAI TTS APIを使用しています。パターン学習でも同じインフラを流用します。

### 音声生成の流れ

```
1. テキスト準備 → 2. OpenAI TTS API → 3. Buffer取得 → 4. R2アップロード → 5. URLをDBに保存
```

### 実装コード

#### `/src/lib/pattern-audio-generator.ts` (新規作成)

```typescript
import { generateSpeechBuffer } from '@/lib/audio-utils';
import { uploadAudioToR2 } from '@/lib/r2-client';
import type { VoiceGender } from '@/config/voice';
import type { VoiceType } from '@prisma/client';

/**
 * VoiceTypeをVoiceGenderに変換
 */
function voiceTypeToGender(voiceType: VoiceType): VoiceGender {
  return voiceType as VoiceGender;
}

/**
 * パターン例文の音声を生成してR2にアップロード
 */
export async function generatePatternExampleAudio(
  exampleId: string,
  englishSentence: string,
  japaneseReply: string,
  englishReply: string,
  senderVoice: VoiceType,
  receiverVoice: VoiceType,
): Promise<{
  audioEnUrl: string;
  audioJaUrl: string;
  audioEnReplyUrl: string;
}> {
  console.log(`[Pattern Audio] 音声生成開始: ${exampleId}`);

  // 3つの音声を並列生成
  const [enBuffer, jaBuffer, enReplyBuffer] = await Promise.all([
    generateSpeechBuffer(englishSentence, voiceTypeToGender(senderVoice)),
    generateSpeechBuffer(japaneseReply, voiceTypeToGender(receiverVoice)),
    generateSpeechBuffer(englishReply, voiceTypeToGender(receiverVoice)),
  ]);

  console.log(`[Pattern Audio] 音声バッファ生成完了`);

  // 3つの音声を並列アップロード
  const [audioEnUrl, audioJaUrl, audioEnReplyUrl] = await Promise.all([
    uploadAudioToR2(enBuffer, exampleId, 'en', voiceTypeToGender(senderVoice)),
    uploadAudioToR2(jaBuffer, exampleId, 'ja', voiceTypeToGender(receiverVoice)),
    uploadAudioToR2(enReplyBuffer, exampleId, 'en-reply', voiceTypeToGender(receiverVoice)),
  ]);

  console.log(`[Pattern Audio] R2アップロード完了`);

  return {
    audioEnUrl,
    audioJaUrl,
    audioEnReplyUrl,
  };
}

/**
 * パターンテスト問題の音声を生成してR2にアップロード
 */
export async function generatePatternTestAudio(
  testId: string,
  englishSentence: string,
  senderVoice: VoiceType,
): Promise<string> {
  console.log(`[Pattern Test Audio] 音声生成開始: ${testId}`);

  const audioBuffer = await generateSpeechBuffer(englishSentence, voiceTypeToGender(senderVoice));

  const audioUrl = await uploadAudioToR2(audioBuffer, testId, 'en', voiceTypeToGender(senderVoice));

  console.log(`[Pattern Test Audio] 音声生成完了: ${audioUrl}`);

  return audioUrl;
}
```

### 音声生成のコスト見積もり

OpenAI TTS Pricing (2025年10月時点):

- gpt-4o-mini-tts: **$0.15 / 1M characters**
- gpt-4o-tts: $0.30 / 1M characters

#### パターン学習1セットあたりのコスト計算

**前提:**

- 1パターンセット = 3例文 + 1テスト問題
- 1例文 = 英語文(10単語) + 英語返答(8単語) + 日本語返答(10文字)
- 1テスト問題 = 英語文(10単語)

**計算:**

```
例文1つあたり:
  - 英語文: 10単語 × 6文字/単語 = 60文字
  - 英語返答: 8単語 × 6文字/単語 = 48文字
  - 日本語返答: 10文字
  - 小計: 118文字

1パターンセット:
  - 例文3つ: 118 × 3 = 354文字
  - テスト1つ: 60文字
  - 合計: 414文字

100パターンセット:
  - 414文字 × 100 = 41,400文字
  - コスト: $0.15 × (41,400 / 1,000,000) = $0.0062 ≈ 0.9円

1000パターンセット:
  - 約9円
```

**結論:** 音声生成のコストは非常に安い！

---

## 画像生成の実装

### 既存の画像生成システムの活用

現在のシステムはOpenAI DALL-E 3を使用しています。

### 画像生成の流れ

```
1. プロンプト生成 → 2. OpenAI DALL-E 3 → 3. Buffer取得 → 4. WebP変換 → 5. R2アップロード → 6. URLをDBに保存
```

### パターン学習用の画像プロンプト生成

#### `/src/lib/pattern-image-generator.ts` (新規作成)

```typescript
import { generateImageBuffer } from '@/lib/image-utils';
import { uploadImageToR2 } from '@/lib/r2-client';
import type { VoiceType } from '@prisma/client';

/**
 * 性別を日本語に変換
 */
function getGenderInJapanese(voiceType: VoiceType): '男性' | '女性' {
  return voiceType === 'male' ? '男性' : '女性';
}

/**
 * 話し手の名前マッピング
 */
const senderNameMap: Record<VoiceType, string> = {
  male: 'James',
  female: 'Mary',
};

/**
 * 聞き手の名前マッピング
 */
const receiverNameMap: Record<VoiceType, string> = {
  male: 'タカシ',
  female: 'マミ',
};

/**
 * パターン例文用の画像プロンプトを生成
 */
export function generatePatternImagePrompt(
  englishSentence: string,
  japaneseSentence: string,
  englishReply: string,
  japaneseReply: string,
  place: string,
  senderRole: string,
  receiverRole: string,
  senderVoice: VoiceType,
  receiverVoice: VoiceType,
): string {
  const senderGender = getGenderInJapanese(senderVoice);
  const receiverGender = getGenderInJapanese(receiverVoice);
  const senderName = senderNameMap[senderVoice];
  const receiverName = receiverNameMap[receiverVoice];

  return `実写風の2コマ漫画を生成してください。
縦に2コマです。
漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現してください。
上下のコマの高さは完全に同じであること。
上下のコマの間に高さ20ピクセルの白い境界線が必要です。

【場所】
${place}

【登場人物】
- ${senderName}（${senderGender}）・・・${senderRole}。端正な顔立ちをしている。
- ${receiverName}（${receiverGender}）・・・${receiverRole}。端正な顔立ちをしている。

【ストーリー】
${senderName}（${senderGender}）が、${receiverName}（${receiverGender}）に対して「${japaneseSentence}」と言う。それに対し、${receiverName}（${receiverGender}）が「${japaneseReply}」と答える。

【1コマ目】
- ${senderName}（${senderGender}）が「${japaneseSentence}」と言っている
- ${receiverName}（${receiverGender}）はまだ描かない
- ${senderName}（${senderGender}）が右を向いているアングルで描画されている

【2コマ目】
- ${receiverName}（${receiverGender}）が「${japaneseReply}」と返答している
- ${receiverName}（${receiverGender}）が左を向いているアングルで描画されている

【備考】
- 場所や場面に合わせた表情やジェスチャーを描写してください。
- ${senderName}（${senderGender}）と${receiverName}（${receiverGender}）は対面しているわけなので、1コマ目と2コマ目の背景は微妙に異なるはずです。
- 対話しているように見えるように、1コマ目と2コマ目のカメラアングルを変えてください。
- セリフに対して不自然な画像は生成しないこと。
- 漫画ですが、吹き出し・台詞は描かないこと。写真のみで表現してください。
- 自然で生成AIっぽくないテイストで描写してください。

【禁止事項】
- 同じコマに、同じ人物を2回描画しないこと。
- 上下のコマの高さは完全に同じであること。
- 上下のコマの間に高さ20ピクセルの白い境界線が必要です。
`;
}

/**
 * パターン例文用の画像を生成してR2にアップロード
 */
export async function generateAndUploadPatternImage(
  exampleId: string,
  englishSentence: string,
  japaneseSentence: string,
  englishReply: string,
  japaneseReply: string,
  place: string,
  senderRole: string,
  receiverRole: string,
  senderVoice: VoiceType,
  receiverVoice: VoiceType,
): Promise<string> {
  console.log(`[Pattern Image] 画像生成開始: ${exampleId}`);

  const prompt = generatePatternImagePrompt(
    englishSentence,
    japaneseSentence,
    englishReply,
    japaneseReply,
    place,
    senderRole,
    receiverRole,
    senderVoice,
    receiverVoice,
  );

  const imageBuffer = await generateImageBuffer(prompt);
  const imageUrl = await uploadImageToR2(imageBuffer, exampleId, 'composite');

  console.log(`[Pattern Image] 画像生成完了: ${imageUrl}`);

  return imageUrl;
}
```

### 画像生成のコスト見積もり

OpenAI DALL-E 3 Pricing (2025年10月時点):

- Standard quality (1024×1024): **$0.040 / image**
- HD quality (1024×1792): $0.080 / image

#### パターン学習1セットあたりのコスト計算

**前提:**

- 1パターンセット = 3例文 + 1テスト問題
- 各例文に1枚の画像
- テスト問題に1枚の画像（オプション）

**計算:**

```
画像ありの場合（全てに画像）:
  - 例文3つ: $0.040 × 3 = $0.12
  - テスト1つ: $0.040 × 1 = $0.04
  - 合計: $0.16 ≈ 24円

画像なしモード対応（例文のみ画像）:
  - 例文3つ: $0.040 × 3 = $0.12 ≈ 18円
  - テスト: 画像なし
  - 合計: $0.12 ≈ 18円

100パターンセット:
  - 約2,400円（画像あり）
  - 約1,800円（例文のみ）
```

**コスト削減策:**

1. **画像の再利用**: 同じ場所・シチュエーションの画像を複数パターンで共有
2. **画像なしモード**: テスト問題では画像を生成しない
3. **遅延生成**: 最初はプレースホルダー画像を使い、アクセスされたら生成

---

## パターン変数のハイライト表示

### フロントエンド実装

#### `/src/lib/pattern-highlight.ts` (新規作成)

```typescript
/**
 * 文章内の特定の単語をハイライト表示用にマークアップ
 */
export function highlightWord(
  sentence: string,
  highlightWord: string,
): { parts: Array<{ text: string; isHighlight: boolean }> } {
  if (!highlightWord) {
    return { parts: [{ text: sentence, isHighlight: false }] };
  }

  // highlightWordをエスケープして正規表現で検索
  const escapedWord = highlightWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedWord})`, 'gi');

  const parts = sentence.split(regex).map((part, index) => ({
    text: part,
    isHighlight: regex.test(part),
  }));

  return { parts };
}

/**
 * 複数の例文から変化する部分を自動検出（将来的な拡張用）
 */
export function detectPatternVariables(sentences: string[]): {
  commonPattern: string;
  variables: string[];
} {
  // TODO: 実装
  // 最長共通部分文字列アルゴリズムを使用
  // 現時点では手動でhighlightWordを指定する方式

  return {
    commonPattern: '',
    variables: [],
  };
}
```

#### Reactコンポーネントでの使用例

```tsx
// /src/components/pattern-learning/highlighted-sentence.tsx (新規作成)

import { highlightWord } from '@/lib/pattern-highlight';

type HighlightedSentenceProps = {
  sentence: string;
  highlightWord?: string;
  className?: string;
};

export function HighlightedSentence({
  sentence,
  highlightWord,
  className = '',
}: HighlightedSentenceProps) {
  const { parts } = highlightWord
    ? highlightWord(sentence, highlightWord)
    : { parts: [{ text: sentence, isHighlight: false }] };

  return (
    <p className={className}>
      {parts.map((part, index) => (
        <span
          key={index}
          className={part.isHighlight ? 'text-blue-600 font-bold bg-blue-50 px-1 rounded' : ''}
        >
          {part.text}
        </span>
      ))}
    </p>
  );
}
```

#### パターン確認画面での使用例

```tsx
// /src/components/pattern-learning/pattern-review.tsx

import { HighlightedSentence } from './highlighted-sentence';

type PatternReviewProps = {
  examples: Array<{
    englishSentence: string;
    japaneseSentence: string;
    highlightWord: string;
    highlightWordJa?: string;
  }>;
  patternName: string;
  onContinue: () => void;
  onRewatch: () => void;
};

export function PatternReview({
  examples,
  patternName,
  onContinue,
  onRewatch,
}: PatternReviewProps) {
  return (
    <section className="grid gap-8 max-w-3xl mx-auto">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-[#2a2b3c] mb-2">パターンを発見しましたか？</h2>
        <p className="text-lg text-[#2a2b3c]/70">変化する部分に注目してみましょう</p>
      </div>

      <div className="grid gap-4">
        {examples.map((example, index) => (
          <div key={index} className="bg-white rounded-2xl border border-[#d8cbb6] p-6 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#2f8f9d] text-white flex items-center justify-center font-bold">
                {index + 1}
              </div>
              <div className="flex-1 space-y-2">
                <HighlightedSentence
                  sentence={example.englishSentence}
                  highlightWord={example.highlightWord}
                  className="text-xl font-semibold text-[#2a2b3c]"
                />
                <HighlightedSentence
                  sentence={example.japaneseSentence}
                  highlightWord={example.highlightWordJa}
                  className="text-base text-[#2a2b3c]/70"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-blue-50 to-teal-50 rounded-2xl p-6 border border-blue-200">
        <h3 className="text-xl font-bold text-[#2f8f9d] mb-3">パターンの構造</h3>
        <p className="text-lg text-[#2a2b3c] font-mono bg-white px-4 py-3 rounded-lg">
          {patternName}
        </p>
        <p className="text-sm text-[#2a2b3c]/70 mt-3">
          青くハイライトされた部分が変化していることに気づきましたか？
        </p>
      </div>

      <div className="flex gap-4 justify-center">
        <button
          onClick={onRewatch}
          className="px-8 py-4 rounded-full border-2 border-[#d8cbb6] bg-white text-[#2a2b3c] font-semibold hover:border-[#2f8f9d] transition"
        >
          もう一度見る
        </button>
        <button
          onClick={onContinue}
          className="px-8 py-4 rounded-full bg-[#2f8f9d] text-white font-semibold hover:bg-[#257682] transition shadow-lg shadow-[#2f8f9d]/30"
        >
          理解できた！テストへ
        </button>
      </div>
    </section>
  );
}
```

### ハイライト表示のアニメーション

```css
/* globals.css に追加 */

@keyframes pulse-highlight {
  0%,
  100% {
    background-color: rgb(239 246 255); /* blue-50 */
    transform: scale(1);
  }
  50% {
    background-color: rgb(191 219 254); /* blue-200 */
    transform: scale(1.05);
  }
}

.animate-pulse-highlight {
  animation: pulse-highlight 2s ease-in-out infinite;
}
```

---

## 実装コード例

### APIエンドポイント

#### `/src/app/api/pattern-learning/route.ts` (新規作成)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/pattern-learning?difficulty=beginner
 * 指定難易度のパターンセット一覧を取得
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const difficulty = searchParams.get('difficulty') || 'beginner';

    if (!['beginner', 'intermediate', 'advanced'].includes(difficulty)) {
      return NextResponse.json({ error: 'Invalid difficulty level' }, { status: 400 });
    }

    const patternSets = await prisma.patternSet.findMany({
      where: {
        difficulty: difficulty as 'beginner' | 'intermediate' | 'advanced',
      },
      select: {
        id: true,
        patternName: true,
        patternDescription: true,
        difficulty: true,
        createdAt: true,
        // 例文の数を取得
        examples: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const patternSetsWithCount = patternSets.map((set) => ({
      id: set.id,
      patternName: set.patternName,
      patternDescription: set.patternDescription,
      difficulty: set.difficulty,
      exampleCount: set.examples.length,
      createdAt: set.createdAt,
    }));

    return NextResponse.json({
      patternSets: patternSetsWithCount,
      count: patternSetsWithCount.length,
    });
  } catch (error) {
    console.error('[API] Pattern learning list error:', error);
    return NextResponse.json({ error: 'Failed to fetch pattern sets' }, { status: 500 });
  }
}
```

#### `/src/app/api/pattern-learning/[patternId]/route.ts` (新規作成)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/pattern-learning/:patternId
 * 特定のパターンセットの詳細を取得（例文・テスト問題込み）
 */
export async function GET(request: NextRequest, { params }: { params: { patternId: string } }) {
  try {
    const { patternId } = params;

    const patternSet = await prisma.patternSet.findUnique({
      where: {
        id: patternId,
      },
      include: {
        examples: {
          orderBy: {
            order: 'asc',
          },
        },
        testProblem: true,
      },
    });

    if (!patternSet) {
      return NextResponse.json({ error: 'Pattern set not found' }, { status: 404 });
    }

    // incorrectOptionsをJSON文字列から配列に変換
    const testProblem = patternSet.testProblem
      ? {
          ...patternSet.testProblem,
          incorrectOptions: Array.isArray(patternSet.testProblem.incorrectOptions)
            ? patternSet.testProblem.incorrectOptions
            : JSON.parse(patternSet.testProblem.incorrectOptions as string),
        }
      : null;

    return NextResponse.json({
      patternSet: {
        ...patternSet,
        testProblem,
      },
    });
  } catch (error) {
    console.error('[API] Pattern learning detail error:', error);
    return NextResponse.json({ error: 'Failed to fetch pattern set' }, { status: 500 });
  }
}
```

### ページコンポーネント

#### `/src/app/pattern-learning/page.tsx` (新規作成)

```typescript
import Link from 'next/link';

export default function PatternLearningPage() {
  const difficulties = [
    {
      level: 'beginner',
      title: '初級',
      description: '基本的な日常会話パターン',
      color: 'from-green-400 to-emerald-500',
    },
    {
      level: 'intermediate',
      title: '中級',
      description: 'より複雑な表現パターン',
      color: 'from-blue-400 to-cyan-500',
    },
    {
      level: 'advanced',
      title: '上級',
      description: 'ビジネスや専門的なパターン',
      color: 'from-purple-400 to-pink-500',
    },
  ];

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#f4f1ea] to-white p-8">
      <div className="max-w-5xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl font-bold text-[#2a2b3c] mb-4">
            パターン学習モード
          </h1>
          <p className="text-lg text-[#2a2b3c]/70">
            複数の例から英語のパターンを見つけて、自然に理解しよう
          </p>
        </header>

        <section className="grid md:grid-cols-3 gap-6">
          {difficulties.map((diff) => (
            <Link
              key={diff.level}
              href={`/pattern-learning/${diff.level}`}
              className="group"
            >
              <div className="bg-white rounded-3xl border border-[#d8cbb6] p-8 shadow-lg hover:shadow-xl transition-all hover:-translate-y-1">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${diff.color} mb-4 flex items-center justify-center text-white font-bold text-2xl`}
                >
                  {diff.level[0].toUpperCase()}
                </div>
                <h2 className="text-2xl font-bold text-[#2a2b3c] mb-2">
                  {diff.title}
                </h2>
                <p className="text-[#2a2b3c]/70">{diff.description}</p>
              </div>
            </Link>
          ))}
        </section>

        <section className="mt-16 bg-gradient-to-r from-blue-50 to-teal-50 rounded-3xl p-8 border border-blue-200">
          <h2 className="text-2xl font-bold text-[#2f8f9d] mb-4">
            パターン学習とは？
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-[#2a2b3c]">
            <div>
              <h3 className="font-semibold mb-2">🧩 パターンを発見</h3>
              <p className="text-sm text-[#2a2b3c]/70">
                3〜5個の類似した例文を見て、共通するパターンを見つけます
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🎯 自然な理解</h3>
              <p className="text-sm text-[#2a2b3c]/70">
                暗記ではなく、差分から構造を理解する自然な学習法
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">✅ 理解度テスト</h3>
              <p className="text-sm text-[#2a2b3c]/70">
                新しい単語でパターンを応用できるかテストします
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">🔗 関連パターン</h3>
              <p className="text-sm text-[#2a2b3c]/70">
                似たパターンや関連表現も一緒に学習できます
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
```

---

## シード生成スクリプト

### `/scripts/seed-pattern-learning.ts` (新規作成)

```typescript
import { PrismaClient } from '@prisma/client';
import {
  generatePatternExampleAudio,
  generatePatternTestAudio,
} from '../src/lib/pattern-audio-generator';
import { generateAndUploadPatternImage } from '../src/lib/pattern-image-generator';

const prisma = new PrismaClient();

/**
 * パターンセットの定義（TypeScript型）
 */
type PatternSetDefinition = {
  patternName: string;
  patternDescription: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  examples: Array<{
    order: number;
    englishSentence: string;
    japaneseSentence: string;
    highlightWord: string;
    highlightWordJa?: string;
    place: string;
    senderRole: string;
    receiverRole: string;
    senderVoice: 'male' | 'female';
    receiverVoice: 'male' | 'female';
    englishReply: string;
    japaneseReply: string;
  }>;
  testProblem: {
    englishSentence: string;
    correctAnswer: string;
    incorrectOptions: string[];
    place?: string;
    senderVoice: 'male' | 'female';
  };
  relatedPatternIds?: string[];
};

/**
 * 初級パターンセットのデータ
 */
const beginnerPatterns: PatternSetDefinition[] = [
  {
    patternName: 'Can you pass me X?',
    patternDescription: '物を取ってもらう依頼（カジュアル）',
    difficulty: 'beginner',
    examples: [
      {
        order: 1,
        englishSentence: 'Can you pass me the salt?',
        japaneseSentence: 'お塩を取ってくれない？',
        highlightWord: 'salt',
        highlightWordJa: 'お塩',
        place: '食卓',
        senderRole: '妻',
        receiverRole: '夫',
        senderVoice: 'female',
        receiverVoice: 'male',
        englishReply: 'Sure, here you go.',
        japaneseReply: 'はい、どうぞ',
      },
      {
        order: 2,
        englishSentence: 'Can you pass me the remote?',
        japaneseSentence: 'リモコンを取ってくれない？',
        highlightWord: 'remote',
        highlightWordJa: 'リモコン',
        place: 'リビング',
        senderRole: '夫',
        receiverRole: '妻',
        senderVoice: 'male',
        receiverVoice: 'female',
        englishReply: 'Here it is.',
        japaneseReply: 'はい、どうぞ',
      },
      {
        order: 3,
        englishSentence: 'Can you pass me the pen?',
        japaneseSentence: 'ペンを取ってくれない？',
        highlightWord: 'pen',
        highlightWordJa: 'ペン',
        place: 'オフィス',
        senderRole: '同僚',
        receiverRole: '同僚',
        senderVoice: 'female',
        receiverVoice: 'male',
        englishReply: 'Sure, which one?',
        japaneseReply: 'いいよ、どれ？',
      },
    ],
    testProblem: {
      englishSentence: 'Can you pass me the book?',
      correctAnswer: '本を取ってくれませんか？',
      incorrectOptions: ['本を読みましょう', '本を買いに行こう', '本はどこですか？'],
      place: '図書館',
      senderVoice: 'female',
    },
  },
  {
    patternName: 'I want to X',
    patternDescription: '〜したいという希望を伝える',
    difficulty: 'beginner',
    examples: [
      {
        order: 1,
        englishSentence: 'I want to eat pizza.',
        japaneseSentence: 'ピザが食べたいな',
        highlightWord: 'eat pizza',
        highlightWordJa: 'ピザが食べたい',
        place: 'リビング',
        senderRole: '子供',
        receiverRole: '母親',
        senderVoice: 'male',
        receiverVoice: 'female',
        englishReply: "Let's order some!",
        japaneseReply: '注文しましょう！',
      },
      {
        order: 2,
        englishSentence: 'I want to watch a movie.',
        japaneseSentence: '映画が見たいな',
        highlightWord: 'watch a movie',
        highlightWordJa: '映画が見たい',
        place: 'リビング',
        senderRole: '夫',
        receiverRole: '妻',
        senderVoice: 'male',
        receiverVoice: 'female',
        englishReply: 'What kind of movie?',
        japaneseReply: 'どんな映画？',
      },
      {
        order: 3,
        englishSentence: 'I want to go shopping.',
        japaneseSentence: '買い物に行きたいな',
        highlightWord: 'go shopping',
        highlightWordJa: '買い物に行きたい',
        place: 'リビング',
        senderRole: '妻',
        receiverRole: '夫',
        senderVoice: 'female',
        receiverVoice: 'male',
        englishReply: 'Sure, when?',
        japaneseReply: 'いいよ、いつ？',
      },
    ],
    testProblem: {
      englishSentence: 'I want to play games.',
      correctAnswer: 'ゲームがしたい',
      incorrectOptions: ['ゲームを買いたい', 'ゲームを見たい', 'ゲームはどこ？'],
      senderVoice: 'male',
    },
  },
  {
    patternName: 'Where is X?',
    patternDescription: '場所や物の位置を尋ねる',
    difficulty: 'beginner',
    examples: [
      {
        order: 1,
        englishSentence: 'Where is the bathroom?',
        japaneseSentence: 'トイレはどこですか？',
        highlightWord: 'bathroom',
        highlightWordJa: 'トイレ',
        place: 'レストラン',
        senderRole: '客',
        receiverRole: '店員',
        senderVoice: 'male',
        receiverVoice: 'female',
        englishReply: "It's on the second floor.",
        japaneseReply: '2階です',
      },
      {
        order: 2,
        englishSentence: 'Where is the station?',
        japaneseSentence: '駅はどこですか？',
        highlightWord: 'station',
        highlightWordJa: '駅',
        place: '道',
        senderRole: '観光客',
        receiverRole: '地元の人',
        senderVoice: 'female',
        receiverVoice: 'male',
        englishReply: "It's that way.",
        japaneseReply: 'あっちです',
      },
      {
        order: 3,
        englishSentence: 'Where is my phone?',
        japaneseSentence: '私の携帯はどこ？',
        highlightWord: 'my phone',
        highlightWordJa: '私の携帯',
        place: 'リビング',
        senderRole: '妻',
        receiverRole: '夫',
        senderVoice: 'female',
        receiverVoice: 'male',
        englishReply: "It's on the table.",
        japaneseReply: 'テーブルの上だよ',
      },
    ],
    testProblem: {
      englishSentence: 'Where is the library?',
      correctAnswer: '図書館はどこですか？',
      incorrectOptions: ['図書館に行きたい', '図書館で勉強しよう', '図書館は開いていますか？'],
      senderVoice: 'male',
    },
  },
];

/**
 * パターンセットを1つ生成してDBに保存
 */
async function seedPatternSet(definition: PatternSetDefinition) {
  console.log(`\n[Seed] パターンセット生成開始: ${definition.patternName}`);

  // 1. パターンセットを作成
  const patternSet = await prisma.patternSet.create({
    data: {
      patternName: definition.patternName,
      patternDescription: definition.patternDescription,
      difficulty: definition.difficulty,
      relatedPatternIds: definition.relatedPatternIds || [],
    },
  });

  console.log(`[Seed] パターンセット作成完了: ${patternSet.id}`);

  // 2. 各例文を生成
  for (const exampleDef of definition.examples) {
    console.log(`[Seed] 例文 ${exampleDef.order} 生成中...`);

    // 音声と画像を並列生成
    const [audioUrls, imageUrl] = await Promise.all([
      generatePatternExampleAudio(
        `${patternSet.id}_example_${exampleDef.order}`,
        exampleDef.englishSentence,
        exampleDef.japaneseReply,
        exampleDef.englishReply,
        exampleDef.senderVoice,
        exampleDef.receiverVoice,
      ),
      generateAndUploadPatternImage(
        `${patternSet.id}_example_${exampleDef.order}`,
        exampleDef.englishSentence,
        exampleDef.japaneseSentence,
        exampleDef.englishReply,
        exampleDef.japaneseReply,
        exampleDef.place,
        exampleDef.senderRole,
        exampleDef.receiverRole,
        exampleDef.senderVoice,
        exampleDef.receiverVoice,
      ),
    ]);

    // DBに保存
    await prisma.patternExample.create({
      data: {
        patternSetId: patternSet.id,
        order: exampleDef.order,
        englishSentence: exampleDef.englishSentence,
        japaneseSentence: exampleDef.japaneseSentence,
        highlightWord: exampleDef.highlightWord,
        highlightWordJa: exampleDef.highlightWordJa,
        place: exampleDef.place,
        senderRole: exampleDef.senderRole,
        receiverRole: exampleDef.receiverRole,
        senderVoice: exampleDef.senderVoice,
        receiverVoice: exampleDef.receiverVoice,
        englishReply: exampleDef.englishReply,
        japaneseReply: exampleDef.japaneseReply,
        audioEnUrl: audioUrls.audioEnUrl,
        audioJaUrl: audioUrls.audioJaUrl,
        audioEnReplyUrl: audioUrls.audioEnReplyUrl,
        imageUrl: imageUrl,
      },
    });

    console.log(`[Seed] 例文 ${exampleDef.order} 完了`);
  }

  // 3. テスト問題を生成
  console.log(`[Seed] テスト問題生成中...`);

  const testAudioUrl = await generatePatternTestAudio(
    `${patternSet.id}_test`,
    definition.testProblem.englishSentence,
    definition.testProblem.senderVoice,
  );

  // テスト問題に画像を生成する場合（オプション）
  // const testImageUrl = definition.testProblem.place
  //   ? await generateAndUploadPatternImage(...)
  //   : null;

  await prisma.patternTestProblem.create({
    data: {
      patternSetId: patternSet.id,
      englishSentence: definition.testProblem.englishSentence,
      correctAnswer: definition.testProblem.correctAnswer,
      incorrectOptions: JSON.stringify(definition.testProblem.incorrectOptions),
      place: definition.testProblem.place,
      senderVoice: definition.testProblem.senderVoice,
      audioEnUrl: testAudioUrl,
      // imageUrl: testImageUrl,
    },
  });

  console.log(`[Seed] テスト問題完了`);
  console.log(`[Seed] パターンセット完了: ${definition.patternName}\n`);

  return patternSet;
}

/**
 * メイン実行関数
 */
async function main() {
  console.log('[Seed] パターン学習データのシード開始');

  // 既存のパターンセットを削除（開発環境のみ）
  if (process.env.NODE_ENV === 'development') {
    console.log('[Seed] 既存データを削除中...');
    await prisma.patternTestProblem.deleteMany({});
    await prisma.patternExample.deleteMany({});
    await prisma.patternSet.deleteMany({});
    console.log('[Seed] 削除完了');
  }

  // 各パターンセットを生成
  for (const pattern of beginnerPatterns) {
    await seedPatternSet(pattern);
  }

  console.log('[Seed] 全パターンセットの生成完了！');
}

main()
  .catch((e) => {
    console.error('[Seed] エラー:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

### シード実行コマンド

```bash
# TypeScriptを直接実行
npx tsx scripts/seed-pattern-learning.ts

# または package.json に追加
# "scripts": {
#   "seed:pattern": "tsx scripts/seed-pattern-learning.ts"
# }
npm run seed:pattern
```

---

## 段階的な実装計画

### Phase 1: 基本インフラ（1-2日）

- [x] Prismaスキーマ追加
- [x] マイグレーション実行
- [x] 音声生成ライブラリ作成
- [x] 画像生成ライブラリ作成
- [x] R2アップロード確認

### Phase 2: データ生成（2-3日）

- [x] シードスクリプト作成
- [x] 初級パターン3セットのデータ定義
- [x] 音声・画像の一括生成
- [x] DBへの保存確認

### Phase 3: API実装（1-2日）

- [x] パターン一覧API
- [x] パターン詳細API
- [x] エラーハンドリング

### Phase 4: フロントエンド基礎（3-4日）

- [x] ハイライト表示ライブラリ
- [x] ランディングページ
- [x] 難易度選択ページ
- [x] パターン一覧ページ

### Phase 5: メインフロー実装（5-7日）

- [x] pattern-learning-flow.tsx
- [x] example-viewer.tsx
- [x] pattern-review.tsx
- [x] pattern-test.tsx
- [x] 音声再生制御
- [x] アニメーション

### Phase 6: テスト・改善（2-3日）

- [x] E2Eテスト
- [x] 音声タイミング調整
- [x] UI/UXブラッシュアップ
- [x] パフォーマンス最適化

**合計: 約2-3週間で実装可能**

---

## よくある質問（FAQ）

### Q1: 画像生成をスキップできますか？

**A:** はい、可能です。`generateAndUploadPatternImage`の呼び出しをスキップし、`imageUrl`をnullにすれば画像なしで動作します。

```typescript
// 画像なしモード
const imageUrl = null; // 画像生成をスキップ
```

フロントエンドで画像がない場合のフォールバック表示も実装済みです（既存のproblem-flow.tsxを参照）。

### Q2: 音声言語を変更できますか？

**A:** はい。OpenAI TTSは多言語対応なので、入力テキストを変えるだけで対応できます。

```typescript
// 例: フランス語の例文
const frenchExample = {
  sentence: 'Peux-tu me passer le sel?',
  // ...
};
```

### Q3: パターンの自動検出は可能ですか？

**A:** 将来的には可能ですが、現時点では手動で`highlightWord`を指定する方式を推奨します。理由：

- 日本語の助詞変化（「を」「は」「が」など）の扱いが難しい
- 文脈依存の変化を検出するのが複雑
- 初期段階では手動指定で十分

### Q4: コスト削減の方法は？

**A:** 以下の戦略を推奨：

1. **画像の再利用**: 同じ場所・シチュエーションの画像をキャッシュ
2. **遅延生成**: アクセスされるまで生成を遅らせる
3. **バッチ生成**: まとめて生成してAPIコールを削減
4. **ユーザー生成コンテンツ**: 将来的にユーザーに一部を作成してもらう

### Q5: 中級・上級パターンの例は？

**中級例:**

```typescript
{
  patternName: "I'm thinking about X-ing",
  description: "〜しようかと考えている（婉曲表現）",
  examples: [
    "I'm thinking about changing jobs.",
    "I'm thinking about moving to Tokyo.",
    // ...
  ]
}
```

**上級例:**

```typescript
{
  patternName: "It might be worth X-ing",
  description: "〜する価値があるかもしれない（提案）",
  examples: [
    "It might be worth trying that restaurant.",
    "It might be worth investing in that stock.",
    // ...
  ]
}
```

---

## まとめ

このドキュメントでは、パターン学習モードの実装を具体的なコードレベルまで詳細化しました。

**キーポイント:**

1. **DB設計**: highlightWord方式でシンプルに実装
2. **音声生成**: OpenAI TTS + R2で低コスト実現
3. **画像生成**: DALL-E 3でリアルな2コマ漫画
4. **ハイライト表示**: 正規表現で変化部分を強調
5. **段階的実装**: 2-3週間で実装可能

実装の優先順位は **Phase 1 → Phase 2 → Phase 3** の順で進め、まずは1つのパターンセットで動作確認することを推奨します。
