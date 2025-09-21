import { PrismaClient } from '@prisma/client';
import { generateSpeech } from '../src/lib/audio-utils';

const prisma = new PrismaClient();

const seedProblems = [
  // === SHORT問題（2-5語）===

  // 1. 依頼系 - 家庭 (short)
  {
    type: 'short' as const,
    english: 'Pass the salt.',
    japaneseReply: 'はい、どうぞ',
    options: ['塩取って', '塩はいらない', 'コショウ取って', '醤油取って'],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】キッチンのダイニングテーブルで夕食中の女性が、向かいに座る男性に対して「Pass the salt.」と依頼する。女性は料理に手を伸ばしながら塩を指差している。【2コマ目】男性が「はい、どうぞ」と答えながら笑顔で塩入れを女性に手渡している。',
    nuance: 'casual',
    genre: '依頼',
    patternGroup: 'basic_request',
    wordCount: 3,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 2. 質問系 - 家庭 (short)
  {
    type: 'short' as const,
    english: 'What time?',
    japaneseReply: '3時だよ',
    options: ['何時？', '何日？', 'どこ？', '誰？'],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】リビングルームでソファに座っている女性が、テレビを見ている男性に対して「What time?」と質問する。女性は時計を見ようとしている。【2コマ目】男性が壁の時計を見上げて「3時だよ」と答えている。',
    nuance: 'casual',
    genre: '質問',
    patternGroup: 'basic_question',
    wordCount: 2,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 3. 提案系 - 家庭 (short)
  {
    type: 'short' as const,
    english: "Let's go out.",
    japaneseReply: 'うん、出かけよう',
    options: ['出かけよう', '家にいよう', '寝よう', '食べよう'],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      "【1コマ目】リビングルームで女性が男性に対して「Let's go out.」と提案する。女性は外を指差しながら明るい表情をしている。【2コマ目】男性が「うん、出かけよう」と答えて立ち上がり、上着を取りに行く様子。",
    nuance: 'casual',
    genre: '提案',
    patternGroup: 'activity_proposal',
    wordCount: 3,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 4. 意見系 - ショッピングモール (short)
  {
    type: 'short' as const,
    english: 'This looks nice.',
    japaneseReply: 'そうだね、素敵だね',
    options: ['これ素敵だね', 'これ高すぎる', 'これ安いね', 'これ変だね'],
    correctIndex: 0,
    sceneId: 'ショッピングモール',
    scenePrompt:
      '【1コマ目】ショップで女性が洋服を手に取りながら男性に対して「This looks nice.」と意見を述べる。女性は商品を自分に当てて鏡を見ている。【2コマ目】男性が「そうだね、素敵だね」と同意しながら親指を立てている。',
    nuance: 'casual',
    genre: '意見',
    patternGroup: 'evaluation_opinion',
    wordCount: 3,
    interactionIntent: 'opinion' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 5. 情報共有系 - 家庭 (short)
  {
    type: 'short' as const,
    english: "It's raining.",
    japaneseReply: 'そうだね、雨だね',
    options: ['雨降ってる', '晴れてる', '雪降ってる', '風が強い'],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      "【1コマ目】リビングルームで女性が窓の外を見ながら男性に対して「It's raining.」と情報を伝える。窓には雨粒が見える。【2コマ目】男性も窓の方を見て「そうだね、雨だね」と答えている。",
    nuance: 'casual',
    genre: '情報共有',
    patternGroup: 'weather_info',
    wordCount: 2,
    interactionIntent: 'info' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 6. 依頼系 - オフィス (short)
  {
    type: 'short' as const,
    english: 'Open the door.',
    japaneseReply: 'はい、開けますね',
    options: ['ドア開けて', 'ドア閉めて', '窓開けて', '電気つけて'],
    correctIndex: 0,
    sceneId: 'オフィス',
    scenePrompt:
      '【1コマ目】オフィスで両手に荷物を持った女性が、近くにいる男性に対して「Open the door.」と依頼する。女性は困った表情でドアを見ている。【2コマ目】男性が「はい、開けますね」と答えながらドアノブに手を伸ばしている。',
    nuance: 'casual',
    genre: '依頼',
    patternGroup: 'simple_request',
    wordCount: 3,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 7. 質問系 - 家庭 (short)
  {
    type: 'short' as const,
    english: 'Where are my keys?',
    japaneseReply: 'テーブルの上だよ',
    options: ['鍵どこ？', '財布どこ？', '携帯どこ？', '眼鏡どこ？'],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】リビングルームで女性が男性に対して「Where are my keys?」と質問する。女性はバッグの中を探しながら困った表情をしている。【2コマ目】男性がテーブルを指差して「テーブルの上だよ」と答えている。',
    nuance: 'casual',
    genre: '質問',
    patternGroup: 'location_question',
    wordCount: 4,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 8. 提案系 - 飲食店 (short)
  {
    type: 'short' as const,
    english: "Let's sit here.",
    japaneseReply: 'いいね、ここにしよう',
    options: ['ここに座ろう', 'あそこがいい', '立っていよう', '外に出よう'],
    correctIndex: 0,
    sceneId: '飲食店',
    scenePrompt:
      "【1コマ目】レストランで女性が空いている席を指差しながら男性に対して「Let's sit here.」と提案する。女性は笑顔で席を示している。【2コマ目】男性が「いいね、ここにしよう」と答えながら椅子を引いている。",
    nuance: 'casual',
    genre: '提案',
    patternGroup: 'location_proposal',
    wordCount: 3,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 9. 依頼系 - 家庭 (short)
  {
    type: 'short' as const,
    english: 'Turn on the light.',
    japaneseReply: 'はい、つけるね',
    options: ['電気つけて', '電気消して', '水出して', 'ドア開けて'],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】薄暗いリビングルームで女性が男性に対して「Turn on the light.」と依頼する。女性は本を読もうとして困っている。【2コマ目】男性が「はい、つけるね」と答えながら電気のスイッチに手を伸ばしている。',
    nuance: 'casual',
    genre: '依頼',
    patternGroup: 'simple_request',
    wordCount: 4,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 10. 質問系 - 飲食店 (short)
  {
    type: 'short' as const,
    english: 'Are you ready?',
    japaneseReply: 'うん、準備できた',
    options: ['準備できた？', '疲れた？', 'お腹空いた？', '眠くない？'],
    correctIndex: 0,
    sceneId: '飲食店',
    scenePrompt:
      '【1コマ目】レストランで女性がメニューを閉じながら男性に対して「Are you ready?」と質問する。女性は注文の準備ができた様子。【2コマ目】男性もメニューを閉じて「うん、準備できた」と答えながら微笑んでいる。',
    nuance: 'casual',
    genre: '質問',
    patternGroup: 'status_question',
    wordCount: 3,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // === MEDIUM問題（6-10語）===

  // 11. 依頼系 - 家庭 (medium)
  {
    type: 'medium' as const,
    english: 'Can you help me clean up?',
    japaneseReply: 'うん、一緒に片付けよう',
    options: [
      '掃除手伝ってくれる？',
      '掃除はもう終わった',
      '料理手伝ってくれる？',
      '洗濯手伝ってくれる？',
    ],
    correctIndex: 0,
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】リビングルームでおもちゃが散らかった状況で、女性が男性に対して「Can you help me clean up?」と依頼する。女性は困った表情で散らかった部屋を見回している。【2コマ目】男性が「うん、一緒に片付けよう」と答えながら袖をまくり上げている。',
    nuance: 'polite',
    genre: '依頼',
    patternGroup: 'help_request',
    wordCount: 6,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 12. 提案系 - 公園 (medium)
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
    sceneId: '家庭',
    scenePrompt:
      "【1コマ目】リビングルームで女性が窓の外の晴れた空を見ながら男性に対して「Let's go to the park today!」と提案する。女性は明るい表情で外を指差している。【2コマ目】男性が「いいね、公園行こう！」と答えて立ち上がり、運動靴を履く準備をしている。",
    nuance: 'casual',
    genre: '提案',
    patternGroup: 'activity_proposal',
    wordCount: 6,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 13. 質問系 - ショッピングモール (medium)
  {
    type: 'medium' as const,
    english: 'Do we need more milk?',
    japaneseReply: 'うん、牛乳買おう',
    options: ['牛乳もっと必要？', 'パンもっと必要？', '卵もっと必要？', 'お米もっと必要？'],
    correctIndex: 0,
    sceneId: 'ショッピングモール',
    scenePrompt:
      '【1コマ目】スーパーマーケットの冷蔵コーナーで女性が買い物リストを見ながら男性に対して「Do we need more milk?」と質問する。女性は牛乳パックを手に取っている。【2コマ目】男性が冷蔵庫の中身を思い出すように考えて「うん、牛乳買おう」と答えている。',
    nuance: 'casual',
    genre: '質問',
    patternGroup: 'shopping_question',
    wordCount: 5,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 14. 意見系 - オフィス (medium)
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
    sceneId: 'オフィス',
    scenePrompt:
      '【1コマ目】オフィスで女性がパソコンの画面上の2つのデザインを比較しながら男性に対して「I think this looks better.」と意見を述べる。女性は一方のデザインを指差している。【2コマ目】男性が画面を見て「そうだね、こっちの方がいい」と同意しながら頷いている。',
    nuance: 'casual',
    genre: '意見',
    patternGroup: 'opinion_sharing',
    wordCount: 5,
    interactionIntent: 'opinion' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 15. 情報共有系 - 家庭 (medium)
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
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】洗濯室で洗濯機の様子を確認している女性が、リビングにいる男性に対して「The laundry is almost done.」と情報を伝える。洗濯機の表示が残り時間を示している。【2コマ目】男性が「ありがとう、確認するね」と答えながら洗濯物を干す準備をしている。',
    nuance: 'casual',
    genre: '情報共有',
    patternGroup: 'status_update',
    wordCount: 5,
    interactionIntent: 'info' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 16. 提案系 - 学校 (medium)
  {
    type: 'medium' as const,
    english: 'Should we study together tonight?',
    japaneseReply: 'いいね、一緒に勉強しよう',
    options: [
      '今夜一緒に勉強しない？',
      '今夜一緒に遊ばない？',
      '今夜一緒に映画見ない？',
      '今夜一緒に買い物しない？',
    ],
    correctIndex: 0,
    sceneId: '学校',
    scenePrompt:
      '【1コマ目】図書館で女性が教科書を閉じながら男性に対して「Should we study together tonight?」と提案する。女性は明日のテストを心配している表情。【2コマ目】男性が「いいね、一緒に勉強しよう」と答えながら自分の教科書も準備している。',
    nuance: 'casual',
    genre: '提案',
    patternGroup: 'activity_proposal',
    wordCount: 5,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 17. 依頼系 - 家庭 (medium)
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
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】ガーデンで女性が枯れかけた植物を心配そうに見ながら男性に対して「Can you water the plants?」と依頼する。女性はじょうろを指差している。【2コマ目】男性が「もちろん、水やりするね」と答えながらじょうろを手に取っている。',
    nuance: 'polite',
    genre: '依頼',
    patternGroup: 'help_request',
    wordCount: 5,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 18. 質問系 - 駅 (medium)
  {
    type: 'medium' as const,
    english: 'Which train should we take?',
    japaneseReply: 'あの青い電車だよ',
    options: ['どの電車に乗る？', 'どのバスに乗る？', 'どの道を行く？', 'どの店に入る？'],
    correctIndex: 0,
    sceneId: '駅',
    scenePrompt:
      '【1コマ目】駅のホームで女性が複数の電車を見ながら男性に対して「Which train should we take?」と質問する。女性は時刻表を見て困っている。【2コマ目】男性が青い電車を指差して「あの青い電車だよ」と答えている。',
    nuance: 'casual',
    genre: '質問',
    patternGroup: 'choice_question',
    wordCount: 5,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 19. 情報共有系 - 病院 (medium)
  {
    type: 'medium' as const,
    english: 'The doctor will see you now.',
    japaneseReply: 'ありがとう、行ってきます',
    options: ['先生が今診てくれるよ', '先生はまだいないよ', '薬をもらえるよ', '検査があるよ'],
    correctIndex: 0,
    sceneId: '病院',
    scenePrompt:
      '【1コマ目】病院の受付で女性看護師が待合室にいる男性患者に対して「The doctor will see you now.」と情報を伝える。女性は診察室のドアを指差している。【2コマ目】男性が「ありがとう、行ってきます」と答えながら立ち上がって診察室に向かっている。',
    nuance: 'polite',
    genre: '情報共有',
    patternGroup: 'appointment_info',
    wordCount: 6,
    interactionIntent: 'info' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 20. 意見系 - 飲食店 (medium)
  {
    type: 'medium' as const,
    english: 'This movie looks really interesting.',
    japaneseReply: 'そうだね、面白そう',
    options: ['この映画すごく面白そう', 'この映画つまらなそう', 'この映画怖そう', 'この映画長そう'],
    correctIndex: 0,
    sceneId: '飲食店',
    scenePrompt:
      '【1コマ目】映画館のロビーで女性がポスターを見ながら男性に対して「This movie looks really interesting.」と意見を述べる。女性は興奮した表情でポスターを指差している。【2コマ目】男性もポスターを見て「そうだね、面白そう」と同意しながら微笑んでいる。',
    nuance: 'casual',
    genre: '意見',
    patternGroup: 'evaluation_opinion',
    wordCount: 5,
    interactionIntent: 'opinion' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // === LONG問題（11-20語）===

  // 21. 提案系 - 家庭 (long)
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
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】ダイニングルームで夕食を終えた女性が、男性に対して「How about we take a walk around the neighborhood after dinner?」と提案する。女性は窓の外の夕暮れを見ながら散歩を提案している。【2コマ目】男性が「いいね、夕食後に散歩しよう」と答えながら立ち上がり、ジャケットを取りに行く様子。',
    nuance: 'polite',
    genre: '提案',
    patternGroup: 'evening_activity',
    wordCount: 11,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 22. 提案系 - 家庭 (long)
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
    sceneId: '家庭',
    scenePrompt:
      "【1コマ目】キッチンでコーヒーを準備している女性が、男性に対して「Why don't we have our coffee out on the balcony this morning?」と提案する。女性は美しい朝日が差し込むバルコニーを指差している。【2コマ目】男性が「いいね、バルコニーでコーヒー飲もう」と答えながらコーヒーカップを2つ持ってバルコニーに向かっている。",
    nuance: 'polite',
    genre: '提案',
    patternGroup: 'morning_activity',
    wordCount: 12,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 23. 提案系 - 家庭 (long)
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
    sceneId: '家庭',
    scenePrompt:
      '【1コマ目】リビングルームで女性が旅行パンフレットを見ながら男性に対して「How about we spend the whole weekend at the beach house?」と提案する。女性は興奮した表情でビーチハウスの写真を指差している。【2コマ目】男性が「いいね、週末はビーチハウスで過ごそう」と答えながら荷造りの準備を始めている。',
    nuance: 'casual',
    genre: '提案',
    patternGroup: 'weekend_proposal',
    wordCount: 10,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 24. 依頼系 - オフィス (long)
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
    sceneId: 'オフィス',
    scenePrompt:
      "【1コマ目】会議室で女性上司が男性部下に対して「Could you please prepare the presentation materials for tomorrow's meeting?」と依頼する。女性は手帳を見ながら明日のスケジュールを確認している。【2コマ目】男性が「はい、明日の会議の資料を準備します」と答えながらメモを取っている。",
    nuance: 'polite',
    genre: '依頼',
    patternGroup: 'work_request',
    wordCount: 10,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 25. 質問系 - 旅行先 (long)
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
    sceneId: '旅行先',
    scenePrompt:
      '【1コマ目】旅行代理店で女性客が男性スタッフに対して「Do you have any recommendations for a romantic getaway this summer?」と質問する。女性は恋人との旅行を計画している様子でパンフレットを見ている。【2コマ目】男性スタッフが「はい、この夏のロマンチックな旅行先をご提案します」と答えながら複数のパンフレットを取り出している。',
    nuance: 'polite',
    genre: '質問',
    patternGroup: 'recommendation_question',
    wordCount: 10,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 26. 情報共有系 - 駅 (long)
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
    sceneId: '駅',
    scenePrompt:
      '【1コマ目】空港のカウンターで女性スタッフが男性乗客に対して「Your flight has been delayed by two hours due to bad weather.」と情報を伝える。女性は申し訳なさそうな表情で遅延の案内をしている。【2コマ目】男性が「悪天候で2時間遅れるんですね、了解しました」と答えながら待合席に向かっている。',
    nuance: 'polite',
    genre: '情報共有',
    patternGroup: 'delay_info',
    wordCount: 11,
    interactionIntent: 'info' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 27. 意見系 - スポーツ施設 (long)
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
    sceneId: 'スポーツ施設',
    scenePrompt:
      '【1コマ目】アートギャラリーで女性が現代的な都市風景を描いた絵画を見ながら男性に対して「I think this painting captures the essence of modern urban life perfectly.」と意見を述べる。女性は感動した表情で絵を見つめている。【2コマ目】男性も絵を見て「そうですね、現代都市生活の本質を完璧に表現していますね」と同意しながら深く頷いている。',
    nuance: 'sophisticated',
    genre: '意見',
    patternGroup: 'art_opinion',
    wordCount: 11,
    interactionIntent: 'opinion' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 28. 提案系 - 飲食店 (long)
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
    sceneId: '飲食店',
    scenePrompt:
      "【1コマ目】ダイニングルームで女性が男性に対して「Why don't we make a reservation at that new Italian restaurant for our anniversary?」と提案する。女性は雑誌のレストラン紹介ページを見せながら記念日の計画を話している。【2コマ目】男性が「記念日にあの新しいイタリアンレストランを予約しましょう」と答えながら携帯電話を取り出して予約の準備をしている。",
    nuance: 'romantic',
    genre: '提案',
    patternGroup: 'anniversary_proposal',
    wordCount: 13,
    interactionIntent: 'proposal' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 29. 依頼系 - オフィス (long)
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
    sceneId: 'オフィス',
    scenePrompt:
      '【1コマ目】不動産オフィスで女性客が男性エージェントに対して「Could you show us some properties in a quiet neighborhood with good schools?」と依頼する。女性は子供の教育を考えて真剣な表情で相談している。【2コマ目】男性エージェントが「良い学校がある静かな住宅地の物件をご案内します」と答えながら地図と物件資料を取り出している。',
    nuance: 'polite',
    genre: '依頼',
    patternGroup: 'property_request',
    wordCount: 12,
    interactionIntent: 'request' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },

  // 30. 質問系 - 病院 (long)
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
    sceneId: '病院',
    scenePrompt:
      "【1コマ目】医師の診察室で女性患者が男性医師に対して「Doctor, what are the possible side effects of this new medication you're prescribing?」と質問する。女性は心配そうな表情で処方箋を見ている。【2コマ目】男性医師が「この新しい薬の副作用について詳しく説明しますね」と答えながら薬の説明書を取り出している。",
    nuance: 'formal',
    genre: '質問',
    patternGroup: 'medical_question',
    wordCount: 13,
    interactionIntent: 'question' as const,
    speakers: { character1: 'female' as const, character2: 'male' as const },
  },
];

async function main() {
  console.log('問題と音声アセットを一括生成中...');

  for (const problemData of seedProblems) {
    try {
      console.log(`処理中: ${problemData.english}`);

      // 1. 音声生成
      const [englishAudio, japaneseAudio] = await Promise.all([
        generateSpeech(problemData.english, problemData.speakers.character1),
        generateSpeech(problemData.japaneseReply, problemData.speakers.character2),
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
          speakersSceneA: problemData.speakers.character1,
          speakersSceneB: problemData.speakers.character2,
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
