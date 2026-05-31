import {
  type Voice,
  type How,
  voiceMap,
  toggleVoice,
  howNoteMap,
  buildThirdPersonNote,
} from '@/lib/english-sentence-prompt';

export type SceneInfo = {
  englishSentence: string;
  how: How;
  senderName: string;
  senderRole: string;
  receiverName: string;
  receiverRole: string;
  when: string;
  why: string;
  want: string;
  where: string;
  receiverWhere: string;
  senderDoing: string;
  receiverDoing: string;
  englishReplyDraft: string;
};

const buildSceneInfoResultDefinition = (
  englishSentence: string,
  how: How,
  senderName: string,
  receiverName: string,
  senderRole: string,
  receiverRole: string,
): SceneInfo => ({
  englishSentence,
  how,
  senderName,
  senderRole,
  receiverName,
  receiverRole,
  when: `${senderName}が${receiverName}に上記のセリフを言ったタイミング。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大20文字程度で簡潔に。`,
  why: `${senderName}がそのセリフを言おうと感じたきっかけ。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大40文字程度で簡潔に。`,
  want: `${senderName}が${receiverName}に何を期待してそのセリフを言うのか。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大40文字程度で簡潔に。`,
  where: `${senderName}がいる場所（ここには個人名は書かないこと・最大10文字程度で簡潔に）`,
  receiverWhere: `${receiverName}がいる場所。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大10文字程度で簡潔に。`,
  senderDoing: `1コマ目で${senderName}が上記のセリフを言っている最中の動作・状態。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大30文字程度で簡潔に。`,
  receiverDoing: `2コマ目で${receiverName}が返答のセリフを言っている最中の動作・状態。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大30文字程度で簡潔に。`,
  englishReplyDraft: `2コマ目で${receiverName}が返答するセリフの簡単な概要。日本語。一言か二言で。（例: 感謝、共感、感心、指示、支持、質問への回答、同意、照れ、迷いつつ許可、了承、納得、喜び、驚き、依頼、承諾、拒否、快諾、など）`,
});

const samples: SceneInfo[] = [
  {
    englishSentence: 'Which floor was I supposed to go to again?',
    how: '対面',
    senderName: 'マイク',
    senderRole: '学生',
    receiverName: 'レイナ',
    receiverRole: 'マイクの友人',
    when: 'エスカレーターで移動中',
    where: 'ショッピングモールのエスカレーター',
    receiverWhere: 'マイクと同じエスカレーターの下段',
    why: 'レイナと一緒に行くはずの店が何階にあるのかを忘れてしまった',
    want: 'レイナが目的の店のフロアを教えてくれる',
    senderDoing: 'エスカレーターの下段にいるレイナの方を振り向いている',
    receiverDoing: 'エスカレーターの上段にいるマイクを見ながら',
    englishReplyDraft: '質問への回答',
  },
  {
    englishSentence: 'I heard Emma followed through on that difficult project.',
    how: '対面',
    senderName: 'タカシ',
    senderRole: 'IT企業の営業担当',
    receiverName: 'エマ',
    receiverRole: 'タカシの同僚',
    when: '仕事の休憩時間',
    where: 'オフィスの休憩スペース',
    receiverWhere: 'タカシの向かいの席',
    why: '友人（エマ）の活躍を知って感心し、誰かに共有したくなった',
    want: 'タカシがエマの実績に感心してくれる',
    senderDoing: 'マグカップを片手に持っている',
    receiverDoing: 'タカシの方を見て驚いた顔をしている',
    englishReplyDraft: '感心',
  },
];

const kidsSamples: SceneInfo[] = [
  {
    englishSentence: 'Do you like soccer?',
    how: '対面',
    senderName: 'ケンタ',
    senderRole: '中学生',
    receiverName: 'サクラ',
    receiverRole: 'ケンタのクラスメイト',
    when: '放課後に校庭で話していた時',
    where: '学校の校庭',
    receiverWhere: 'ケンタの隣',
    why: 'サクラがサッカーボールを持っているのを見て、好きなのかが気になったから',
    want: 'サクラがサッカー好きかを知れる',
    senderDoing: 'サッカーボールを足元で転がしながら',
    receiverDoing: 'ケンタがボールと戯れているのを見ている',
    englishReplyDraft: '肯定',
  },
  {
    englishSentence: 'Can you pass me the salt?',
    how: '対面',
    senderName: 'タケシ',
    senderRole: '父親',
    receiverName: 'サラ',
    receiverRole: 'タケシの娘',
    when: '家族で朝食を食べている最中',
    where: '自宅の食卓',
    receiverWhere: 'タケシの向かいの席',
    why: '塩を使いたいが、塩の容器がサラの近くにあって、タケシは手が届かない',
    want: 'サラが塩を渡してくれる',
    senderDoing: 'サラの方に手を伸ばしている',
    receiverDoing: '塩の瓶をタケシの方に向けて渡している',
    englishReplyDraft: '快諾して対応',
  },
];

function buildSamplesBlock(sampleList: SceneInfo[]): string {
  return sampleList
    .map((sample) => {
      const { englishSentence: _es, how: _how, ...scene } = sample;
      return `英文が「${_es}」の場合:\n\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\``;
    })
    .join('\n\n');
}

const SAMPLES_BLOCK: string = buildSamplesBlock(samples);
const KIDS_SAMPLES_BLOCK: string = buildSamplesBlock(kidsSamples);

const KIDS_RULES_BLOCK: string = `- できれば登場人物の片方は中学生か高校生であること。もう片方は親・先生・バイト先の人など大人も積極的に登場してよいし、同じく中学生か高校生でもよい。
- 学校・友人・恋愛・部活・放課後・家族・趣味・バイト・休日など幅広いシーンにすること
- ビジネスのシーンは避けること
- 込み入った事情のない、シンプルなシーンであること。englishReplyDraftもシンプルに。
`;

export type SceneInfoPromptMessages = {
  user: string;
};

export function buildSceneInfoPrompt({
  senderName,
  receiverName,
  englishSentence,
  voice,
  how,
  isKids = false,
  motivation,
  senderRole,
  receiverRole,
}: {
  senderName: string;
  receiverName: string;
  englishSentence: string;
  voice: Voice;
  how: How;
  isKids?: boolean;
  motivation: string;
  senderRole: string;
  receiverRole: string;
}): SceneInfoPromptMessages {
  const receiverGenderLabel = voiceMap[toggleVoice(voice)];
  const phoneNote = how === '電話' ? `\n${howNoteMap['電話']}` : '';

  const resultDefinition = buildSceneInfoResultDefinition(
    englishSentence,
    how,
    senderName,
    receiverName,
    senderRole,
    receiverRole,
  );

  const user = `
${senderName}という${voiceMap[voice]}（${senderRole}）が${receiverName}という${receiverGenderLabel}（${receiverRole}）に対して、${how}で「${englishSentence}」と話しかけました。
【発言の動機】${motivation}

この会話内容から必然的に連想されるシーン情報(動機や状況など)を作成してください。
会話内容と矛盾しないシーンにしてください。

- ${phoneNote}
-${buildThirdPersonNote(englishSentence, senderName, receiverName)}

## 出力ルール
- 現実世界で誰もが一度は見たことがあるようなシーンにすること
- 人物の個人名は全てカタカナで書くこと
- 2コマ漫画として描くため、2コマで描けるシーンにすること。
  - 1コマ目: ${senderName}（${voiceMap[voice]}・${senderRole}）が${receiverName}（${receiverGenderLabel}・${receiverRole}）に向かって「${englishSentence}」と話しかけている。
  - 2コマ目: ${receiverName}（${receiverGenderLabel}・${receiverRole}）が${senderName}（${voiceMap[voice]}・${senderRole}）に向かって返答している。
- ${isKids ? KIDS_RULES_BLOCK : ''}

【重要】以下のJSON形式で必ず回答してください。

\`\`\`json
${JSON.stringify(resultDefinition, null, 2)}
\`\`\`

## 出力例
以下の例を参考にしてください。

${isKids ? KIDS_SAMPLES_BLOCK : SAMPLES_BLOCK}
`;

  return { user };
}
