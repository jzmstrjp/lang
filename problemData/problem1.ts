import { SeedProblemData } from '../src/types/problem';

/**
 * 問題データ 1（テスト用: 過去・未来をAIが描きやすいパターン）
 */
const problemData: SeedProblemData[] = [
  {
    // 「もうすぐ着く」→ AIが「もう到着した」絵を描きがち
    place: '自分の車の中',
    senderRole: '会社員',
    senderVoice: 'male',
    senderName: 'ダイキ',
    senderAppearance:
      '服装や髪型は普通だが、俳優・モデル・アイドルのような最強の顔面を持つ絶世の美青年。ヨーロッパ人25%と日本人75%のクォーター。爽やかな感じ。',
    receiverRole: 'ダイキの妻',
    receiverVoice: 'female',
    receiverName: 'ナナ',
    receiverAppearance:
      '服装や髪型は普通だが、女優・モデル・アイドルのような最強の顔面を持つ絶世の美女。穏やかな感じ。',
    englishSentence: "I'm almost there — I'll be home in about five minutes.",
    japaneseSentence: 'もうすぐだよ。あと5分くらいで着くから。',
    englishReply: "Okay! Dinner's almost ready.",
    japaneseReply: 'わかった！夕食ももうすぐできるよ。',
    how: '電話',
    senderWhen: '自宅まで残り5分の道を運転しながら電話した時',
    receiverPlace: '自宅のキッチン',
    senderWhy: 'ナナを安心させたかったから',
    senderWant: '帰宅前に夕食の準備をしておいてほしかったから',
    incorrectOptions: ['もう着いたよ。', '5時間後に着く。', '家を出た。'],
    difficultyLevel: null,
    expression: 'almost',
    expressionJa: 'もうすぐ',
  },
  {
    // 「今ケーキを焼いているところ」→ AIが「焼き上がったケーキ」を描きがち
    place: '自宅のキッチン',
    senderRole: '主婦',
    senderVoice: 'female',
    senderName: 'ユイ',
    senderAppearance:
      '服装や髪型は普通だが、女優・モデル・アイドルのような最強の顔面を持つ絶世の美女。明るい感じ。',
    receiverRole: 'ユイの娘',
    receiverVoice: 'female',
    receiverName: 'ハナ',
    receiverAppearance:
      '服装や髪型は普通だが、女優・モデル・アイドルのような最強の顔面を持つ絶世の美女。元気な感じ。',
    englishSentence: "I'm baking a chocolate cake right now, so the kitchen smells amazing.",
    japaneseSentence: '今チョコレートケーキを焼いてるところで、キッチンがすごくいい匂い。',
    englishReply: "Can't wait! How much longer?",
    japaneseReply: '楽しみ！あとどのくらいかかる？',
    how: '対面',
    senderWhen: 'オーブンにケーキを入れて待っている時にハナが来た',
    receiverPlace: 'ユイの隣のキッチン',
    senderWhy: 'ハナが嬉しそうな反応をするのが好きだから',
    senderWant: 'ハナに楽しみに待っていてほしかったから',
    incorrectOptions: ['ケーキを食べ終わった。', 'ケーキを捨てた。', '冷蔵庫を焼いた。'],
    difficultyLevel: null,
    expression: 'bake',
    expressionJa: '焼く',
  },
  {
    // 「今から髪を切ってもらう」→ AIが「切り終わった後の髪型」を描きがち
    place: '美容院の待合スペース',
    senderRole: '大学生',
    senderVoice: 'female',
    senderName: 'リカ',
    senderAppearance:
      '服装や髪型は普通だが、女優・モデル・アイドルのような最強の顔面を持つ絶世の美女。活発な感じ。',
    receiverRole: 'リカの友人',
    receiverVoice: 'female',
    receiverName: 'メイ',
    receiverAppearance:
      '服装や髪型は普通だが、女優・モデル・アイドルのような最強の顔面を持つ絶世の美女。おしゃれな感じ。',
    englishSentence: "I'm about to get my hair cut — I'm finally going short!",
    japaneseSentence: 'もうすぐ髪切ってもらうんだ。ついにショートにするよ！',
    englishReply: 'Oh wow, send me a picture after!',
    japaneseReply: 'えー！終わったら写真送って！',
    how: '電話',
    senderWhen: '美容院の待合スペースで順番を待ちながら電話した時',
    receiverPlace: 'メイの自室',
    senderWhy: 'ずっと迷っていたショートへの決断をメイに報告したかったから',
    senderWant: 'メイに背中を押してほしかったから',
    incorrectOptions: ['髪を伸ばすことにした。', '美容院を出た。', '髪を全部剃った。'],
    difficultyLevel: null,
    expression: 'be about to',
    expressionJa: 'もうすぐ〜するところ',
  },
];

export default problemData;
