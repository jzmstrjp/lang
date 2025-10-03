'use client';

import { useState } from 'react';
import PatternLearningFlow from '@/components/pattern/pattern-learning-flow';

// モックデータ
const MOCK_PATTERN_SETS = [
  {
    id: 'pattern-1',
    patternName: 'Can you pass me the 〇〇〇?',
    patternMeaning: '〇〇〇を取ってくれませんか？',
    patternDescription: '物を取ってもらう依頼表現',
    examples: [
      {
        id: 'example-1',
        order: 1,
        englishSentence: 'Can you pass me the salt?',
        japaneseSentence: 'お塩を取ってくれない？',
        japaneseReply: 'はい、どうぞ。',
        place: '食卓',
        senderRole: '妻',
        receiverRole: '夫',
        senderVoice: 'female' as const,
        receiverVoice: 'male' as const,
        // ダミーファイルを使用
        audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
        audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
        imageUrl: '/dummyData/image/dummy-scene1.webp',
      },
      {
        id: 'example-2',
        order: 2,
        englishSentence: 'Can you pass me the remote?',
        japaneseSentence: 'リモコンを取ってくれない？',
        japaneseReply: 'はい、どうぞ。',
        place: 'リビング',
        senderRole: '夫',
        receiverRole: '妻',
        senderVoice: 'male' as const,
        receiverVoice: 'female' as const,
        audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
        audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
        imageUrl: '/dummyData/image/dummy-scene2.webp',
      },
      {
        id: 'example-3',
        order: 3,
        englishSentence: 'Can you pass me the pen?',
        japaneseSentence: 'ペンを取ってくれない？',
        japaneseReply: 'いいよ、どれ？',
        place: 'オフィス',
        senderRole: '同僚',
        receiverRole: '同僚',
        senderVoice: 'female' as const,
        receiverVoice: 'male' as const,
        audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
        audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
        imageUrl: '/dummyData/image/dummy-scene3.webp',
      },
    ],
    testProblem: {
      questionPattern: 'Can you pass me the 〇〇〇?',
      correctAnswer: '〇〇〇を取ってくれませんか？',
      incorrectOptions: [
        '〇〇〇を買いに行きましょう。',
        '〇〇〇が好きです。',
        '〇〇〇はどこですか？',
      ],
    },
    additionalExamples: [
      { english: 'Can you pass me the book?', japanese: '本を取ってくれませんか？' },
      { english: 'Can you pass me the water?', japanese: '水を取ってくれませんか？' },
      { english: 'Can you pass me the phone?', japanese: '電話を取ってくれませんか？' },
    ],
  },
  {
    id: 'pattern-2',
    patternName: 'I want to 〇〇〇',
    patternMeaning: '〇〇〇したい',
    patternDescription: '希望を伝える表現',
    examples: [
      {
        id: 'example-4',
        order: 1,
        englishSentence: 'I want to eat pizza.',
        japaneseSentence: 'ピザが食べたいな。',
        japaneseReply: '注文しましょう！',
        place: 'リビング',
        senderRole: '子供',
        receiverRole: '母親',
        senderVoice: 'male' as const,
        receiverVoice: 'female' as const,
        audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
        audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
        imageUrl: '/dummyData/image/dummy-scene1.webp',
      },
      {
        id: 'example-5',
        order: 2,
        englishSentence: 'I want to watch a movie.',
        japaneseSentence: '映画が見たいな。',
        japaneseReply: 'どんな映画？',
        place: 'リビング',
        senderRole: '夫',
        receiverRole: '妻',
        senderVoice: 'male' as const,
        receiverVoice: 'female' as const,
        audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
        audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
        imageUrl: '/dummyData/image/dummy-scene2.webp',
      },
      {
        id: 'example-6',
        order: 3,
        englishSentence: 'I want to go shopping.',
        japaneseSentence: '買い物に行きたいな。',
        japaneseReply: 'いいよ、いつ？',
        place: 'リビング',
        senderRole: '妻',
        receiverRole: '夫',
        senderVoice: 'female' as const,
        receiverVoice: 'male' as const,
        audioEnUrl: '/dummyData/audio/dummy-en-sentence.mp3',
        audioJaUrl: '/dummyData/audio/dummy-ja-reply.mp3',
        imageUrl: '/dummyData/image/dummy-scene3.webp',
      },
    ],
    testProblem: {
      questionPattern: 'I want to 〇〇〇',
      correctAnswer: '〇〇〇したい。',
      incorrectOptions: ['〇〇〇を買いたい。', '〇〇〇を見たい。', '〇〇〇はどこ？'],
    },
    additionalExamples: [
      { english: 'I want to play games.', japanese: 'ゲームがしたい。' },
      { english: 'I want to study English.', japanese: '英語を勉強したい。' },
      { english: 'I want to sleep.', japanese: '寝たい。' },
    ],
  },
];

export default function PatternLearningPage() {
  const [currentPatternSet, setCurrentPatternSet] = useState(() => {
    // ランダムに1つのパターンセットを選択
    const randomIndex = Math.floor(Math.random() * MOCK_PATTERN_SETS.length);
    return MOCK_PATTERN_SETS[randomIndex];
  });

  const handleNextPattern = () => {
    // 次のパターンセットをランダムに選択
    const randomIndex = Math.floor(Math.random() * MOCK_PATTERN_SETS.length);
    setCurrentPatternSet(MOCK_PATTERN_SETS[randomIndex]);
  };

  return <PatternLearningFlow patternSet={currentPatternSet} onNextPattern={handleNextPattern} />;
}
