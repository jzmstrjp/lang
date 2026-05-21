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
};

const buildSceneInfoResultDefinition = (
  englishSentence: string,
  how: How,
  senderName: string,
  receiverName: string,
): SceneInfo => ({
  englishSentence,
  how,
  senderName,
  senderRole: `${senderName}の立場・職業・役割（最大10文字程度で簡潔に。性別は記載しないこと。）`,
  receiverName,
  receiverRole: `${senderName}は${receiverName}にとってどんな相手か（${senderName}の〇〇、という形式で書くこと・最大10文字程度で簡潔に。性別は記載しないこと。）`,
  when: `${senderName}が${receiverName}に上記のセリフを言ったタイミング。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大20文字程度で簡潔に。`,
  why: `${senderName}がそのセリフを言おうと感じたきっかけ。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大40文字程度で簡潔に。`,
  want: `${senderName}が${receiverName}に何を期待してそのセリフを言うのか。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大40文字程度で簡潔に。`,
  where: `${senderName}がいる場所（ここには個人名は書かないこと・最大10文字程度で簡潔に）`,
  receiverWhere: `${receiverName}がいる場所。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大10文字程度で簡潔に。`,
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

const KIDS_RULES_BLOCK: string = `- 登場人物の片方は必ず中学生か高校生であること。もう片方は親・先生・バイト先の人など大人も積極的に登場してよいし、同じく中学生か高校生でもよい。
- 学校・友人・恋愛・部活・放課後・家族・趣味・バイト・休日など幅広いシーンにすること
- ビジネスのシーンは避けること
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
}: {
  senderName: string;
  receiverName: string;
  englishSentence: string;
  voice: Voice;
  how: How;
  isKids?: boolean;
}): SceneInfoPromptMessages {
  const receiverGenderLabel = voiceMap[toggleVoice(voice)];
  const phoneNote = how === '電話' ? `\n${howNoteMap['電話']}` : '';

  const user = `
${senderName}という${voiceMap[voice]}が${receiverName}（${receiverGenderLabel}）に対して${how}で「${englishSentence}」と話しかけました。

この会話内容からごく自然に連想されるシーン情報を作成してください。

- ${phoneNote}
-${buildThirdPersonNote(englishSentence, senderName, receiverName)}

## 出力ルール
- 現実世界で誰もが一度は見たことがあるようなシーンにすること
- 人物の個人名は全てカタカナで書くこと
- 2コマ漫画として描くため、2コマで描けるシーンにすること。
- ${isKids ? KIDS_RULES_BLOCK : ''}

【重要】以下のJSON形式で必ず回答してください。

\`\`\`json
${JSON.stringify(buildSceneInfoResultDefinition(englishSentence, how, senderName, receiverName), null, 2)}
\`\`\`

## 出力例
以下の例を参考にしてください。

${isKids ? KIDS_SAMPLES_BLOCK : SAMPLES_BLOCK}
`;

  return { user };
}
