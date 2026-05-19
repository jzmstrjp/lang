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
    want: 'サクラがサッカー好きか知りたい',
  },
  {
    englishSentence: 'Can I borrow your eraser?',
    how: '対面',
    senderName: 'ケンジ',
    senderRole: '中学生',
    receiverName: 'エミリー',
    receiverRole: 'ケンジのクラスメイト',
    when: '授業中に問題を解いていた時',
    where: '教室の自分の席',
    receiverWhere: 'ケンジの隣の席',
    why: '間違えた文字を消したいのに自分の消しゴムが見つからなかったから',
    want: 'エミリーに消しゴムを貸してもらいたい',
  },
  {
    englishSentence: 'Are you free after school?',
    how: '対面',
    senderName: 'アオイ',
    senderRole: '高校生',
    receiverName: 'タナカ',
    receiverRole: 'アオイの担任の先生',
    when: '授業後に廊下で先生に声をかけた時',
    where: '教室の廊下',
    receiverWhere: 'アオイの前',
    why: '進路について相談したいことがあったから',
    want: 'タナカ先生に放課後に時間を作ってもらい、進路の相談をしたい',
  },
  {
    englishSentence: 'I need help with this.',
    how: '対面',
    senderName: 'ユウキ',
    senderRole: '高校生',
    receiverName: 'ヨシコ',
    receiverRole: 'ユウキのお母さん',
    when: '夕食後にリビングで宿題をしていた時',
    where: 'リビング',
    receiverWhere: 'ユウキの隣',
    why: '数学の問題が解けなくて困っていたから',
    want: 'ヨシコに問題の解き方を教えてほしい',
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

// サンプルは固定テキストとして事前にビルドしておく（Prompt Caching の prefix として先頭に置くため）
const SAMPLES_BLOCK: string = buildSamplesBlock(samples);
const KIDS_SAMPLES_BLOCK: string = buildSamplesBlock(kidsSamples);

const SCENE_INFO_PREAMBLE_BASE = `あなたは英語学習アプリのシーン設計者です。
与えられた英文のセリフに対して、自然でリアルな背景情報をJSON形式で作成してください。

## 出力ルール
- 各項目を矛盾なく埋めること
- 何かに対するリアクションではなく、送り手から話しかけた状況にすること
- 現実世界で誰もが一度は見たことがあるようなシーンにすること
- 人物の個人名は全てカタカナで書くこと`;

const SCENE_INFO_PREAMBLE = `${SCENE_INFO_PREAMBLE_BASE}

## 出力例
以下の例をよく参考にしてください。

${SAMPLES_BLOCK}`;

const KIDS_SCENE_INFO_PREAMBLE = `${SCENE_INFO_PREAMBLE_BASE}
- 登場人物の片方は必ず中学生か高校生であること。もう片方は親・先生・先輩・後輩・バイト先の人なども登場してよいし、同じく中学生か高校生でもよい。
- 友人・恋愛・部活・放課後・家族・趣味など幅広いシーンにすること
- 幼稚園児や小学校低学年を想起させるような幼い話題（砂遊び・おもちゃ・絵本・ロボット工作など）は避けること
- ビジネスや大人の職場のシーンも避けること
- 「きっかけ（why）」「動機（want）」はシンプルで直感的な内容にすること。複雑な背景や込み入った事情は避けること

## 出力例
以下の例をよく参考にしてください。

${KIDS_SAMPLES_BLOCK}`;

export type SceneInfoPromptMessages = {
  system: string;
  user: string;
};

export function buildSceneInfoPrompt({
  senderName,
  receiverName,
  englishSentence,
  voice,
  how,
  sceneNote,
  isKids = false,
}: {
  senderName: string;
  receiverName: string;
  englishSentence: string;
  voice: Voice;
  how: How;
  sceneNote?: string;
  isKids?: boolean;
}): SceneInfoPromptMessages {
  const receiverGenderLabel = voiceMap[toggleVoice(voice)];
  const phoneNote = how === '電話' ? `\n${howNoteMap['電話']}` : '';
  const sceneNoteBlock = sceneNote ? `\n${sceneNote}\n` : '';

  const user = `## 今回のお題
${senderName}という${voiceMap[voice]}が${receiverName}（${receiverGenderLabel}）に対して${how}で「${englishSentence}」と話しかけました。
${phoneNote}
${sceneNoteBlock}${buildThirdPersonNote(englishSentence, senderName, receiverName)}
【重要】以下のJSON形式で必ず回答してください。

\`\`\`json
${JSON.stringify(buildSceneInfoResultDefinition(englishSentence, how, senderName, receiverName), null, 2)}
\`\`\`
`;

  return { system: isKids ? KIDS_SCENE_INFO_PREAMBLE : SCENE_INFO_PREAMBLE, user };
}
