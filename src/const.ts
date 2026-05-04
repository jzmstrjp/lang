import type { ImageGenerateParams } from 'openai/resources/images';
import type { ChatModel } from 'openai/resources/shared';

export const TEXT_MODEL: ChatModel = 'gpt-4.1';

export const IMAGE_MODEL_SETTING = {
  model: 'gpt-image-2',
  size: '1024x1536',
  quality: 'low',
} as const satisfies Omit<ImageGenerateParams, 'prompt'>;

// 1回で取得する問題数
export const PROBLEM_FETCH_LIMIT = 10;

const HOST_NAME = 'xn--w8jtfrbw831dz9h.xn--sssu80k.dev';

export const SITE_ORIGIN = `https://${HOST_NAME}`;
export const CDN_ORIGIN = `https://cdn.${HOST_NAME}`;

/** DB に入っているパス（先頭 / あってもよい）を CDN の URL にする */
export function cdnUrl(path: string): string {
  const p = path.replace(/^\/+/, '');
  return `${CDN_ORIGIN}/${p}`;
}

export const ENGLISH_REPLY_PROMPT_RULES = `受信者の返答。englishSentenceに対する、要点を押さえつつできるだけ短い回答であること。目安は10単語以内。englishReplyを読めばenglishSentenceの内容が想像できるように具体的に言及すること。できれば最初に感動詞や相槌が欲しい。
  - 例: "Can you play the guitar?" に対して "Yeah, but I can only play a few songs."
  - 例: "Are you hungry?" に対して "Yes, I want some pizza."
  - 「こう返答したってことは、きっとこう話しかけられたんだろうな」と推測できるような内容にすること。ただしenglishSentenceの内容をそのままオウム返ししたenglishReplyは禁止する。
    - オウム返しで良くない例: "We will start using external vendors from now on."に対して"Oh, so that means you'll be using external vendors going forward?"と答えるのはオウム返しで良くない。
    - 自然に言及できている良い例: "We will start using external vendors from now on."に対して"I see. Which vendor will you be using?"と答えるのは自然に言及できていて良い。
  - englishSentenceの内容に具体的に言及しないenglishReplyはNG。（NG例: "Ok, I'll do."）
  - englishSentenceの主題となる単語をenglishReplyにも含めると良い。`;

// 連続正解のシェア対象となるcount値
export const ALLOWED_SHARE_COUNTS = [
  5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500,
] as const;
