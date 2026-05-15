import { OpenAI } from 'openai';
import { TEXT_MODEL } from '@/const';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function suggestWordsForCategory(
  isKids: boolean,
  existingExpressions: string[],
  existingWords: { expression: string; expressionJa: string; isKids: boolean }[],
  sampleSentences: string[],
): Promise<{ expression: string; expressionJa: string }[]> {
  const categoryLabel = isKids ? 'kids（子ども向け）' : 'non-kids（大人向け）';

  const usedInCategory = new Set([
    ...existingExpressions,
    ...existingWords
      .filter((w) => w.isKids === isKids)
      .map((w) => `${w.expression}（${w.expressionJa}）`),
  ]);

  const prompt = `あなたは英語学習アプリの語彙設計者です。
対象カテゴリ: **${categoryLabel}**

以下の情報をもとに、このカテゴリに追加すべき expression 候補を提案してください。

## すでに使用済みの expression（重複不可）
${[...usedInCategory].join(', ')}

## 既存問題の英文サンプル（語彙レベル・傾向の参考）
${sampleSentences.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## 提案ルール
- 使用済み expression と重複しないこと
  - ただし同じ単語でも意味（expressionJa）が異なれば別の expression として提案してよい（例: "play（遊ぶ）" と "play（からかう）" は別物）
- 単語・イディオム単体で会話の軸になれるもの（例: "apologize", "give it a shot"）
- イディオムは5語以内に収めること
${
  isKids
    ? `- 小中学生レベルの平易な語彙（例: "share", "help out", "excited"）
- 子どもの日常生活・学校・家族に関連するものが望ましい`
    : `- TOEIC や社会人の日常英会話で頻出の語彙・表現を優先
- ビジネス・旅行・日常生活など幅広いシーンに対応`
}
- 全体の約1/3は「comfort word」にすること。comfort word とは、"cozy", "hug", "comfort food", "snuggle", "warmth", "heartfelt", "grateful", "cherish", "soothe", "gentle" のような、温かみ・安心感・やさしさを連想させる語彙・表現。
- 目標数: 名詞 20個・動詞 20個・形容詞 20個・副詞 20個・イディオム 10個（合計 90個程度）

## 出力形式（JSON）
"words" キーに { "expression": string, "expressionJa": string } のオブジェクト配列を返してください（説明などは不要）。
- expression: 英語の単語・表現
- expressionJa: 日本語の意味（1つだけ。「献身的な、専念した」のように複数書かない）

例:
{
  "words": [
    { "expression": "apologize", "expressionJa": "謝罪する" },
    { "expression": "give it a shot", "expressionJa": "試してみる" },
    { "expression": "deadline", "expressionJa": "締め切り" },
    { "expression": "come up with", "expressionJa": "思いつく" },
    { "expression": "Rarely + auxiliary + S + V ~", "expressionJa": "めったに〜しない" },
    { "expression": "Not only A but also B", "expressionJa": "AだけでなくBも" },
    { "expression": "no sooner ~ than ...", "expressionJa": "〜するやいなや" }
  ]
}`;

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message.content ?? '{"words":[]}';
  const parsed = JSON.parse(content) as { words?: { expression: string; expressionJa: string }[] };
  return (parsed.words ?? []).filter((w) => w.expression && w.expressionJa);
}
