## やってほしいこと

英語リスニングアプリの問題オブジェクトを作ってほしい。

## 背景・目的

私は英語リスニングのクイズアプリを作っています。TOEICのリスニング対策のWebアプリです。

エンドユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。そんなクイズです。

あなたはクイズ用の問題文を作ってください。

# 問題文の作り方

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。実際に英語圏の人たちが普段交わすような会話がいい。何の話をしているのか意味不明な会話は絶対に避けてほしい。

## 自然な会話の例

1. 「Could you lend me a stapler for a moment?」に対して「Sure, here you go.」
2. 「Let’s at least decide on a presentation theme by the end of this week, otherwise we won’t make it in time for next month’s presentation.」に対して「You’re right. I’ll start by coming up with a few theme ideas.」
3. 「He’s always so positive, isn’t he?」に対して「Yeah, I’d like to learn from him too.」
4. 「Even though the deadline was short, Emma’s team delivered an excellent product, didn’t they?」に対して「It really is impressive. I wonder what their secret is.」

## 不自然な会話の例

1. 「The gate changed, therefore please follow the signs.」に対して「Okay, which gate number should we go to now?」

- 「follow the signs.」と言われているのに「which gate number」と質問していて不自然。「Okay, I’ll follow the signs.」の方が自然。

上記のような、自然に話しかける内容と、自然な返答を生成してほしい。

# ユーザー体験について

ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を4択から答える。
englishReply, japaneseReplyの内容も解答するためのヒントになる。

具体的には、以下の形式のオブジェクトを作ってほしい。

```TypeScript
type SeedProblemData = {
  /**
   * scenePrompt
   *
   * どのような場面なのか日本語で具体的に説明した文章。
   * この文は、AIによる画像生成に使用する。
   * 大まかな会話のストーリーと場所の様子を言語化してください。
   * 電話での会話なのか対面での会話なのかビデオ会議なのかも明記すること。
   *
   * scenePromptはユーザーからは見えないので、ここにだけ秘密の事情を書くのは避けてください。
   *
   */
  scenePrompt: string
  /**
   * place
   *
   * その会話が行われる具体的な場所
   * できればいろんな場所をランダムに。
   * 例：オフィスの会議室、病院の受付、映画館のチケット売り場、学校の職員室、図書館の閲覧室、ホテルのフロント、銀行の窓口、市役所の住民課、空港の搭乗ゲート、駅の改札口、デパートの総合案内所、レストランのレジ、カフェのカウンター、スーパーのサービスカウンター、郵便局の窓口、警察署の相談窓口、スポーツジムの受付、美術館の展示室、コンサートホールのロビー、会社のエントランスホール
   *
   * senderとreceiverが別の場所にいる場合は、以下の形式で書くこと
   * 1コマ目: 電車の改札前、2コマ目: 空港のロビー
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
   * 正確に、12語以下の文章のみを生成すること。
   * 役割や場面にあった自然な自然なセリフであること。
   * 役割に応じたトーン（カジュアル・フォーマル・丁寧・砕けた）であること。
   */
  englishSentence: string
  /**
   * japaneseSentence
   *
   * englishSentenceの日本語訳。完全な直訳ではなく、日本人の口語として自然な言い回しにすべし。
   * englishSentenceの内容をもれなく含んでいること。
   *
   * この文が、UI上で正解として表示される。
   *
   * カタカナ英語にするような翻訳は避けてください。
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
   * englishSentenceで言及されていない話題について言及することも禁止する。
   * englishSentenceとは対照的に、熟語・慣用句を使わず、英単語の意味が分かれば日本人でも理解できる簡潔な文章であること。
   *
   * 必要に応じて、自然な相槌や感動詞を使ってもよい。相槌がなくても文章が自然に成り立つなら無理に使わなくてもいい。
   * 相槌や感動詞の例: Oh, Ah, Yeah, Yep, Mm-hmm, That’s right, Yeah, that’s true, I agree, Nice, Sounds good, That’s great, No, Nah, Well, no…, Oh, really?, Huh, Interesting
   *
   * englishReply を読んだユーザーが englishSentence の内容を少しだけ推測できるようにしたい
   * だから「はい、わかりました」や「ああ、私もそれに気づきました。」というような可もなく不可もないようなセリフは禁止する。 englishSentence の主題を見つけ、具体的に言及すべし。ただし丸ごとオウム返しは避けるべし。
   */
  englishReply: string
  /**
   * japaneseReply
   *
   * englishReplyの日本語訳。完全な直訳ではなく、日本人の口語として自然な言い回しにすべし。
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
   * したがって、japaneseSentenceの回答として意味が合わない文を生成すること。
   *
   * 3文とも、senderRoleの立場でのセリフであること。receiverRoleのセリフではない。
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
- 全てのセリフはAI音声で読み上げるので、カッコ書きなどは含めず、AIが読み上げ可能な文字列にすること。
- scenePromptはユーザーからは見えないので、englishSentenceとenglishReplyだけ聞けばストーリーが分かるように作ってほしい。
