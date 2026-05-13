import type { ImageGenerateParams } from 'openai/resources/images';
import type { ChatModel } from 'openai/resources/shared';

export const TEXT_MODEL: ChatModel = 'gpt-4.1';

export const IMAGE_MODEL_SETTING = {
  model: 'gpt-image-2',
  size: '1024x1536',
  quality: 'low',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;

// 1回で取得する問題数（5フレーズ × 2問）
export const PROBLEM_FETCH_LIMIT = 10;
// expression グルーピング取得時の設定
export const EXPRESSION_FETCH_PHRASES = 5;
export const EXPRESSION_FETCH_PER_PHRASE = 2;

const HOST_NAME = 'xn--w8jtfrbw831dz9h.xn--sssu80k.dev';

export const SITE_ORIGIN = `https://${HOST_NAME}`;
export const CDN_ORIGIN = `https://cdn.${HOST_NAME}`;

/** DB に入っているパス（先頭 / あってもよい）を CDN の URL にする */
export function cdnUrl(path: string): string {
  const p = path.replace(/^\/+/, '');
  return `${CDN_ORIGIN}/${p}`;
}

/**
 * 日本語翻訳の共通ルール。
 * 以下の3箇所のプロンプトで共有する。プロンプト調整は必ずここを編集すること。
 *   - scripts/create-problems.ts createJapaneseConversation (japaneseSentence + japaneseReply)
 *   - src/app/api/admin/problems/regenerate-reply/route.ts (japaneseReply のみ)
 *   - src/app/api/admin/problems/improve-translation/route.ts (japaneseSentence のみ)
 *
 * 出力フォーマットは TRANSLATION_FORMAT_RULES、japaneseReply 限定の TTS 用ルールは TTS_READING_RULES を併用する。
 */
export const JAPANESE_TRANSLATION_RULES = `- シーンや役割に合った適切な日本語表現にすること
- 口語的で自然な会話になるようにすること
  - 自然な翻訳の例: "Early check-in is subject to room availability."という英文ならば"早めのご入室は、お部屋の空き状況によります。"よりも"空室状況によっては、早めにチェックインいただけます。"の方が自然な日本語翻訳です。
- 英文に含まれていない情報は日本語訳に含めないこと。動機や文脈・シーン情報からの推測内容を翻訳に勝手に足さないこと。
- 英文に含まれている単語の意味は、できるだけ省略せずに日本語にも含めること。ただし省略しないと日本語として不自然すぎる場合のみ省略してもいい。
- カタカナ英語は避け、ちゃんと日本語に翻訳すること。ただし、日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。（例: check-in は チェックイン でOK）
- 機械音声で読み上げるための日本語文なので、括弧書きは含めないこと。最後は「。」または「？」で終わること。`;

// 連続正解のシェア対象となるcount値
export const ALLOWED_SHARE_COUNTS = [
  5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500,
] as const;
