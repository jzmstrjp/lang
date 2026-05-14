import type { VoiceType } from '@prisma/client';

export type SceneFields = {
  how: string;
  senderWhen: string;
  place: string;
  senderRole: string;
  senderVoice: VoiceType;
  receiverPlace: string;
  receiverRole: string;
  receiverVoice: VoiceType;
  senderWhy: string;
  senderWant: string;
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
    `- ${p.senderRole}（${voiceGenderMap[p.senderVoice]}）が話しかけようと感じたきっかけ: ${p.senderWhy}`,
    `- ${p.senderRole}（${voiceGenderMap[p.senderVoice]}）が話しかけたタイミング: ${p.senderWhen}`,
    `- ${p.senderRole}（${voiceGenderMap[p.senderVoice]}）がいる場所: ${p.place}`,
    `- ${p.senderRole}（${voiceGenderMap[p.senderVoice]}）が相手に期待すること: ${p.senderWant}`,
    `- ${p.receiverRole}（${voiceGenderMap[p.receiverVoice]}）がいる場所: ${p.receiverPlace}`,
  ].join('\n');
}
