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
  - 例: "Are you hungry?" に対して "Yes, I'm hungry. I want some pizza."
  - 例: "It’s really cold today." に対して "Yeah, cold days like this are tough."
  - 「こう返答したってことは、きっとこう話しかけられたんだろうな」と推測できるような内容にすること。ただしenglishSentenceの内容をそのままオウム返ししたenglishReplyは禁止する。englishSentenceの主題となる単語を1つか2つだけenglishReplyにも含める程度が良い。
    - オウム返しで良くない例: "We will start using external vendors from now on."に対して"Oh, so that means you'll be using external vendors going forward?"と答えるのはオウム返しで良くない。
    - 自然に言及できている良い例: "We will start using external vendors from now on."に対して"I see. Which vendor will you be using?"と答えるのは自然に言及できていて良い。
  - englishSentenceの内容に具体的に言及しない当たり障りのないenglishReplyはNG。（NG例: "Ok, I'll do."）`;

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
- 英文に含まれている単語の意味は、日本語にも省略せず含めること。ただし省略しないと不自然な場合は省略してもいい。
- カタカナ英語は避け、ちゃんと日本語に翻訳すること。ただし、日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。（例: check-in は チェックイン でOK）`;

/**
 * 日本語翻訳の出力フォーマットルール。
 * japaneseSentence・japaneseReply の両方に適用する。
 */
export const TRANSLATION_FORMAT_RULES = `- 機械音声で読み上げるための日本語文なので、括弧書きは含めないこと。最後は「。」または「？」で終わること。`;

/**
 * TTS（機械音声）読み上げ向けの曖昧漢字ルール。
 * japaneseReply にのみ適用する（japaneseSentence は問題文として画面表示もされるため、漢字のままにしておきたい）。
 */
export const TTS_READING_RULES = `- TTSに読み上げさせるため、読み方が曖昧な漢字（例: 「辛く」は「からく」とも「つらく」とも読める）だけは、半角スペースで挟んだ" からく "の形式で書くこと。TTSにとってかなり読みにくい漢字（例: 「今朝」→「けさ」、「絆創膏」→「ばんそうこう」）も半角スペースで挟んだ" ひらがな "の形式で書くこと。そのまま読めそうな漢字は漢字のままでいい。`;

// 連続正解のシェア対象となるcount値
export const ALLOWED_SHARE_COUNTS = [
  5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 150, 200, 300, 400, 500,
] as const;
