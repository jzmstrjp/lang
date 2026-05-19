import { OpenAI } from 'openai';
import { TEXT_MODEL_RICH_SCENE } from '@/const';
import { recordTokenUsage } from '@/lib/token-usage-tracker';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function suggestWordsForCategory(
  isKids: boolean,
  existingExpressions: string[],
  existingWords: { expression: string; expressionJa: string; isKids: boolean }[],
  sampleSentences: string[],
): Promise<{ expression: string; expressionJa: string }[]> {
  const categoryLabel = isKids ? 'kids（子ども向け）' : 'non-kids（大人向け）';

  const usedFromWords = existingWords
    .filter((w) => w.isKids === isKids)
    .map((w) => ({ expression: w.expression, expressionJa: w.expressionJa }));

  const usedFromProblemsOnly = existingExpressions.filter(
    (e) => !usedFromWords.some((w) => w.expression === e),
  );

  const usedListText = [
    ...usedFromProblemsOnly.map(
      (e) => `フレーズ（expression）: ${e}\n日本語の意味（expressionJa）: （不明）`,
    ),
    ...usedFromWords.map(
      (w) =>
        `フレーズ（expression）: ${w.expression}\n日本語の意味（expressionJa）: ${w.expressionJa}`,
    ),
  ].join('\n----------\n');

  const prompt = `あなたは英語学習アプリの語彙設計者です。
対象カテゴリ: **${categoryLabel}**

以下の情報をもとに、このカテゴリに追加すべき expression 候補を提案してください。

## すでに使用済みの expression（重複不可）
${usedListText}

## 既存問題の英文サンプル（語彙レベル・傾向の参考）
${sampleSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 提案ルール
- 使用済み expression と重複しないこと（今回の提案リスト内でも重複不可）
  - ただし同じ単語でも意味（expressionJa）が異なれば別の expression として提案してよい（例: "play（遊ぶ）" と "play（からかう）" は別物）
- 単語・イディオム単体で会話の軸になれるもの（例: "apologize", "give it a shot"）
- イディオムは5語以内に収めること
- **ネイティブが日常の口語会話で実際に使う表現に限定すること**
  - フォーマル語・書き言葉は避けること（例: accompany→come with, inquire→ask, consult→talk to, assist→help, commence→start）
${
  isKids
    ? `- **日本人なら誰でも知っているような、中学英語レベルの基本単語・表現に限定すること**
  - OK例: "play", "like", "eat", "sleep", "happy", "sad", "big", "fast", "friend", "school", "help", "run", "fun"
  - NG例: "giggle"（日本人には馴染みが薄い）, "belongings"（難しい）, "peek"（馴染みが薄い）, "softly"（副詞として馴染みが薄い）, "snuggle"（馴染みが薄い）, "cozy"（馴染みが薄い）
- 子どもが日常で頻繁に使う基本動詞・形容詞を積極的に含めること（例: play, like, love, want, need, know, think, try, make, go, come, get, give, take, put, eat, drink, sleep, help, watch, read, draw, sing, dance）
- 「好き・嫌い・欲しい・楽しい」など感情や好みを表す語も積極的に含めること（例: favorite, fun, happy, sad, scared, hungry, tired, cute, cool, great）
- 中高生の日常生活に関連するものが望ましい（友人・恋愛・部活・放課後・家族など）。幼稚園児や小学校低学年を想起させる話題（おもちゃ・砂遊びなど）は避けること
- 副詞は中学英語で習うような基本的なものに限定（例: really, fast, slowly, together, again, always, never, very, too）
- 感謝・気持ち系の形容詞はカジュアルで平易なものに限定（thankful は可。grateful / heartfelt などフォーマル・硬い語は避ける）
- 接続詞・接続副詞・群前置詞はカジュアルで平易なもの（例: because, but, so, when, if, after, before）`
    : `- TOEIC や社会人の日常英会話で頻出の語彙・表現を優先
- ビジネス・旅行・日常生活など幅広いシーンに対応
- 接続詞・接続副詞・群前置詞も含む（例: otherwise, therefore, due to, in spite of, as long as, provided that）`
}
- 全体の約1/3は「comfort word」にすること。comfort word とは、温かみ・安心感・やさしさを連想させる語彙・表現。
${
  isKids
    ? `  - kids向け comfort word の例: "hug", "kind", "warm", "smile", "together", "happy", "friend", "love", "safe", "nice"`
    : `  - non-kids向け comfort word の例: "cozy", "warmth", "heartfelt", "grateful", "cherish", "soothe", "serene", "comfort", "healing", "empathy"`
}
- 目標数: 名詞 20個・動詞 20個・形容詞 20個・副詞 20個・イディオム 10個・接続詞/接続副詞/群前置詞 10個（合計 100個程度）

## 出力形式（JSON）
"words" キーに { "expression": string, "expressionJa": string } のオブジェクト配列を返してください（説明などは不要）。
- expression: 英語の単語・表現
- expressionJa: 日本語の意味（1つだけ。「献身的な、専念した」のように複数書かない）

例:
${
  isKids
    ? `{
  "words": [
    { "expression": "play", "expressionJa": "遊ぶ" },
    { "expression": "favorite", "expressionJa": "お気に入りの" },
    { "expression": "like", "expressionJa": "好き" },
    { "expression": "help out", "expressionJa": "手伝う" },
    { "expression": "excited", "expressionJa": "ワクワクしている" },
    { "expression": "snuggle", "expressionJa": "くっつく" },
    { "expression": "because of", "expressionJa": "〜のせいで" }
  ]
}`
    : `{
  "words": [
    { "expression": "apologize", "expressionJa": "謝罪する" },
    { "expression": "give it a shot", "expressionJa": "試してみる" },
    { "expression": "deadline", "expressionJa": "締め切り" },
    { "expression": "come up with", "expressionJa": "思いつく" },
    { "expression": "no wonder", "expressionJa": "〜なのは当然だ" },
    { "expression": "count on", "expressionJa": "頼りにする" },
    { "expression": "run into", "expressionJa": "偶然会う" }
  ]
}`
}`;

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL_RICH_SCENE,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });
  recordTokenUsage('ワード補充(AI提案)', {
    input_tokens: response.usage?.prompt_tokens,
    output_tokens: response.usage?.completion_tokens,
    input_tokens_details: { cached_tokens: response.usage?.prompt_tokens_details?.cached_tokens },
  });

  const content = response.choices[0]?.message.content ?? '{"words":[]}';
  const parsed = JSON.parse(content) as { words?: { expression: string; expressionJa: string }[] };
  return (parsed.words ?? []).filter((w) => w.expression && w.expressionJa);
}
