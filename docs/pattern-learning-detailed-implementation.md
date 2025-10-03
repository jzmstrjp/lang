# パターン学習モード 詳細実装ガイド

## コンセプト

**なぜ日本人は中高6年も英語を勉強したのに英語を話せないの？**

子供は学習データの差分から言語を理解します：

```
「Can you pass me the salt?」→「はい、お塩どうぞ」
「Can you pass me the remote?」→「はい、リモコンどうぞ」
「Can you pass me the pen?」→「はい、ペンどうぞ」
```

これを見て人間の脳は自動的に「Pass me the 〇〇〇.」が「〇〇〇をとってもらえる？」という意味だと理解します。

このWebアプリでは、この自然な学習プロセスを再現します。

## 目次

1. [ユーザーストーリー](#ユーザーストーリー)
2. [学習フロー設計](#学習フロー設計)
3. [データベース設計](#データベース設計)
4. [音声生成の実装](#音声生成の実装)
5. [画像生成の実装](#画像生成の実装)
6. [実装コード例](#実装コード例)
7. [シード生成スクリプト](#シード生成スクリプト)

---

## ユーザーストーリー

### 体験の流れ

ユーザー「お、パターン学習モードってのがあるな」

#### 例文1

食卓にいる女性の画像  
音声：「Can you pass me the salt?」

食卓にいる男性の画像  
音声：「はい、お塩どうぞ」

ユーザー「ふーん、『Can you pass me the salt?』で『お塩どうぞ』って返ってるのか」

画面：「次の例へ」ボタン  
ユーザー「ポチッ」

#### 例文2

リビングにいる男性の画像  
音声：「Can you pass me the remote?」

リビングにいる女性の画像  
音声：「はい、リモコンどうぞ」

ユーザー「あれ？今度は『remote』だ。でも返答は同じように『どうぞ』って渡してるな」

画面：「次の例へ」ボタン  
ユーザー「ポチッ」

#### 例文3

オフィスにいる女性の画像  
音声：「Can you pass me the pen?」

オフィスにいる男性の画像  
音声：「いいよ、どれ？」

ユーザー「おっ、今度は『pen』だ」  
ユーザー「salt、remote、pen...あ、ここが変わってるんだ！」  
ユーザー「『Can you pass me the 〇〇〇?』で『〇〇〇を取ってもらう』って意味なのかな？」

#### テスト問題

画面：大きく表示される

```
「Can you pass me the 〇〇〇?」
の意味はどれでしょう？
```

画面：4択表示

- 〇〇〇を取ってくれませんか？ ←
- 〇〇〇を買いに行きましょう
- 〇〇〇が好きです
- 〇〇〇はどこですか？

ユーザー「おっ、〇〇〇って書いてある！」  
ユーザー「特定の単語じゃなくて、構文全体の意味を聞かれてるんだな」  
ユーザー「さっき学んだパターンだと...『〇〇〇を取ってくれませんか？』だな。ポチッ」

#### 結果

画面：「正解です！🎉」  
画面：「パターンを理解できていますね！」

```
✓ Can you pass me the [object]? のパターンを習得
✓ 構文の意味を正しく理解できました
```

ユーザー「やった！」  
ユーザー「これ、bookとかcoffeeとか、どんな単語を入れても使えるってことか」  
ユーザー「『book』って単語を訳せたんじゃなくて、『このパターン全体』の意味が分かったぞ！」

画面：

```
このパターンを使った例：
- Can you pass me the book? → 本を取ってくれませんか？
- Can you pass me the water? → 水を取ってくれませんか？
- Can you pass me the phone? → 電話を取ってくれませんか？
```

ユーザー「おお、どんな物にも使えるんだ！」  
ユーザー「単語を一つ一つ覚えるんじゃなくて、構文を理解すれば応用が効くのか」

### このモードの優位性

- **構文理解の達成感**：単語の暗記ではなく「構造を理解できた」という本質的な学びの喜びがある
- **応用力の実感**：〇〇〇という変数で提示することで、無限の応用が可能だと理解できる
- **差分学習**：複数の例の「違い」に注目することで、言語の本質的な構造を理解できる
- **脳の自然なプロセス**：明示的に「どこが違う？」と聞かずとも、人間の脳が自動的に差分を見つける
- **抽象化された知識**：「book = 本」という個別知識ではなく、構文という抽象的な知識を獲得できる

---

## 学習フロー設計

### シンプルな3ステップ

```
1. 例文を見る（3〜5個）
   ↓
2. テスト問題「〇〇〇」形式で構文理解を確認
   ↓
3. 正解後、応用例を表示
```

**重要：「パターン発見チャレンジ」は不要**

- ❌ 「どこが変わっていますか？」と明示的に聞く
- ❌ ハイライト表示で答えを教える
- ✅ 人間の脳が自動的に差分を見つけるプロセスに任せる

---

## データベース設計

### 設計思想

**既存テーブルの再利用**：パターン学習の例文は、通常の`Problem`と同じ構造を持っています。新しいテーブルを作らず、既存の`Problem`テーブルに`patternId`フィールドを追加することで、データの重複を避けます。

### メリット

1. **データの再利用**: パターン学習で使った問題が、shortモードなど通常の学習でも出現する
2. **復習効果**: 「あ、これパターン学習で見たやつだ！」という定着効果
3. **テーブル削減**: `pattern_examples`テーブルが不要になり、設計がシンプルに
4. **クエリの統一**: 通常問題とパターン問題を同じAPIで扱える

### 必要なデータ

1. **パターンセット**: パターンのメタ情報
2. **例文**: `Problem`テーブルに`patternId`を付けて保存
3. **テスト問題**: 「〇〇〇」形式での構文理解確認
4. **応用例**: 正解後に表示する追加の具体例

### Prismaスキーマの変更

```prisma
// prisma/schema.prisma の既存Problemモデルを拡張

model Problem {
  id                String     @id @default(cuid())

  // 既存フィールド
  wordCount         Int
  englishSentence   String
  japaneseSentence  String
  japaneseReply     String
  englishReply      String
  incorrectOptions  Json
  senderVoice       VoiceType
  senderRole        String
  receiverVoice     VoiceType
  receiverRole      String
  place             String

  audioEnUrl        String?
  audioJaUrl        String?
  audioEnReplyUrl   String?
  imageUrl          String?
  audioReady        Boolean    @default(false)

  // ✨ 新規追加: パターン学習用フィールド
  patternId         String?                    // パターン学習の一部なら設定
  patternOrder      Int?                       // パターン内での順序（1, 2, 3...）
  pattern           PatternSet? @relation(fields: [patternId], references: [id], onDelete: Cascade)

  createdAt         DateTime   @default(now())
  updatedAt         DateTime   @updatedAt

  @@unique([englishSentence])
  @@index([wordCount, audioReady])
  @@index([patternId, patternOrder])  // ✨ 新規インデックス
  @@map("problems")
}

// 新規追加: パターンセット
model PatternSet {
  id                   String              @id @default(cuid())
  patternName          String              // "Can you pass me the 〇〇〇?"（〇〇〇形式で保存）
  patternMeaning       String              // "〇〇〇を取ってくれませんか？"（〇〇〇形式で保存）
  patternDescription   String              // "物を取ってもらう依頼表現"
  difficulty           DifficultyLevel     @default(beginner)

  examples             Problem[]           // ✨ PatternExampleではなくProblem！
  testProblem          PatternTestProblem?
  additionalExamples   Json?               // 正解後に表示する応用例（配列）
  relatedPatternIds    String[]            // 関連パターンのIDリスト

  createdAt            DateTime            @default(now())
  updatedAt            DateTime            @updatedAt

  @@index([difficulty])
  @@map("pattern_sets")
}

// PatternExampleテーブルは削除！代わりにProblemを使う

model PatternTestProblem {
  id                String     @id @default(cuid())
  patternSetId      String     @unique
  patternSet        PatternSet @relation(fields: [patternSetId], references: [id], onDelete: Cascade)

  // テスト問題（〇〇〇形式で問う）
  questionPattern   String     // "Can you pass me the 〇〇〇?"
  correctAnswer     String     // "〇〇〇を取ってくれませんか？"
  incorrectOptions  Json       // 不正解の選択肢（配列）

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

### クエリ例

```typescript
// パターンの例文を取得
const examples = await prisma.problem.findMany({
  where: {
    patternId: 'pattern_123',
  },
  orderBy: {
    patternOrder: 'asc',
  },
});

// 通常問題を取得（パターン学習の問題も含む）
const allProblems = await prisma.problem.findMany({
  where: {
    wordCount: { gte: 3, lte: 7 },
    audioReady: true,
    // patternIdがあってもなくても全部取得される
  },
});

// パターン学習専用の問題だけ除外したい場合
const onlyStandalone = await prisma.problem.findMany({
  where: {
    wordCount: { gte: 3, lte: 7 },
    patternId: null, // パターン学習に属さない問題のみ
  },
});
```

### マイグレーションコマンド

```bash
# スキーマ変更後、マイグレーションを生成
npx prisma migrate dev --name add_pattern_learning_to_problems

# 本番環境へのデプロイ
npx prisma migrate deploy
```

**主な変更点:**

- `Problem`テーブルに`patternId`、`patternOrder`フィールドを追加
- 新規テーブル: `PatternSet`、`PatternTestProblem`
- 新しいenum: `DifficultyLevel`
- 新しいインデックス: `problems`の`[patternId, patternOrder]`

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

### 既存システムを流用

**朗報**: `/src/lib/problem-generator.ts`の`generateImagePrompt()`関数がそのまま使えます！

既存の実装は十分に洗練されており、パターン学習でも同じプロンプト生成ロジックを流用できます。

```typescript
// 既存の実装をそのまま使用
import { generateImagePrompt, generateAndUploadImageAsset } from '@/lib/problem-generator';
```

### 画像生成の流れ

```
1. プロンプト生成（既存関数） → 2. OpenAI DALL-E 3 → 3. Buffer取得 → 4. WebP変換 → 5. R2アップロード
```

### パターン例文用の画像生成

```typescript
// /src/lib/pattern-image-generator.ts（新規作成）

import { generateAndUploadImageAsset } from '@/lib/problem-generator';
import type { Problem } from '@prisma/client';

/**
 * パターン例文用の画像を生成してR2にアップロード
 * 既存のproblem-generatorの関数を流用
 *
 * 注: ProblemとPatternExampleは同じ構造なので、そのまま使える！
 */
export async function generatePatternExampleImage(
  exampleId: string,
  example: Pick<
    Problem,
    | 'englishSentence'
    | 'japaneseSentence'
    | 'englishReply'
    | 'japaneseReply'
    | 'place'
    | 'senderRole'
    | 'receiverRole'
    | 'senderVoice'
    | 'receiverVoice'
  >,
): Promise<string> {
  console.log(`[Pattern Image] 画像生成開始: ${exampleId}`);

  // 既存の関数をそのまま使用
  const imageUrl = await generateAndUploadImageAsset(
    {
      englishSentence: example.englishSentence,
      japaneseSentence: example.japaneseSentence,
      englishReply: example.englishReply,
      japaneseReply: example.japaneseReply,
      place: example.place,
      senderRole: example.senderRole,
      receiverRole: example.receiverRole,
      senderVoice: example.senderVoice,
      receiverVoice: example.receiverVoice,
      wordCount: 0, // ダミー値
      incorrectOptions: [], // ダミー値
    },
    exampleId,
  );

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
        // ✨ examplesはProblemの配列
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
        // ✨ examplesはProblemテーブルから取得
        examples: {
          orderBy: {
            patternOrder: 'asc', // orderではなくpatternOrder
          },
        },
        testProblem: true,
      },
    });

    if (!patternSet) {
      return NextResponse.json({ error: 'Pattern set not found' }, { status: 404 });
    }

    // incorrectOptionsとadditionalExamplesをパース
    const testProblem = patternSet.testProblem
      ? {
          ...patternSet.testProblem,
          incorrectOptions: Array.isArray(patternSet.testProblem.incorrectOptions)
            ? patternSet.testProblem.incorrectOptions
            : JSON.parse(patternSet.testProblem.incorrectOptions as string),
        }
      : null;

    const additionalExamples = patternSet.additionalExamples
      ? Array.isArray(patternSet.additionalExamples)
        ? patternSet.additionalExamples
        : JSON.parse(patternSet.additionalExamples as string)
      : [];

    return NextResponse.json({
      patternSet: {
        ...patternSet,
        testProblem,
        additionalExamples,
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
import { generatePatternExampleImage } from '../src/lib/pattern-image-generator';
import { countWords } from '../src/config/problem';

const prisma = new PrismaClient();

/**
 * パターンセットの定義（TypeScript型）
 */
type PatternSetDefinition = {
  patternName: string; // "Can you pass me the 〇〇〇?"
  patternMeaning: string; // "〇〇〇を取ってくれませんか？"
  patternDescription: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  examples: Array<{
    order: number;
    englishSentence: string;
    japaneseSentence: string;
    place: string;
    senderRole: string;
    receiverRole: string;
    senderVoice: 'male' | 'female';
    receiverVoice: 'male' | 'female';
    englishReply: string;
    japaneseReply: string;
  }>;
  testProblem: {
    questionPattern: string; // "Can you pass me the 〇〇〇?"
    correctAnswer: string; // "〇〇〇を取ってくれませんか？"
    incorrectOptions: string[];
  };
  additionalExamples?: Array<{
    english: string;
    japanese: string;
  }>;
  relatedPatternIds?: string[];
};

/**
 * 初級パターンセットのデータ
 */
const beginnerPatterns: PatternSetDefinition[] = [
  {
    patternName: 'Can you pass me the 〇〇〇?',
    patternMeaning: '〇〇〇を取ってくれませんか？',
    patternDescription: '物を取ってもらう依頼表現',
    difficulty: 'beginner',
    examples: [
      {
        order: 1,
        englishSentence: 'Can you pass me the salt?',
        japaneseSentence: 'お塩を取ってくれない？',
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
      questionPattern: 'Can you pass me the 〇〇〇?',
      correctAnswer: '〇〇〇を取ってくれませんか？',
      incorrectOptions: ['〇〇〇を買いに行きましょう', '〇〇〇が好きです', '〇〇〇はどこですか？'],
    },
    additionalExamples: [
      { english: 'Can you pass me the book?', japanese: '本を取ってくれませんか？' },
      { english: 'Can you pass me the water?', japanese: '水を取ってくれませんか？' },
      { english: 'Can you pass me the phone?', japanese: '電話を取ってくれませんか？' },
    ],
  },
  {
    patternName: 'I want to 〇〇〇',
    patternMeaning: '〇〇〇したい',
    patternDescription: '希望を伝える表現',
    difficulty: 'beginner',
    examples: [
      {
        order: 1,
        englishSentence: 'I want to eat pizza.',
        japaneseSentence: 'ピザが食べたいな',
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
      questionPattern: 'I want to 〇〇〇',
      correctAnswer: '〇〇〇したい',
      incorrectOptions: ['〇〇〇を買いたい', '〇〇〇を見たい', '〇〇〇はどこ？'],
    },
    additionalExamples: [
      { english: 'I want to play games.', japanese: 'ゲームがしたい' },
      { english: 'I want to study English.', japanese: '英語を勉強したい' },
      { english: 'I want to sleep.', japanese: '寝たい' },
    ],
  },
  {
    patternName: 'Where is 〇〇〇?',
    patternMeaning: '〇〇〇はどこですか？',
    patternDescription: '場所や物の位置を尋ねる表現',
    difficulty: 'beginner',
    examples: [
      {
        order: 1,
        englishSentence: 'Where is the bathroom?',
        japaneseSentence: 'トイレはどこですか？',
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
      questionPattern: 'Where is 〇〇〇?',
      correctAnswer: '〇〇〇はどこですか？',
      incorrectOptions: ['〇〇〇に行きたい', '〇〇〇で勉強しよう', '〇〇〇は開いていますか？'],
    },
    additionalExamples: [
      { english: 'Where is the library?', japanese: '図書館はどこですか？' },
      { english: 'Where is the exit?', japanese: '出口はどこですか？' },
      { english: 'Where is my bag?', japanese: '私のバッグはどこ？' },
    ],
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
      patternMeaning: definition.patternMeaning,
      patternDescription: definition.patternDescription,
      difficulty: definition.difficulty,
      additionalExamples: definition.additionalExamples
        ? JSON.stringify(definition.additionalExamples)
        : null,
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
      generatePatternExampleImage(`${patternSet.id}_example_${exampleDef.order}`, exampleDef),
    ]);

    // ✨ DBに保存（Problemテーブルを使う！）
    await prisma.problem.create({
      data: {
        // パターン学習用フィールド
        patternId: patternSet.id,
        patternOrder: exampleDef.order,

        // 通常のフィールド
        wordCount: countWords(exampleDef.englishSentence),
        englishSentence: exampleDef.englishSentence,
        japaneseSentence: exampleDef.japaneseSentence,
        place: exampleDef.place,
        senderRole: exampleDef.senderRole,
        receiverRole: exampleDef.receiverRole,
        senderVoice: exampleDef.senderVoice,
        receiverVoice: exampleDef.receiverVoice,
        englishReply: exampleDef.englishReply,
        japaneseReply: exampleDef.japaneseReply,

        // incorrectOptionsは空配列（パターン学習では個別問題として出さない）
        incorrectOptions: JSON.stringify([]),

        // メディア
        audioEnUrl: audioUrls.audioEnUrl,
        audioJaUrl: audioUrls.audioJaUrl,
        audioEnReplyUrl: audioUrls.audioEnReplyUrl,
        imageUrl: imageUrl,
        audioReady: true,
      },
    });

    console.log(`[Seed] 例文 ${exampleDef.order} 完了`);
  }

  // 3. テスト問題を生成
  console.log(`[Seed] テスト問題生成中...`);

  await prisma.patternTestProblem.create({
    data: {
      patternSetId: patternSet.id,
      questionPattern: definition.testProblem.questionPattern,
      correctAnswer: definition.testProblem.correctAnswer,
      incorrectOptions: JSON.stringify(definition.testProblem.incorrectOptions),
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
    // ✨ PatternExampleではなく、patternId付きのProblemを削除
    await prisma.problem.deleteMany({
      where: {
        patternId: { not: null },
      },
    });
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

### Q3: なぜ「パターン発見チャレンジ」を削除したのですか？

**A:** 人間の脳は自動的に差分を見つける能力があるためです。

- ❌ 明示的に「どこが違う？」と聞く → 不自然で教育的すぎる
- ✅ 例を見せて、いきなりテスト → 自然な学習プロセスに任せる

子供が言語を習得する過程と同じように、脳が勝手にパターンを見つけるのを信頼します。

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

1. **シンプルな学習フロー**: 例文を見る → テスト（〇〇〇形式） → 応用例を表示
2. **脳の自然なプロセスを信頼**: パターン発見チャレンジは不要、人間の脳が自動的に差分を見つける
3. **構文理解を問うテスト**: 特定の単語ではなく「〇〇〇」で抽象的な構文理解を確認
4. **既存システムの活用**: 画像・音声生成は既存のproblem-generatorを流用
5. **Problemテーブルの再利用**: PatternExampleテーブルを作らず、既存Problemに`patternId`を追加
6. **データの循環**: パターン学習で見た問題が、通常モードでも復習として出現

**実装の優先順位:**

1. **Phase 1**: Prismaスキーマ追加・マイグレーション
2. **Phase 2**: シードスクリプトで1パターンセット生成
3. **Phase 3**: API実装（一覧・詳細）
4. **Phase 4**: フロントエンド実装（例文表示 → テスト → 結果）
5. **Phase 5**: 複数パターンセット追加・UI改善

**合計: 約2週間で最小限の動作版を実装可能**

重要なのは、「教える」のではなく「気づかせる」体験を作ること。人間の脳の自然な学習プロセスを信頼し、余計な機能を削ぎ落としたシンプルな設計が成功の鍵です。

**データ設計の工夫:**

`Problem`テーブルに`patternId`を追加することで、パターン学習で使った問題が通常モードでも自然に出現します。これにより：

- ユーザーは「あ、これ前にパターン学習で見たやつだ！」という気づきを得られる
- 同じ構文を異なるコンテキストで復習でき、記憶が定着しやすい
- 新しいテーブルを作らないため、システムがシンプルに保たれる

この「偶然の復習」効果が、長期記憶への定着を促します。
