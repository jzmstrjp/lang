英語リスニングのクイズアプリを作っている。

ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答えるクイズです。

TOEICの問題によく出てくるような単語や熟語を使って問題を作ってください。
日本人には馴染みがないけれど実際にはよく使われるような単語や熟語を使ってほしい。

# 問題文の作り方

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。実際に英語圏の人たちが普段交わすような会話がいい。
ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。
englishReply, japaneseReplyの内容も解答するためのヒントになる。

以下の形式で問題データを出力してくれ。
TypeScriptのオブジェクトとして、コードブロックでください。

## 条件

- englishSentence と englishReply が自然な会話になるべき。
- englishSentence
  - 正確に、11語以上30語以内の文章のみを生成すること。
  - 質問や疑問文だけでなく、感謝・謝罪・賞賛・提案・助言・依頼・指示・許可・禁止・報告・意見・説明・誘い・慰め・励まし・冗談・雑談のセリフも必要です。
- englishReply, japaneseReply
  - 必要に応じて自然な相槌や感動詞も使用すること
  - 例: 「ああ」「うん」「そうだね」「いいね」「いや」「へえ」

```TypeScript
type SeedProblemData = {
  /**
   * place
   *
   * その会話が行われる具体的な場所
   */
  place: string
  /**
   * senderRole
   *
   * senderの役割
   * placeに合ったものであること
   * 例: placeにカフェなら店員・客など、病院なら患者・医者・看護師など
   */
  senderRole: string
  /**
   * senderVoice
   *
   * senderの声タイプ
   */
  senderVoice: 'male' | 'female'
  /**
   * receiverRole
   *
   * receiverの役割
   * placeに合ったものであること
   * 例: placeにカフェなら店員・客など、病院なら患者・医者・看護師など
   */
  receiverRole: string
  /**
   * receiverVoice
   *
   * receiverの声タイプ
   * senderとは逆のタイプであること。
   */
  receiverVoice: 'male' | 'female'
  /**
   * englishSentence
   *
   * senderのセリフ。
   * 役割や場面にあった自然な自然なセリフであること。。
   * 役割に応じたトーン（カジュアル・フォーマル・丁寧・砕けた）であること。
   */
  englishSentence: string
  /**
   * japaneseSentence
   *
   * englishSentenceの自然な日本語訳。
   * 正しさと自然さを兼ね備えた翻訳をすること。
   *
   * この文が、UI上で正解として表示される。
   *
   * ただカタカナ英語にするような翻訳は避けてください。
   * 悪い例: 「Due diligence」を「デューディリジェンス」と訳す。
   * ただし、日本でもカタカナ英語として定着しているものはカタカナ英語でもいいです。
   */
  japaneseSentence: string
  /**
   * englishReply
   *
   * englishSentenceに対するreceiverの自然な返答。役割や場面にあったもの。
   * 熟語・慣用句を使わず、英単語の意味が分かれば日本人でも理解できる簡潔な文章であること。
   *
   * この文章を読んでユーザーが englishSentence の内容を少し推測できるようにしたい
   * 良い例: 「Could you pass me the salt?」という　englishSentence　に対して「Here you are, the salt.」
   * → 少し　englishSentence　を想像するヒントになる
   * 悪い例: 「Could you pass me the salt?」という　englishSentence　に対して「Okay, got it.」
   * → 全く englishSentence　を想像するヒントにならない
   */
  englishReply: string
  /**
   * japaneseReply
   *
   * englishReplyの自然な日本語訳。
   *
   * この文章を読んでユーザーが englishSentence の内容を少し推測できるようにしたい
   * 良い例: 「Could you pass me the salt?」という　englishSentence　に対して「はい、お塩どうぞ」
   * → 少し　englishSentence　を想像するヒントになる
   * 悪い例: 「Could you pass me the salt?」という　englishSentence　に対して「うん、わかった」
   * → 全く englishSentence　を想像するヒントにならない
   */
  japaneseReply: string
  /**
   * scenePrompt
   *
   * どのような場面なのか具体的に説明した文章。
   * englishSentenceやjapaneseSentenceに書かれていない文脈・背景・場所の様子・登場人物の動機を言語化すること。
   * AIによる画像生成に使用する。
   */
  scenePrompt: string
  /**
   * senderVoiceInstruction
   *
   * senderの声のトーン
   * 例: 「親切で落ち着いた丁寧な話し方」「カジュアルで親しみやすく、元気そうに」
   */
  senderVoiceInstruction: string
  /**
   * receiverVoiceInstruction
   *
   * receiverの声のトーン
   * 例: 「親切で落ち着いた丁寧な話し方」「カジュアルで親しみやすく、元気そうに」
   */
  receiverVoiceInstruction: string
  /**
   * incorrectOptions
   *
   * japaneseSentenceより長い文字数の日本語のセリフ3つ。
   * 3文とも、確実に文字数が多くなること。
   *
   * この文たちは、UI上で誤回答として表示される。
   *
   * senderRoleの言いそうなセリフであること。receiverRoleのセリフではない。
   *
   * japaneseSentenceが疑問文だった場合には、incorrectOptionsの各文も全て疑問文にすること。
   *
   * 問題ごとにランダムにさまざまな文章を生成してほしい。文頭の語もバラバラにすること。
   * incorrectOptions3つの文は、必ず違う語で始まること。同じ語で始まるのは禁止。japaneseSentenceと同じ語で始まることも禁止します。
   * ただし「まずは」「ちなみに」「ところで」などを文頭に加えて誤魔化すような卑怯な生成はしないでください。
   *
   * 1つは馬鹿馬鹿しい文章にすること。問題ごとにさまざまな馬鹿馬鹿しい発想をすること。例:「当店で一番不人気な、とても苦いパフェはいかがですか？」「全て期限切れの食材で作ったパフェはいかがですか？本日限定ですよ！」
   * 1つはjapaneseSentenceと真逆の意味の文章にすること。
   */
  incorrectOptions: [
    string,
    string, // 1つ目とは違う単語で始まること。
    string, // 1つ目、2つ目とは違う単語で始まること。
  ]
}
```

## 重要

- 多様な問題を作りたい。
- incorrectOptions3つの文は、必ず違う語で始まること。同じ語で始まるのは禁止。japaneseSentenceと同じ語で始まることも禁止します。
- 【重要】incorrectOptions3つの文は、すべてjapaneseSentenceより文字数が多くなること。3文とも確実に文字数が多くなること。
- 以下のプロパティには「コメントで書かれたルールを守れている根拠」をTypeScriptコメントとして書いてください。
  - englishSentence
  - japaneseSentence
  - englishReply
  - japaneseReply
  - scenePrompt
  - incorrectOptions
