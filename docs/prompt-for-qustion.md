## やってほしいこと

英語リスニングアプリの問題オブジェクトを作ってほしい。

## 背景・目的

私は英語リスニングのクイズアプリを作っています。TOEIC対策のWebアプリです。

エンドユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。そんなクイズです。

あなたはクイズ用の問題文を作ってください。

# 問題文の作り方

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。実際に英語圏の人たちが普段交わすような会話がいい。
ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。
englishReply, japaneseReplyの内容も解答するためのヒントになる。

具体的には、以下の形式のオブジェクトを作ってほしい。

```TypeScript
type SeedProblemData = {
  /**
   * scenePrompt
   *
   * どのような場面なのか具体的に説明した文章。
   * englishSentenceやjapaneseSentenceに書かれていない文脈・背景・場所の様子・登場人物の動機を言語化すること。
   * AIによる画像生成に使用する。
   */
  scenePrompt: string
  /**
   * place
   *
   * その会話が行われる具体的な場所
   * できればいろんな場所をランダムに。
   * 例：オフィスの会議室、病院の受付、映画館のチケット売り場、学校の職員室、図書館の閲覧室、ホテルのフロント、銀行の窓口、市役所の住民課、空港の搭乗ゲート、駅の改札口、デパートの総合案内所、レストランのレジ、カフェのカウンター、スーパーのサービスカウンター、郵便局の窓口、警察署の相談窓口、スポーツジムの受付、美術館の展示室、コンサートホールのロビー、会社のエントランスホール
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
   * 正確に、10語以下の文章のみを生成すること。
   * 役割や場面にあった自然な自然なセリフであること。
   * 役割に応じたトーン（カジュアル・フォーマル・丁寧・砕けた）であること。
   */
  englishSentence: string
  /**
   * japaneseSentence
   *
   * englishSentenceの自然な日本語訳。
   * 正しさと自然さを兼ね備えた翻訳をすること。
   * englishSentence の内容を一切省略せずに正確に翻訳してください。
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
   * englishSentenceに対するreceiverのごく自然な返答。役割や場面にあったもの。
   * 文脈的に自然な返答であることが重要です。
   * 驚きだったり、同意だったり、質問だったり、質問に対する回答だったり、場面に応じた自然な返答のセリフ。
   * 少しでも不自然な返答は禁止する。
   * englishSentenceとは対照的に、熟語・慣用句を使わず、英単語の意味が分かれば日本人でも理解できる簡潔な文章であること。
   *
   * 必要に応じて、自然な相槌や感動詞を使ってもよい。
   * 相槌や感動詞の例: Oh, Ah, Yeah, Yep, Mm-hmm, That’s right, Yeah, that’s true, I agree, Nice, Sounds good, That’s great, No, Nah, Well, no…, Oh, really?, Huh, Interesting
   *
   * englishReply を読んだユーザーが englishSentence の内容を少しだけ推測できるようにしたい
   * だから「はい、わかりました」や「ああ、私もそれに気づきました。」というような可もなく不可もないようなセリフは禁止する。 englishSentence の主題を見つけ、具体的に言及すべし。ただし丸ごとオウム返しは避けるべし。
   */
  englishReply: string
  /**
   * japaneseReply
   *
   * englishReplyの自然な日本語訳。
   * englishReplyの内容をもれなく含んでいること。
   */
  japaneseReply: string
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
   * japaneseSentenceより少し長い文字数の日本語のセリフ3つ。
   * 3文とも、確実に文字数が少し長いこと。
   *
   * この文たちは、UI上で誤回答として表示される。
   *
   * senderRoleの言いそうなセリフであること。receiverRoleのセリフではない。
   *
   * japaneseSentenceが疑問文だった場合には、incorrectOptionsの各文も全て疑問文にすること。
   *
   * incorrectOptions3つの文は、必ず違う語で始まること。同じ語で始まるのは禁止。japaneseSentenceと同じ語で始まることも禁止します。
   * ただし「まずは」「ちなみに」「ところで」などを文頭に加えて誤魔化すような卑怯な生成はしないでください。
   *
   * 1つは馬鹿馬鹿しい文章にすること。例:「当店で一番不人気な、とても苦いパフェはいかがですか？」「全て期限切れの食材で作ったパフェはいかがですか？本日限定ですよ！」
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

- incorrectOptions3つの文は、必ず違う語で始まること。同じ語で始まるのは禁止。japaneseSentenceと同じ語で始まることも禁止します。
- 【重要】incorrectOptions3つの文は、すべてjapaneseSentenceより少し長いであること。3文とも確実に少し長い文字数であること。
- 以下のプロパティには「コメントで書かれたルールを守れている根拠」をTypeScriptコメントとして書いてください。
  - englishSentence
  - japaneseSentence
  - englishReply
  - japaneseReply
  - scenePrompt
  - incorrectOptions
