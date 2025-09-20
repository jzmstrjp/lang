import { PrismaClient } from '@prisma/client';
import { generateSpeech } from '../src/lib/audio-utils';

const prisma = new PrismaClient();

const seedProblems = [
  // 1. 依頼系 - キッチン (short)
  {
    type: 'short' as const,
    english: 'Pass the salt?',
    japaneseReply: 'はい、塩どうぞ',
    options: ['塩取って？', '塩いらない？', 'コショウ取って？', '醤油取って？'],
    correctIndex: 0,
    sceneId: 'kitchen',
    scenePrompt:
      'キッチンで夕食の準備をしている女性が、テーブルにいる男性に対して「Pass the salt?」と尋ねる。男性が「はい、塩どうぞ」と答えながら塩を手渡す。',
    nuance: 'polite',
    genre: 'kitchen',
    patternGroup: 'basic_request',
    wordCount: 3,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 2. 提案系 - 公園 (medium)
  {
    type: 'medium' as const,
    english: "Let's go to the park today!",
    japaneseReply: 'いいね、公園行こう！',
    options: [
      '今日は公園に行こう！',
      '今日は家にいよう',
      '今日は買い物に行こう',
      '今日は映画を見よう',
    ],
    correctIndex: 0,
    sceneId: 'park',
    scenePrompt:
      "リビングルームで女性が男性に対して「Let's go to the park today!」と提案する。男性が「いいね、公園行こう！」と答えて賛成する。",
    nuance: 'casual',
    genre: 'park',
    patternGroup: 'activity_proposal',
    wordCount: 6,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 3. 質問系 - リビングルーム (short)
  {
    type: 'short' as const,
    english: 'What time is it?',
    japaneseReply: '3時だよ',
    options: ['何時？', '何日？', 'どこ？', '誰？'],
    correctIndex: 0,
    sceneId: 'living_room',
    scenePrompt:
      'リビングルームでソファに座っている女性が、テレビを見ている男性に対して「What time is it?」と質問する。男性が時計を見て「3時だよ」と答える。',
    nuance: 'casual',
    genre: 'living_room',
    patternGroup: 'basic_question',
    wordCount: 4,
    interactionIntent: 'question' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 4. 依頼系 - 子供部屋 (medium)
  {
    type: 'medium' as const,
    english: 'Can you help me clean up?',
    japaneseReply: 'うん、一緒に片付けよう',
    options: [
      '掃除手伝ってくれる？',
      '掃除はもういいよ',
      '料理手伝ってくれる？',
      '洗濯手伝ってくれる？',
    ],
    correctIndex: 0,
    sceneId: 'kids_room',
    scenePrompt:
      '子供部屋でおもちゃが散らかった状況で、女性が男性に対して「Can you help me clean up?」と依頼する。男性が「うん、一緒に片付けよう」と答える。',
    nuance: 'polite',
    genre: 'kids_room',
    patternGroup: 'help_request',
    wordCount: 6,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 5. 提案系 - 近所 (long)
  {
    type: 'long' as const,
    english: 'How about we take a walk around the neighborhood after dinner?',
    japaneseReply: 'いいね、夕食後に散歩しよう',
    options: [
      '夕食後に近所を散歩しない？',
      '夕食後は家でゆっくりしない？',
      '夕食後にドライブしない？',
      '夕食後に映画を見ない？',
    ],
    correctIndex: 0,
    sceneId: 'neighborhood',
    scenePrompt:
      'ダイニングルームで夕食を終えた女性が、男性に対して「How about we take a walk around the neighborhood after dinner?」と提案する。男性が「いいね、夕食後に散歩しよう」と答える。',
    nuance: 'polite',
    genre: 'neighborhood',
    patternGroup: 'evening_activity',
    wordCount: 11,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 6. 意見系 - ホームオフィス (medium)
  {
    type: 'medium' as const,
    english: 'I think this looks better.',
    japaneseReply: 'そうだね、こっちの方がいい',
    options: [
      'こっちの方がいいと思う',
      'あっちの方がいいと思う',
      'どっちでもいいと思う',
      'よくわからない',
    ],
    correctIndex: 0,
    sceneId: 'home_office',
    scenePrompt:
      'ホームオフィスで女性がパソコンの画面を指差しながら男性に対して「I think this looks better.」と意見を述べる。男性が「そうだね、こっちの方がいい」と同意する。',
    nuance: 'casual',
    genre: 'home_office',
    patternGroup: 'opinion_sharing',
    wordCount: 5,
    interactionIntent: 'opinion' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 7. 依頼系 - 玄関 (short)
  {
    type: 'short' as const,
    english: 'Open the door.',
    japaneseReply: 'はい、開けるね',
    options: ['ドア開けて', 'ドア閉めて', '窓開けて', '電気つけて'],
    correctIndex: 0,
    sceneId: 'entryway',
    scenePrompt:
      '玄関で荷物を持った女性が、鍵を持った男性に対して「Open the door.」と依頼する。男性が「はい、開けるね」と答えてドアを開ける。',
    nuance: 'casual',
    genre: 'entryway',
    patternGroup: 'simple_request',
    wordCount: 3,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 8. 質問系 - 食料品店 (medium)
  {
    type: 'medium' as const,
    english: 'Do we need more milk?',
    japaneseReply: 'うん、牛乳買おう',
    options: ['牛乳もっと必要？', 'パンもっと必要？', '卵もっと必要？', 'お米もっと必要？'],
    correctIndex: 0,
    sceneId: 'grocery_store',
    scenePrompt:
      '食料品店で買い物中の女性が、冷蔵庫のコーナーで男性に対して「Do we need more milk?」と質問する。男性が「うん、牛乳買おう」と答える。',
    nuance: 'casual',
    genre: 'grocery_store',
    patternGroup: 'shopping_question',
    wordCount: 5,
    interactionIntent: 'question' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 9. 提案系 - バルコニー (long)
  {
    type: 'long' as const,
    english: "Why don't we have our coffee out on the balcony this morning?",
    japaneseReply: 'いいね、バルコニーでコーヒー飲もう',
    options: [
      '今朝はバルコニーでコーヒーを飲まない？',
      '今朝は部屋でコーヒーを飲まない？',
      '今朝は紅茶を飲まない？',
      '今朝は外に出かけない？',
    ],
    correctIndex: 0,
    sceneId: 'balcony',
    scenePrompt:
      "キッチンでコーヒーを準備している女性が、男性に対して「Why don't we have our coffee out on the balcony this morning?」と提案する。男性が「いいね、バルコニーでコーヒー飲もう」と答える。",
    nuance: 'polite',
    genre: 'balcony',
    patternGroup: 'morning_activity',
    wordCount: 12,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 10. 情報共有系 - 洗濯室 (medium)
  {
    type: 'medium' as const,
    english: 'The laundry is almost done.',
    japaneseReply: 'ありがとう、確認するね',
    options: [
      '洗濯もうすぐ終わる',
      '洗濯まだまだかかる',
      '掃除もうすぐ終わる',
      '料理もうすぐ終わる',
    ],
    correctIndex: 0,
    sceneId: 'laundry_room',
    scenePrompt:
      '洗濯室で洗濯機の様子を見ている女性が、別の部屋にいる男性に対して「The laundry is almost done.」と情報を伝える。男性が「ありがとう、確認するね」と答える。',
    nuance: 'casual',
    genre: 'laundry_room',
    patternGroup: 'status_update',
    wordCount: 5,
    interactionIntent: 'info' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },
];

async function main() {
  console.log('問題と音声アセットを一括生成中...');

  for (const problemData of seedProblems) {
    try {
      console.log(`処理中: ${problemData.english}`);

      // 1. 音声生成
      const [englishAudio, japaneseAudio] = await Promise.all([
        generateSpeech(problemData.english, problemData.speakers.sceneA),
        generateSpeech(problemData.japaneseReply, problemData.speakers.sceneB),
      ]);

      // 2. 問題とアセットを同時作成
      const result = await prisma.problem.create({
        data: {
          type: problemData.type,
          english: problemData.english,
          japaneseReply: problemData.japaneseReply,
          options: problemData.options,
          correctIndex: problemData.correctIndex,
          sceneId: problemData.sceneId,
          scenePrompt: problemData.scenePrompt,
          nuance: problemData.nuance,
          genre: problemData.genre,
          patternGroup: problemData.patternGroup,
          wordCount: problemData.wordCount,
          interactionIntent: problemData.interactionIntent,
          speakersSceneA: problemData.speakers.sceneA,
          speakersSceneB: problemData.speakers.sceneB,
          isCached: true,
          qualityCheck: true,
          // 関連するアセットも同時作成
          asset: {
            create: {
              scenePrompt: problemData.scenePrompt,
              compositeImage: null,
              audioEn: englishAudio,
              audioJa: japaneseAudio,
            },
          },
        },
      });

      console.log(`✅ 完了: ${problemData.english} (ID: ${result.id})`);

      // レート制限を避けるため少し待機
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`❌ エラー: ${problemData.english}`, error);
    }
  }

  console.log('一括生成完了！');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
