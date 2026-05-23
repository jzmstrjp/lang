import type { VoiceType } from '@prisma/client';

export type SceneFields = {
  how: string;
  senderWhen: string;
  place: string;
  senderRole: string;
  senderName: string;
  senderVoice: VoiceType;
  receiverPlace: string;
  receiverRole: string;
  receiverName: string;
  receiverVoice: VoiceType;
  senderWhy: string;
  senderWant: string;
  senderDoing: string | null;
  receiverDoing: string | null;
};

const voiceGenderMap: Record<VoiceType, string> = {
  male: '男性',
  female: '女性',
};

/**
 * セリフ以外
 */
export function buildSceneText(p: SceneFields): string {
  return [
    `${p.how}での会話。`,
    `- ${p.senderName}（${p.senderRole}・${voiceGenderMap[p.senderVoice]}）`,
    `  - 話しかけようと感じたきっかけ: ${p.senderWhy}（${p.receiverName}は知らないかもしれない情報です）`,
    `  - 話しかけたタイミング: ${p.senderWhen}`,
    `  - いる場所: ${p.place}`,
    p.senderDoing ? `  - セリフを言っている最中の動作・状態: ${p.senderDoing}` : null,
    `  - ${p.receiverName}（${p.receiverRole}・${voiceGenderMap[p.receiverVoice]}）に期待すること: ${p.senderWant}（${p.receiverName}は知らないかもしれない情報です）`,
    `- ${p.receiverName}（${p.receiverRole}・${voiceGenderMap[p.receiverVoice]}）`,
    `  - いる場所: ${p.receiverPlace}`,
    p.receiverDoing ? `  - 返答のセリフを言っている最中の動作・状態: ${p.receiverDoing}` : null,
  ]
    .filter((line): line is string => line !== null)
    .join('\n');
}
