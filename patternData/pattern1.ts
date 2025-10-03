import { SeedProblemData } from '../src/types/problem';
import type { Prisma } from '@prisma/client';

/**
 * パターン学習用データ: "be supposed to 〜"（〜はずだ）
 *
 * 単語を知っていても意味が推測できない熟語の代表例。
 * suppose = 「思う、仮定する」だが、be supposed to では「〜はずだ」という予定・予想の意味になる。
 */

// PatternSetのシードデータ型（リレーション含む、自動生成フィールド除く）
type SeedPatternSetData = Omit<
  Prisma.PatternSetCreateInput,
  'id' | 'createdAt' | 'updatedAt' | 'examples'
>;

// パターンの例文（必ず3個）
const examples: SeedProblemData[] = [
  {
    place: 'リビングのソファ',
    senderRole: '娘',
    senderVoice: 'female',
    receiverRole: '母',
    receiverVoice: 'female',
    englishSentence: 'He is supposed to come.',
    japaneseSentence: '彼は来るはずなんだ。',
    englishReply: "I see, but he hasn't come yet.",
    japaneseReply: 'そうなんだ、でもなかなか来ないね。',
    incorrectOptions: [
      '彼はダンスが上手なんだ。',
      '彼はギターが趣味なんだ。',
      '彼からプレゼントをもらったの。',
    ],
  },
  {
    place: 'リビングのソファ',
    senderRole: '妻',
    senderVoice: 'female',
    receiverRole: '夫',
    receiverVoice: 'male',
    englishSentence: 'He is supposed to call me.',
    japaneseSentence: '彼は私に電話してくるはずなの。',
    englishReply: "I see, I wonder when he'll call.",
    japaneseReply: 'そっか、いつ頃電話してくるんだろうね。',
    incorrectOptions: [
      '彼は新しいスーツを買ったらしいよ。',
      'いつから彼と知り合いなんだっけ？',
      'あの人たちは本当に仲良しだよね。',
    ],
  },
  {
    place: 'オフィスの自席',
    senderRole: '同僚',
    senderVoice: 'male',
    receiverRole: '同僚',
    receiverVoice: 'female',
    englishSentence: 'He is supposed to be back.',
    japaneseSentence: '彼は戻っているはずなんだ。',
    englishReply: "Yes, but he hasn't come back yet.",
    japaneseReply: 'ええ、でも戻ってないですね。',
    incorrectOptions: [
      'この間、彼と飲みに行ったんだ。',
      '彼は本当に愉快な人だよね。',
      '彼のことを断じて許さない。',
    ],
  },
];

// PatternSetのシードデータ（Prismaスキーマに準拠）
const patternSetData: SeedPatternSetData = {
  patternName: 'He is supposed to 〇〇〇.',
  correctAnswer: '彼は〇〇〇するはずだ。',
  incorrectOptions: ['彼は〇〇〇が好きだ。', '彼は〇〇〇を知っている。', '彼は〇〇〇になりたい。'],
};

const pattern1 = {
  ...patternSetData,
  examples,
};

export default pattern1;
