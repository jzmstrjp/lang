## やってほしいこと

英語クイズの問題をJSON形式で作ってほしい。

## 背景・目的

私は英語リスニングのクイズアプリを作っています。TOEICのリスニング対策のWebアプリです。

エンドユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。そんなクイズです。

### ユーザー体験

- エンドユーザーは、1枚の画像（1コマ目と2コマ目に分割されている）を見ながら englishSentence と japaneseReply（またはenglishReply） を聴きます。
- その2コマ画像と音声をヒントに、4択クイズの中からenglishSentenceの正しい日本語訳を選択し解答します。
- 1コマ目はenglishSentenceと対応しています。2コマ目はjapaneseReply, englishReplyと対応しています

あなたはクイズ用の問題文を作ってください。

# 問題文の作り方

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。実際に英語圏の人たちが普段交わすような会話がいい。何の話をしているのか意味不明な会話は絶対に避けてほしい。
指定された語彙（後述の「○問目: ××」で示されるワード）に応じて、ビジネス系か私生活系の会話を生成してください。
例: 'make a reservation'や'in advance'なら私生活系（買い物系とか旅行系とかもOK）。'reschedule the meeting'ならビジネス系。
迷ったら私生活系の会話を生成してください。

## 自然な会話の例

1. 「Could you lend me a stapler for a moment?」に対して「Sure, here you go.」
2. 「Let’s at least decide on a presentation theme by the end of this week, otherwise we won’t make it in time for next month’s presentation.」に対して「You’re right. I’ll start by coming up with a few theme ideas.」
3. 「He’s always so positive, isn’t he?」に対して「Yeah, I’d like to learn from him too.」
4. 「Even though the deadline was short, Emma’s team delivered an excellent product, didn’t they?」に対して「It really is impressive. I wonder what their secret is.」

## 不自然な会話の例

- 「The gate changed, therefore please follow the signs.」に対して「Okay, which gate number should we go to now?」
  - 理由: 「follow the signs.」と言われているのに「which gate number」と質問していて不自然。「Okay, I’ll follow the signs.」の方が自然。
- 「I'm running late due to the security line.」に対して「No worries. Just tap your badge, and you're good to go.」
  - 理由: 状況がよく分からない。会話のつながりとして意味不明。最悪。

上記のような、自然に話しかける内容と、自然な返答を生成してほしい。

# ユーザー体験について

ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を4択から答える。
englishReply, japaneseReplyの内容も解答するためのヒントになる。

具体的には、以下の形式のオブジェクトを作ってほしい。
各プロパティが矛盾しないように整合性を保ってほしい。

```TypeScript
type SeedProblemData = {
   /**
   * englishSentence
   *
   * senderのセリフ。
   *
   * このセリフだけ読めば、どんな状況なのか分かるようなセリフにしてください。何をしたいのか意味不明なセリフは絶対にやめてください。
   * 役割に応じたトーン（カジュアル・フォーマル・丁寧・砕けた）であること。
   * 現実にあり得るような、自然なセリフにしてください。
   *
   * 悪い例:
   * - Are we on schedule according to the schedule?
   *   - 冗長で不自然。「Are we on schedule?」で伝わる。こういった文は避けてくれ。
   */
  englishSentence: string
  /**
   * japaneseSentence
   *
   * englishSentenceの日本語訳。完全な直訳ではなく、日本語として自然で分かりやすい言い回しにすべきです。日本語として自然な語順にすべきです。
   * ただしenglishSentenceの内容を省略しないこと。
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
   * englishReply を読んだユーザーが englishSentence の内容を少しだけ推測できるようにしたい
   * だから「はい、わかりました」や「ああ、私もそれに気づきました。」というような可もなく不可もないようなセリフは禁止する。 englishSentence の主題を見つけ、具体的に言及すべし。ただし丸ごとオウム返しは避けるべし。
   * このセリフだけ読めば、どんな状況なのか分かるようなセリフにしてください。何をしたいのか意味不明なセリフは絶対にやめてください。
   *
   * 必要に応じて、自然な相槌や感動詞を使ってもよい。無理に使わなくてもいい。
   * できれば12語以内の、長すぎないセリフが好ましいです。
   * 余計な内容も含めないでください。
   */
  englishReply: string
  /**
   * place
   *
   * その会話が行われる場所。できるだけ具体的に。
   * englishSentenceとenglishReplyの内容から、適切な場所を考えてください。
   *
   * 基本的には対面での会話を想定しています。
   * 電話やビデオ通話などのシーンでは、senderとreceiverが離れた場所にいるはずなので、以下の形式でセリフごとの場所を明記すること
   * 例: 【1コマ目】電車の改札前、【2コマ目】空港のロビー
   */
  place: string
  /**
   * japaneseReply
   *
   * englishReplyの日本語訳。完全な直訳ではなく、日本語として自然で分かりやすい言い回しにすべきです。日本語として自然な語順にすべきです。
   * ただしenglishReplyの内容を省略しないこと。
   */
  japaneseReply: string
  /**
   * scenePrompt
   *
   * どのような場面なのか日本語で具体的に説明した文章。
   * この文は、AIによる画像生成に使用する。
   * 大まかな会話のストーリーと場所の様子を言語化してください。
   * 基本的には対面での会話を想定していますが、placeと整合性が取れるようにしてください。
   * 対面でなく電話やビデオ通話での会話である場合は、その旨を明記してください。音声で読み上げるので「メール」とか「チャット」という場面は禁止します。
   * senderとreceiverが離れた場所にいる場合は、電話かビデオ通話の場面になるはずです。
   * 各登場人物たちの目的や動機も言語化してください。
   * 各登場人物が「まだやっていないこと」も明記してほしい。（例: receiverはまだ何も注文していない）
   * 1コマ目（englishSentence）で何が起こって何が起こらないか、2コマ目（englishReply）で何が起こって何が起こらないか、も明記してくれ。
   *
   * scenePromptはユーザーからは見えないので、ここにだけ秘密の事情を書くのは避けてください。
   *
   */
  scenePrompt: string
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
}
```

## 重要

- 全てのセリフはAI音声で読み上げるので、カッコ書きなどは含めず、AIが読み上げ可能な文字列にすること。
- scenePrompt はユーザーからは見えないので、englishSentenceとenglishReplyだけ読めばどんな状況なのか分かるように作ってほしい。
