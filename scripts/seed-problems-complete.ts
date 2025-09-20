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

  // === SHORT問題追加（7問） ===

  // 11. 依頼系 - バスルーム (short)
  {
    type: 'short' as const,
    english: 'Turn on the light.',
    japaneseReply: 'はい、つけるね',
    options: ['電気つけて', '電気消して', '水出して', 'ドア開けて'],
    correctIndex: 0,
    sceneId: 'bathroom',
    scenePrompt:
      'バスルームで女性が男性に対して「Turn on the light.」と依頼する。男性が「はい、つけるね」と答えて電気をつける。',
    nuance: 'casual',
    genre: 'bathroom',
    patternGroup: 'simple_request',
    wordCount: 4,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 12. 質問系 - ベッドルーム (short)
  {
    type: 'short' as const,
    english: 'Where are my keys?',
    japaneseReply: 'テーブルの上だよ',
    options: ['鍵どこ？', '財布どこ？', '携帯どこ？', '眼鏡どこ？'],
    correctIndex: 0,
    sceneId: 'bedroom',
    scenePrompt:
      'ベッドルームで女性が男性に対して「Where are my keys?」と質問する。男性が「テーブルの上だよ」と答える。',
    nuance: 'casual',
    genre: 'bedroom',
    patternGroup: 'location_question',
    wordCount: 4,
    interactionIntent: 'question' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 13. 提案系 - カフェ (short)
  {
    type: 'short' as const,
    english: "Let's sit here.",
    japaneseReply: 'いいね、ここにしよう',
    options: ['ここに座ろう', 'あそこに座ろう', '立っていよう', '外に出よう'],
    correctIndex: 0,
    sceneId: 'cafe',
    scenePrompt:
      "カフェで女性が空いている席を指差しながら男性に対して「Let's sit here.」と提案する。男性が「いいね、ここにしよう」と答える。",
    nuance: 'casual',
    genre: 'cafe',
    patternGroup: 'location_proposal',
    wordCount: 3,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 14. 情報共有系 - 車内 (short)
  {
    type: 'short' as const,
    english: "It's raining outside.",
    japaneseReply: 'そうだね、雨降ってる',
    options: ['外雨降ってる', '外晴れてる', '外雪降ってる', '外風強い'],
    correctIndex: 0,
    sceneId: 'car',
    scenePrompt:
      "車内で女性が窓の外を見ながら男性に対して「It's raining outside.」と情報を伝える。男性が「そうだね、雨降ってる」と答える。",
    nuance: 'casual',
    genre: 'car',
    patternGroup: 'weather_info',
    wordCount: 3,
    interactionIntent: 'info' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 15. 依頼系 - オフィス (short)
  {
    type: 'short' as const,
    english: 'Close the window.',
    japaneseReply: 'はい、閉めますね',
    options: ['窓閉めて', '窓開けて', 'ドア閉めて', 'カーテン閉めて'],
    correctIndex: 0,
    sceneId: 'office',
    scenePrompt:
      'オフィスで女性が男性に対して「Close the window.」と依頼する。男性が「はい、閉めますね」と答えて窓を閉める。',
    nuance: 'polite',
    genre: 'office',
    patternGroup: 'simple_request',
    wordCount: 3,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 16. 質問系 - レストラン (short)
  {
    type: 'short' as const,
    english: 'Are you ready?',
    japaneseReply: 'うん、準備できた',
    options: ['準備できた？', '疲れた？', 'お腹空いた？', '眠い？'],
    correctIndex: 0,
    sceneId: 'restaurant',
    scenePrompt:
      'レストランで女性が男性に対して「Are you ready?」と質問する。男性が「うん、準備できた」と答える。',
    nuance: 'casual',
    genre: 'restaurant',
    patternGroup: 'status_question',
    wordCount: 3,
    interactionIntent: 'question' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 17. 意見系 - ショップ (short)
  {
    type: 'short' as const,
    english: 'This looks nice.',
    japaneseReply: 'そうだね、素敵だね',
    options: ['これ素敵だね', 'これ高いね', 'これ安いね', 'これ変だね'],
    correctIndex: 0,
    sceneId: 'shop',
    scenePrompt:
      'ショップで女性が商品を手に取りながら男性に対して「This looks nice.」と意見を述べる。男性が「そうだね、素敵だね」と同意する。',
    nuance: 'casual',
    genre: 'shop',
    patternGroup: 'evaluation_opinion',
    wordCount: 3,
    interactionIntent: 'opinion' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // === MEDIUM問題追加（5問） ===

  // 18. 提案系 - 図書館 (medium)
  {
    type: 'medium' as const,
    english: 'Should we study together?',
    japaneseReply: 'いいね、一緒に勉強しよう',
    options: [
      '一緒に勉強しない？',
      '一緒に遊びに行かない？',
      '一緒に映画見ない？',
      '一緒に買い物しない？',
    ],
    correctIndex: 0,
    sceneId: 'library',
    scenePrompt:
      '図書館で女性が男性に対して「Should we study together?」と提案する。男性が「いいね、一緒に勉強しよう」と答える。',
    nuance: 'casual',
    genre: 'library',
    patternGroup: 'activity_proposal',
    wordCount: 4,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 19. 依頼系 - ガーデン (medium)
  {
    type: 'medium' as const,
    english: 'Can you water the plants?',
    japaneseReply: 'もちろん、水やりするね',
    options: [
      '植物に水やりしてくれる？',
      '植物を植えてくれる？',
      '草を刈ってくれる？',
      '花を摘んでくれる？',
    ],
    correctIndex: 0,
    sceneId: 'garden',
    scenePrompt:
      'ガーデンで女性が男性に対して「Can you water the plants?」と依頼する。男性が「もちろん、水やりするね」と答える。',
    nuance: 'polite',
    genre: 'garden',
    patternGroup: 'help_request',
    wordCount: 5,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 20. 質問系 - 駅 (medium)
  {
    type: 'medium' as const,
    english: 'Which train should we take?',
    japaneseReply: 'あの青い電車だよ',
    options: ['どの電車に乗る？', 'どのバスに乗る？', 'どの道を行く？', 'どの店に入る？'],
    correctIndex: 0,
    sceneId: 'station',
    scenePrompt:
      '駅で女性が男性に対して「Which train should we take?」と質問する。男性が「あの青い電車だよ」と答える。',
    nuance: 'casual',
    genre: 'station',
    patternGroup: 'choice_question',
    wordCount: 5,
    interactionIntent: 'question' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 21. 情報共有系 - 病院 (medium)
  {
    type: 'medium' as const,
    english: 'The doctor will see you.',
    japaneseReply: 'ありがとう、行ってきます',
    options: ['先生が診てくれるよ', '先生はいないよ', '薬をもらえるよ', '検査があるよ'],
    correctIndex: 0,
    sceneId: 'hospital',
    scenePrompt:
      '病院の受付で女性が男性に対して「The doctor will see you.」と情報を伝える。男性が「ありがとう、行ってきます」と答える。',
    nuance: 'polite',
    genre: 'hospital',
    patternGroup: 'appointment_info',
    wordCount: 5,
    interactionIntent: 'info' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 22. 意見系 - 映画館 (medium)
  {
    type: 'medium' as const,
    english: 'This movie looks interesting.',
    japaneseReply: 'そうだね、面白そう',
    options: ['この映画面白そう', 'この映画つまらなそう', 'この映画怖そう', 'この映画長そう'],
    correctIndex: 0,
    sceneId: 'cinema',
    scenePrompt:
      '映画館で女性がポスターを見ながら男性に対して「This movie looks interesting.」と意見を述べる。男性が「そうだね、面白そう」と同意する。',
    nuance: 'casual',
    genre: 'cinema',
    patternGroup: 'evaluation_opinion',
    wordCount: 4,
    interactionIntent: 'opinion' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // === LONG問題追加（8問） ===

  // 23. 提案系 - ビーチ (long)
  {
    type: 'long' as const,
    english: 'How about we spend the whole weekend at the beach house?',
    japaneseReply: 'いいね、週末はビーチハウスで過ごそう',
    options: [
      '週末はビーチハウスで過ごさない？',
      '週末は山小屋で過ごさない？',
      '週末は家でゆっくりしない？',
      '週末は街に出かけない？',
    ],
    correctIndex: 0,
    sceneId: 'beach_house',
    scenePrompt:
      'リビングルームで女性が男性に対して「How about we spend the whole weekend at the beach house?」と提案する。男性が「いいね、週末はビーチハウスで過ごそう」と答える。',
    nuance: 'casual',
    genre: 'beach_house',
    patternGroup: 'weekend_proposal',
    wordCount: 10,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 24. 依頼系 - 会議室 (long)
  {
    type: 'long' as const,
    english: "Could you please prepare the presentation materials for tomorrow's meeting?",
    japaneseReply: 'はい、明日の会議の資料を準備します',
    options: [
      '明日の会議の資料を準備してもらえますか？',
      '明日の会議の部屋を予約してもらえますか？',
      '明日の会議の時間を変更してもらえますか？',
      '明日の会議の参加者に連絡してもらえますか？',
    ],
    correctIndex: 0,
    sceneId: 'meeting_room',
    scenePrompt:
      "会議室で女性が男性に対して「Could you please prepare the presentation materials for tomorrow's meeting?」と依頼する。男性が「はい、明日の会議の資料を準備します」と答える。",
    nuance: 'polite',
    genre: 'meeting_room',
    patternGroup: 'work_request',
    wordCount: 10,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 25. 質問系 - 旅行代理店 (long)
  {
    type: 'long' as const,
    english: 'Do you have any recommendations for a romantic getaway this summer?',
    japaneseReply: 'はい、この夏のロマンチックな旅行先をご提案します',
    options: [
      'この夏のロマンチックな旅行先のおすすめはありますか？',
      'この夏の家族旅行のおすすめはありますか？',
      'この夏の一人旅のおすすめはありますか？',
      'この夏の友達旅行のおすすめはありますか？',
    ],
    correctIndex: 0,
    sceneId: 'travel_agency',
    scenePrompt:
      '旅行代理店で女性が男性スタッフに対して「Do you have any recommendations for a romantic getaway this summer?」と質問する。男性が「はい、この夏のロマンチックな旅行先をご提案します」と答える。',
    nuance: 'polite',
    genre: 'travel_agency',
    patternGroup: 'recommendation_question',
    wordCount: 10,
    interactionIntent: 'question' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 26. 情報共有系 - 空港 (long)
  {
    type: 'long' as const,
    english: 'Your flight has been delayed by two hours due to bad weather.',
    japaneseReply: '悪天候で2時間遅れるんですね、了解しました',
    options: [
      '悪天候でフライトが2時間遅れています',
      '機械の故障でフライトが2時間遅れています',
      'パイロットの都合でフライトが2時間遅れています',
      '空港の混雑でフライトが2時間遅れています',
    ],
    correctIndex: 0,
    sceneId: 'airport',
    scenePrompt:
      '空港で女性スタッフが男性乗客に対して「Your flight has been delayed by two hours due to bad weather.」と情報を伝える。男性が「悪天候で2時間遅れるんですね、了解しました」と答える。',
    nuance: 'polite',
    genre: 'airport',
    patternGroup: 'delay_info',
    wordCount: 11,
    interactionIntent: 'info' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 27. 意見系 - アートギャラリー (long)
  {
    type: 'long' as const,
    english: 'I think this painting captures the essence of modern urban life perfectly.',
    japaneseReply: 'そうですね、現代都市生活の本質を完璧に表現していますね',
    options: [
      'この絵は現代都市生活の本質を完璧に表現していると思う',
      'この絵は古典的な田舎生活を美しく描いていると思う',
      'この絵は抽象的すぎて理解できないと思う',
      'この絵は色使いが素晴らしいと思う',
    ],
    correctIndex: 0,
    sceneId: 'art_gallery',
    scenePrompt:
      'アートギャラリーで女性が絵画を見ながら男性に対して「I think this painting captures the essence of modern urban life perfectly.」と意見を述べる。男性が「そうですね、現代都市生活の本質を完璧に表現していますね」と同意する。',
    nuance: 'sophisticated',
    genre: 'art_gallery',
    patternGroup: 'art_opinion',
    wordCount: 11,
    interactionIntent: 'opinion' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 28. 提案系 - レストラン予約 (long)
  {
    type: 'long' as const,
    english: "Why don't we make a reservation at that new Italian restaurant for our anniversary?",
    japaneseReply: '記念日にあの新しいイタリアンレストランを予約しましょう',
    options: [
      '記念日にあの新しいイタリアンレストランを予約しない？',
      '記念日にあの有名なフレンチレストランを予約しない？',
      '記念日にあの高級な和食レストランを予約しない？',
      '記念日に家で特別な料理を作らない？',
    ],
    correctIndex: 0,
    sceneId: 'home_dining',
    scenePrompt:
      "ダイニングルームで女性が男性に対して「Why don't we make a reservation at that new Italian restaurant for our anniversary?」と提案する。男性が「記念日にあの新しいイタリアンレストランを予約しましょう」と答える。",
    nuance: 'romantic',
    genre: 'home_dining',
    patternGroup: 'anniversary_proposal',
    wordCount: 13,
    interactionIntent: 'proposal' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 29. 依頼系 - 不動産オフィス (long)
  {
    type: 'long' as const,
    english: 'Could you show us some properties in a quiet neighborhood with good schools?',
    japaneseReply: '良い学校がある静かな住宅地の物件をご案内します',
    options: [
      '良い学校がある静かな住宅地の物件を見せてもらえますか？',
      '駅に近くて便利な場所の物件を見せてもらえますか？',
      'ショッピングモールに近い物件を見せてもらえますか？',
      '海が見える高層マンションを見せてもらえますか？',
    ],
    correctIndex: 0,
    sceneId: 'real_estate_office',
    scenePrompt:
      '不動産オフィスで女性が男性エージェントに対して「Could you show us some properties in a quiet neighborhood with good schools?」と依頼する。男性が「良い学校がある静かな住宅地の物件をご案内します」と答える。',
    nuance: 'polite',
    genre: 'real_estate_office',
    patternGroup: 'property_request',
    wordCount: 12,
    interactionIntent: 'request' as const,
    speakers: { sceneA: 'female' as const, sceneB: 'male' as const },
  },

  // 30. 質問系 - 医師の診察室 (long)
  {
    type: 'long' as const,
    english:
      "Doctor, what are the possible side effects of this new medication you're prescribing?",
    japaneseReply: 'この新しい薬の副作用について詳しく説明しますね',
    options: [
      '先生、処方される新しい薬の副作用は何ですか？',
      '先生、この薬はいつまで飲み続ければいいですか？',
      '先生、この薬は食前に飲むべきですか？',
      '先生、この薬は他の薬と一緒に飲んでも大丈夫ですか？',
    ],
    correctIndex: 0,
    sceneId: 'doctors_office',
    scenePrompt:
      "医師の診察室で女性患者が男性医師に対して「Doctor, what are the possible side effects of this new medication you're prescribing?」と質問する。男性医師が「この新しい薬の副作用について詳しく説明しますね」と答える。",
    nuance: 'formal',
    genre: 'doctors_office',
    patternGroup: 'medical_question',
    wordCount: 13,
    interactionIntent: 'question' as const,
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
