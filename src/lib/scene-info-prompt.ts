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
  receiverRole: `${senderName}は${receiverName}にとってどんな相手か（${senderName}の〇〇、という形式で書くこと・最大15文字程度で簡潔に。性別は記載しないこと。）`,
  when: `${senderName}が${receiverName}に上記のセリフを言ったタイミング。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）20文字程度で簡潔に。`,
  why: `${senderName}がそのセリフを言おうと感じたきっかけ。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）40文字程度で簡潔に。`,
  want: `${senderName}が${receiverName}に何を期待してそのセリフを言うのか。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）40文字程度で簡潔に。`,
  where: `${senderName}がいる場所（ここには個人名は書かないこと・最大10文字程度で簡潔に）`,
  receiverWhere: `${receiverName}がいる場所。登場人物は全て個人名で書くこと。（第三者が登場する場合はその人も含めて全て個人名で書くこと）最大10文字程度で簡潔に。`,
});

const samples: SceneInfo[] = [
  {
    englishSentence: 'Could you please pass me the salt?',
    how: '対面',
    senderName: 'シンジ',
    senderRole: '港湾近くの倉庫で働く夜勤スタッフ',
    receiverName: 'エマ',
    receiverRole: 'シンジの恋人',
    when: '仕事終わりに二人で海沿いを歩いていた夕方',
    why: '曇り空だったのに、急に雲の隙間から夕日が強く差し込んで海と街全体が赤く染まったから',
    want: 'エマにも同じ景色を見て、一緒にその瞬間を共有してほしかったから',
    where: '港の防波堤沿いの歩道',
    receiverWhere: 'シンジの隣',
  },
  {
    englishSentence: 'Which floor was I supposed to go to again?',
    how: '対面',
    senderName: 'マイク',
    senderRole: '学生',
    receiverName: 'レイナ',
    receiverRole: 'マイクの友人',
    when: 'エスカレーターで移動中',
    where: 'ショッピングモールのエスカレーター',
    receiverWhere: 'ショッピングモールのエスカレーター',
    why: 'レイナと一緒に行くはずの店が何階にあるのかを忘れてしまったから',
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
    receiverWhere: 'オフィスの休憩スペース',
    why: '友人（エマ）の活躍を知って感心し、誰かに共有したくなった',
    want: 'タカシにもエマの実績に感心してほしい',
  },
  {
    englishSentence:
      "Hi, I'm calling because we'd like to formally move forward with a contract with your company.",
    how: '電話',
    senderName: 'ユキ',
    senderRole: 'IT会社のシステムエンジニア',
    receiverName: 'デイビッド',
    receiverRole: 'ユキの会社のパートナー企業の担当者',
    when: 'IT会社の業務中',
    where: 'ユキのデスク',
    receiverWhere: 'デイビッドの所属先企業のデスク',
    why: 'パートナー企業のデイビッドが提案した内容を見て、正式に契約を結びたいと思った',
    want: 'デイビッドの会社と正式な契約を締結する',
  },
];

export function buildSceneInfoPrompt({
  senderName,
  receiverName,
  englishSentence,
  voice,
  how,
}: {
  senderName: string;
  receiverName: string;
  englishSentence: string;
  voice: Voice;
  how: How;
}): string {
  const samplesBlock = samples
    .map((sample) => {
      const { englishSentence: _es, how: _how, ...scene } = sample;
      return `英文が「${_es}」の場合:\n\`\`\`json\n${JSON.stringify(scene, null, 2)}\n\`\`\``;
    })
    .join('\n\n');

  const receiverGenderLabel = voiceMap[toggleVoice(voice)];
  const phoneNote = how === '電話' ? `\n${howNoteMap['電話']}` : '';

  return `${senderName}という${voiceMap[voice]}が${receiverName}（${receiverGenderLabel}）に対して${how}で「${englishSentence}」と話しかけました。
何かに対するリアクションではなく、${senderName}から話しかけました。

このセリフの背景の情報を作成してください。
「${englishSentence}」というセリフとごく自然にマッチする、現実世界で誰もが一度は見たことがあるようなシーンを考えてください。
そして、各項目を矛盾の無いように埋めてください。

${phoneNote}
${buildThirdPersonNote(englishSentence, senderName, receiverName)}
【重要】
以下のJSON形式で必ず回答してください。
人物の個人名は全てカタカナで書くこと。

\`\`\`json
${JSON.stringify(buildSceneInfoResultDefinition(englishSentence, how, senderName, receiverName), null, 2)}
\`\`\`

## 例
以下の例をよく参考にしてください。

${samplesBlock}
`;
}
