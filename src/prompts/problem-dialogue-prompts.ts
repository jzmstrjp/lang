/**
 * create-problems2 の生成プロンプトと、scoreProblem の採点基準で共有する要件文。
 * 生成側の「何を良しとするか」と採点側の「同じ軸で測る」を揃える。
 */

/** englishSentence 生成に課す品質（採点時の englishSentence 観点にもそのまま使う） */
export const PROMPT_ENGLISH_SENTENCE_QUALITY = `S・V・O・C・Mはそれぞれ具体的な英単語に置き換えること。（Sなら主語、Vなら動詞、Oなら目的語、Cなら補語、Mなら修飾語）
指定されたワードが慣用句の場合は、文字通りの意味で使わず慣用句として使うべし。
自然な口語の台詞が良い。
質問や依頼や意思表示など、誰かに話しかけるセリフが良い。
現代社会でよくある口語の台詞が良い。
逆に「人はそんなこと言わないだろ」と思われそうな台詞は良くない。
「これ何のためにやってんの？」と聞かれそうな目的が不明な台詞は良くない。
誰もが一度は聞いたことがある自然な台詞が良い。
英語の文法として正確であることも必須です。
できるだけ情景が浮かぶような、そのまま画像が生成できるくらい具体的な台詞が良い。
- 指定されたワードが イディオム の場合は literal として使うのは良くない。
  - 例: 指定されたワードが "spill the beans" だった場合は「秘密を漏らす」という意味で使うのが良い。「豆をこぼす」という意味で使うのは良くない。`;

/** englishReply 生成に課す品質（採点時の englishReply 観点にもそのまま使う） */
export const PROMPT_ENGLISH_REPLY_QUALITY = `【タスク】
各文について、聞き手の返答の英文（englishReply）を1つ付けよ。

【要件】
- englishReply は口語で自然な返答にすること。
  - 冒頭に適切な相槌や感嘆詞を入れること。
    - 例
      - I see
      - Got it
      - Oh
      - OK
      - Sure
      - I understand
      - I agree
      - Good
      - Thanks
  - 最大でも12語程度の簡潔な文であること。
- englishSentence の主題が連想できる内容にすること（返答だけを読んでも、何について話しかけられたかおおよそ推測できること）。
  - ただし englishSentence の内容をほぼそのままオウム返しした englishReply は禁止する。
  - englishReply は englishSentence の主題となる単語を1つ含める程度が良い。
- **不必要に話を広げないこと。** 話しかけの意図に対して、返答で話題を勝手に膨らませない。
- **アドバイスは頼まれたときだけにすること。** 相手から助言・提案を求められていないのに説教めいた助言や余計な提案をしない。`;

/** japaneseSentence（話しかけの和訳）に課す品質 */
export const PROMPT_JAPANESE_SENTENCE_QUALITY = `- japaneseSentence: englishSentence の翻訳`;

/** japaneseReply（返答の和訳）に課す品質 */
export const PROMPT_JAPANESE_REPLY_QUALITY = `- japaneseReply: englishReply の翻訳`;

/** 和訳ペア共通の文体ルール（生成・採点の日本語欄に共通） */
export const PROMPT_JAPANESE_DIALOGUE_STYLE = `口語で、関係・場所・時間の空気が伝わるように。
カタカナ英語は避け、できるだけちゃんと日本語に翻訳すること。
ただし日本語でも十分にカタカナ英語として定着しているものは、無理に日本語にしないこと。
（例: 「flexible working hours」を「時差出勤」と訳すと分かりにくいので「フレックスタイム制」と訳す方が良い）
和訳は省略や要約のしすぎを避け、英文の学習上重要な部分が落ちないようにすること。`;

export type EnglishSentenceGeneratorParams = {
  expression: string;
  min: number;
  max: number;
  noteBlock: string;
  total: number;
  half: number;
  senderVoice: 'male' | 'female';
};

const isCallNameRequired = () => Math.random() < 0.1;

/** createEnglishSentences 用のユーザープロンプト全文 */
export function buildEnglishSentenceGeneratorUserPrompt(p: EnglishSentenceGeneratorParams): string {
  const senderGender = p.senderVoice === 'male' ? '男性' : '女性';
  const receiverGender = p.senderVoice === 'male' ? '女性' : '男性';
  const receiverNameNote =
    p.senderVoice === 'male'
      ? '女性名（例: Sarah, Emily, Anna, Maria など）'
      : '男性名（例: Tom, Jake, James, Dan など）';
  return `「${p.expression}」という表現を使って、ある${senderGender}がある${receiverGender}に話しかける台詞を作れ。
話しかける人は${senderGender}、聞き手は${receiverGender}であることを前提に台詞を作ること。
${PROMPT_ENGLISH_SENTENCE_QUALITY}
必ず${p.min}〜${p.max}単語の文を作成すること。${p.noteBlock}
「${p.expression}」は何語目に来てもいい。ただし、「${p.expression}」というワードならではの文を作ること。
ビジネス系と日常生活系の台詞を${p.half}文ずつ。合計${p.total}文。
- できれば台詞の冒頭で聞き手の名前を${isCallNameRequired() ? '呼びかけて' : '呼びかけないで'}ください。呼びかける場合は必ず${receiverGender}の名前（${receiverNameNote}）を使うこと。

【重要】以下のJSON形式のみで回答すること（説明文は書かない）。

\`\`\`json
["英文1", "英文2", "... 全${p.total}文"]
\`\`\``;
}

/** buildEnglishReplies 用のユーザープロンプト全文（numberedList は話しかけ英文の列挙） */
export function buildEnglishReplyGeneratorUserPrompt(
  numberedList: string,
  senderVoice: 'male' | 'female',
): string {
  const senderGender = senderVoice === 'male' ? '男性' : '女性';
  const receiverGender = senderVoice === 'male' ? '女性' : '男性';
  return `以下は会話クイズ用の「話しかけの一文」である。話しかける人は${senderGender}、聞き手（返答する人）は${receiverGender}である。

${numberedList}

${PROMPT_ENGLISH_REPLY_QUALITY}

【厳守】
- 出力は JSON 配列のみ。説明文は禁止。
- englishSentence は上のリストの該当英文と**一字一句同じ**にコピーすること。

\`\`\`json
[
  { "englishSentence": "...", "englishReply": "..." }
]
\`\`\``;
}

/** buildJapaneseDialogues 用のユーザープロンプト全文（blocks は JSON 化したカード列） */
export function buildJapaneseDialogueGeneratorUserPrompt(blocks: string): string {
  return `以下は会話クイズの各カードである。英語の話しかけと返答に加え、SentenceContextDraft に相当する文脈が付いている。

${blocks}

【タスク】
各カードについて、englishSentence と englishReply を、その文脈に合う自然な日本語のセリフに翻訳せよ。
${PROMPT_JAPANESE_SENTENCE_QUALITY}
${PROMPT_JAPANESE_REPLY_QUALITY}
${PROMPT_JAPANESE_DIALOGUE_STYLE}

【厳守】
- englishSentence と englishReply は上の入力と一字一句同じで返すこと
- 出力は JSON 配列のみ（説明文禁止）

\`\`\`json
[
  {
    "englishSentence": "...",
    "englishReply": "...",
    "japaneseSentence": "...",
    "japaneseReply": "..."
  }
]
\`\`\``;
}

export type ScoreProblemInput = {
  /** 学習させたい英語表現（例: draw a line）。未指定なら採点から学習対応の項を省く。 */
  expression?: string;
  englishSentence: string;
  japaneseSentence: string;
  englishReply: string;
  japaneseReply: string;
};

/** scoreProblem / score-and-prune-problems 用のユーザープロンプト全文 */
export function buildScoreProblemUserPrompt(problem: ScoreProblemInput): string {
  const expr = problem.expression?.trim();
  const learningTargetSection = expr
    ? `## 学習対象の表現（採点に必ず含める）

この問題は「**${expr}**」を学習者が身につける想定の教材である。

- englishSentence にその表現が**自然な形で**含まれていること（言い換えのみ・欠落・別フレーズへのすり替えは不適切）。
- 慣用句・比喩として現れる場合は、意味・用法として妥当であること（字面だけのイディオム誤用は従来どおり減点）。
- japaneseSentence が、その表現のニュアンスを英文から大きく外さないこと。
- 「${expr}」というワードならではの englishSentence を作ること。

`
    : '';

  const evaluationPoints = expr
    ? `1. **学習対象「${expr}」と englishSentence の対応**: 指定表現が適切に使われているか、誤用やすり替えがないか
2. **englishSentence の自然さ・上記要件の充足**: ネイティブが使いそうな口語か、文法が正確か、情景が具体的か、**慣用句の使い方が自然か（字面だけの誤用でないか）**
3. **japaneseSentence の正確さ・自然さ**: 英文の意味を正確かつ自然な日本語で伝えているか（上記和訳ルール）
4. **englishReply の自然さ・適切さ**: englishSentence に対する自然で適切な返答か（上記要件）。内容が具体的か（"I see." や "OK." だけの空虚な返答はNG）。**話を不必要に広げていないか、依頼なく助言していないか**
5. **japaneseReply の正確さ・自然さ**: englishReply の意味を正確かつ自然な日本語で伝えているか（上記和訳ルール）
6. **全体の一貫性**: 4つのフィールドが会話として成立しているか`
    : `1. **englishSentence の自然さ・上記要件の充足**: ネイティブが使いそうな口語か、文法が正確か、情景が具体的か、**慣用句の使い方が自然か（字面だけの誤用でないか）**
2. **japaneseSentence の正確さ・自然さ**: 英文の意味を正確かつ自然な日本語で伝えているか（上記和訳ルール）
3. **englishReply の自然さ・適切さ**: englishSentence に対する自然で適切な返答か（上記要件）。内容が具体的か（"I see." や "OK." だけの空虚な返答はNG）。**話を不必要に広げていないか、依頼なく助言していないか**
4. **japaneseReply の正確さ・自然さ**: englishReply の意味を正確かつ自然な日本語で伝えているか（上記和訳ルール）
5. **全体の一貫性**: 4つのフィールドが会話として成立しているか`;

  const learningDeduction = expr
    ? '\n- **学習対象の表現の欠落・誤用・和訳のずれ**: -10〜-25点'
    : '';

  return `あなたは英語教育コンテンツの品質評価者です。
以下の英会話問題（英文・和訳・返答）の品質を0〜100点で採点してください。

## 評価対象

**英文 (englishSentence)**: "${problem.englishSentence}"
**和訳 (japaneseSentence)**: "${problem.japaneseSentence}"
**英語の返答 (englishReply)**: "${problem.englishReply}"
**和訳の返答 (japaneseReply)**: "${problem.japaneseReply}"
${learningTargetSection}
## 採点基準（create-problems2 生成時と同一の要件で評価すること）

### englishSentence に期待すること（生成プロンプトと同方針）
${PROMPT_ENGLISH_SENTENCE_QUALITY}

### englishReply に期待すること（生成プロンプトと同方針）
${PROMPT_ENGLISH_REPLY_QUALITY}

### japaneseSentence / japaneseReply に期待すること（生成プロンプトと同方針）
${PROMPT_JAPANESE_SENTENCE_QUALITY}
${PROMPT_JAPANESE_REPLY_QUALITY}
${PROMPT_JAPANESE_DIALOGUE_STYLE}

以下の観点で総合的に評価してください：

${evaluationPoints}

## 減点の目安

- 英文や翻訳が不自然・不正確: -10〜-30点
- **慣用句を字面だけで使っている・不自然なイディオム**: -10〜-25点
- englishReply が空虚または的外れ: -20〜-40点
- **返答が話を不必要に広げる、依頼なく助言・提案する**: -15〜-35点
- 翻訳が意味を取り違えている: -20〜-40点
- 会話として成立しない: -30〜-50点${learningDeduction}

## 出力形式

必ずJSON形式で返してください。reason は減点理由のみを20字以内で簡潔に書くこと（問題なければ「問題なし」）：
\`\`\`json
{
  "score": 85,
  "reason": "返答がやや空虚"
}
\`\`\``;
}
