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
    japaneseSentence: '彼、来るはずなんだけど。',
    englishReply: "Really? He's not here yet?",
    japaneseReply: 'え、まだ来てないの？',
    incorrectOptions: [
      '彼、来たいって言ってたよ。',
      '彼、来てもいいって。',
      '彼、早く来ないかな。',
    ],
  },
  {
    place: 'リビングのソファ',
    senderRole: '妻',
    senderVoice: 'female',
    receiverRole: '夫',
    receiverVoice: 'male',
    englishSentence: 'He is supposed to call me.',
    japaneseSentence: '彼から電話が来るはずなんだけど。',
    englishReply: "Oh, he hasn't called yet?",
    japaneseReply: 'え、まだ電話来てないんだ。',
    incorrectOptions: [
      '彼に電話してみようかな。',
      '彼の電話番号知ってる？',
      '彼からメール来てる？',
    ],
  },
  {
    place: 'オフィスの自席',
    senderRole: '同僚',
    senderVoice: 'male',
    receiverRole: '同僚',
    receiverVoice: 'female',
    englishSentence: 'He is supposed to be back.',
    japaneseSentence: '彼、もう戻ってるはずなんだけど。',
    englishReply: "Hmm, he hasn't come back yet?",
    japaneseReply: 'え、まだ戻ってないの？',
    incorrectOptions: [
      '彼、今日休みなのかな。',
      '彼、この後戻ってくるって。',
      '彼、どこ行ったか知ってる？',
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
