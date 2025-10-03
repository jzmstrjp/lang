import type { VoiceType, PatternSet } from '@prisma/client';
import { shuffleArray } from '@/lib/shuffle-utils';
import { prisma } from '@/lib/prisma';

/**
 * パターン例文（Problemの一部フィールドのみ使用）
 */
export type PatternExample = {
  id: string;
  englishSentence: string;
  japaneseSentence: string;
  japaneseReply: string;
  place: string;
  senderRole: string;
  receiverRole: string;
  senderVoice: VoiceType;
  receiverVoice: VoiceType;
  audioEnUrl: string; // null不可
  audioJaUrl: string; // null不可
  imageUrl: string; // null不可
  incorrectOptions: string[]; // 例文クイズ用の不正解選択肢
};

/**
 * パターンセット（例文込み）
 */
export type PatternSetWithDetails = PatternSet & {
  examples: PatternExample[];
};

/**
 * ランダムなパターンセットを1つ返す（DB接続版）
 */
export async function fetchRandomPatternSet(): Promise<PatternSetWithDetails | null> {
  // DBから全パターンセットを取得
  const patternSets = await prisma.patternSet.findMany({
    include: {
      examples: {
        select: {
          id: true,
          englishSentence: true,
          japaneseSentence: true,
          japaneseReply: true,
          place: true,
          senderRole: true,
          receiverRole: true,
          senderVoice: true,
          receiverVoice: true,
          audioEnUrl: true,
          audioJaUrl: true,
          imageUrl: true,
          incorrectOptions: true,
        },
      },
    },
  });

  if (patternSets.length === 0) {
    console.warn('[Pattern Service] パターンセットが見つかりません');
    return null;
  }

  // ランダムに1つ選択
  const randomIndex = Math.floor(Math.random() * patternSets.length);
  const selectedPattern = patternSets[randomIndex];

  if (!selectedPattern) return null;

  // audioEnUrl, audioJaUrl, imageUrlがnullの例文を除外
  const validExamples = selectedPattern.examples
    .filter((ex) => ex.audioEnUrl && ex.audioJaUrl && ex.imageUrl)
    .map((ex) => ({
      ...ex,
      audioEnUrl: ex.audioEnUrl!,
      audioJaUrl: ex.audioJaUrl!,
      imageUrl: ex.imageUrl!,
      incorrectOptions: Array.isArray(ex.incorrectOptions) ? (ex.incorrectOptions as string[]) : [],
    })) as PatternExample[];

  if (validExamples.length === 0) {
    console.warn('[Pattern Service] 音声・画像が揃った例文がありません');
    return null;
  }

  // 例文をシャッフルして返す
  return {
    ...selectedPattern,
    examples: shuffleArray(validExamples),
  };
}

/**
 * 以下、モックデータ（開発・テスト用に残す）
 */
export async function fetchRandomPatternSetMock(): Promise<PatternSetWithDetails | null> {
  const mockPatternSets: PatternSetWithDetails[] = [
    {
      id: 'pattern-1',
      patternName: 'Can you pass me the 〇〇〇?',
      correctAnswer: '〇〇〇を取ってくれませんか？',
      incorrectOptions: [
        '〇〇〇を買いに行きましょう。',
        '〇〇〇が好きです。',
        '〇〇〇はどこですか？',
      ],
      createdAt: new Date(),
      updatedAt: new Date(),
      examples: [
        {
          id: 'example-1',
          englishSentence: 'Can you pass me the salt?',
          japaneseSentence: 'お塩を取ってくれない？',
          japaneseReply: 'はい、どうぞ。',
          place: '食卓',
          senderRole: '妻',
          receiverRole: '夫',
          senderVoice: 'female',
          receiverVoice: 'male',
          audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
          audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
          imageUrl: '/dummyData/image/dummy-scene1.webp',
          incorrectOptions: ['お塩を買ってきて。', 'お塩はどこ？', 'お塩が好きだよ。'],
        },
        {
          id: 'example-2',
          englishSentence: 'Can you pass me the remote?',
          japaneseSentence: 'リモコンを取ってくれない？',
          japaneseReply: 'はい、どうぞ。',
          place: 'リビング',
          senderRole: '夫',
          receiverRole: '妻',
          senderVoice: 'male',
          receiverVoice: 'female',
          audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
          audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
          imageUrl: '/dummyData/image/dummy-scene2.webp',
          incorrectOptions: ['リモコンを買ってきて。', 'リモコンはどこ？', 'リモコンが欲しい。'],
        },
        {
          id: 'example-3',
          englishSentence: 'Can you pass me the pen?',
          japaneseSentence: 'ペンを取ってくれない？',
          japaneseReply: 'いいよ、どれ？',
          place: 'オフィス',
          senderRole: '同僚',
          receiverRole: '同僚',
          senderVoice: 'female',
          receiverVoice: 'male',
          audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
          audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
          imageUrl: '/dummyData/image/dummy-scene3.webp',
          incorrectOptions: ['ペンを買ってきて。', 'ペンはどこ？', 'ペンが欲しい。'],
        },
      ],
    },
    {
      id: 'pattern-2',
      patternName: 'I want to 〇〇〇.',
      correctAnswer: '〇〇〇したい。',
      incorrectOptions: ['〇〇〇を買いたい。', '〇〇〇を見たい。', '〇〇〇はどこ？'],
      createdAt: new Date(),
      updatedAt: new Date(),
      examples: [
        {
          id: 'example-4',
          englishSentence: 'I want to eat pizza.',
          japaneseSentence: 'ピザが食べたいな。',
          japaneseReply: '注文しましょう！',
          place: 'リビング',
          senderRole: '子供',
          receiverRole: '母親',
          senderVoice: 'male',
          receiverVoice: 'female',
          audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
          audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
          imageUrl: '/dummyData/image/dummy-scene1.webp',
          incorrectOptions: ['ピザを注文して。', 'ピザはどこ？', 'ピザが好きだな。'],
        },
        {
          id: 'example-5',
          englishSentence: 'I want to watch a movie.',
          japaneseSentence: '映画が見たいな。',
          japaneseReply: 'どんな映画？',
          place: 'リビング',
          senderRole: '夫',
          receiverRole: '妻',
          senderVoice: 'male',
          receiverVoice: 'female',
          audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
          audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
          imageUrl: '/dummyData/image/dummy-scene2.webp',
          incorrectOptions: ['映画を予約して。', '映画はどこ？', '映画が好きだな。'],
        },
        {
          id: 'example-6',
          englishSentence: 'I want to go shopping.',
          japaneseSentence: '買い物に行きたいな。',
          japaneseReply: 'いいよ、いつ？',
          place: 'リビング',
          senderRole: '妻',
          receiverRole: '夫',
          senderVoice: 'female',
          receiverVoice: 'male',
          audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
          audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
          imageUrl: '/dummyData/image/dummy-scene3.webp',
          incorrectOptions: ['買い物を頼まれた。', '買い物はどこ？', '買い物が好きだな。'],
        },
      ],
    },
  ];

  // ランダムに1つ選択
  const randomIndex = Math.floor(Math.random() * mockPatternSets.length);
  const selectedPattern = mockPatternSets[randomIndex];

  if (!selectedPattern) return null;

  // 例文をシャッフルして返す
  return {
    ...selectedPattern,
    examples: shuffleArray(selectedPattern.examples),
  };
}
