import { OpenAI } from 'openai';
import { TEXT_MODEL } from '@/const';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function suggestWordsForCategory(
  isKids: boolean,
  existingExpressions: string[],
  existingWords: { expression: string; isKids: boolean }[],
  sampleSentences: string[],
): Promise<string[]> {
  const categoryLabel = isKids ? 'kids（子ども向け）' : 'non-kids（大人向け）';

  const usedInCategory = new Set([
    ...existingExpressions,
    ...existingWords.filter((w) => w.isKids === isKids).map((w) => w.expression),
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
"words" キーに文字列の配列のみ返してください（説明などは不要）。

例:
{
  "words": [
    "apologize",
    "give it a shot",
    "deadline",
    "come up with",
    "Rarely + auxiliary + S + V ~",
    "Not only A but also B",
    "no sooner ~ than ..."
  ]
}`;

  const response = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message.content ?? '{"words":[]}';
  const parsed = JSON.parse(content) as { words?: string[] };
  return parsed.words ?? [];
}
