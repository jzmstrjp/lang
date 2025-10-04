英語リスニングのクイズアプリを作っている。

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。
ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。
japaneseReplyの内容もヒントになる。

以下の形式で5個の問題データを出力してくれ。
JSON形式の配列で出力してくれ。
[]このカッコ要らない。{},{},{}こう中身だけくれ。
TypeScriptのコードブロックでください。

## 条件

- englishSentence
  - 3語から6語の英文であること
    - 語数のバランスよく生成して欲しい
  - 以下のバランスで生成して欲しい
    - 10%: 英単語の意味が分かれば直訳で理解できる「直訳系」
    - 90%: 日本人が苦手そうな「熟語・慣用句系」
- 日本語の文について
  「500円」などの数値は全て「五百円」と漢数字で表記すること
  - 紛らわしい漢字は、ひらがなで表記すること
    - 例1: 「十分」は「じゅうぶん」なのか「じゅっぷん」なのか曖昧なので、ひらがなで表記すること
    - 例2: 「辛い」は「からい」なのか「つらい」なのか曖昧なので、ひらがなで表記すること

```TypeScript
type SeedProblemData = {
  /**
   * place
   *
   * その会話が行われる場所
   * 少し具体的であること
   * 例: システム開発会社の会議室、アプリのデザイン会議、アプリのUX会議、エンジニアの会議、ビジネスのミーティング、カフェのカウンター、レストランの入り口、コンビニのレジ、ホテルのフロント、空港の搭乗ゲート、駅の改札前、バス停のベンチ、病院の待合室、学校の教室、会社の会議室、スーパーの試食コーナー、公園のベンチ、観光地のチケット売り場、図書館の受付、映画館のチケットカウンター、郵便局の窓口、銀行のATM前、ショッピングモールのフードコート
   */
  place: string
  /**
   * senderRole
   *
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚、デザイナー、エンジニア、プロジェクトマネージャー、母親、父親、息子、娘
   */
  senderRole: string,
  /**
   * senderVoice
   *
   * senderの声タイプ
   */
  senderVoice: 'male' | 'female',
  /**
   * receiverRole
   *
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚、デザイナー、エンジニア、プロジェクトマネージャー、母親、父親、息子、娘
   */
  receiverRole: string,
  /**
   * receiverVoice
   *
   * receiverの声タイプ
   * senderとは逆のタイプであること。
   */
  receiverVoice: 'male' | 'female',
  /**
   * englishSentence
   *
   * senderのセリフ。
   * placeとsenderRoleに適したセリフであること。現実でよく使われる英文であること。
   * receiverRoleに合ったトーン（カジュアル・フォーマル・砕けた）のセリフであること。
   */
  englishSentence: string,
  /**
   * japaneseSentence
   *
   * receiverのセリフ
   * この文が、UI上で正解として表示される。
   * englishSentenceの自然な日本語訳。
   * placeとsenderRoleに適したセリフであること。
   * 直訳ではなく「この場面で、日本人ならこう言うだろうな」という自然な日本語文。
   * englishSentenceのトーン（カジュアル・フォーマル・砕けた）を保ったまま自然に翻訳してほしい。
   */
  japaneseSentence: string,
  /**
   * englishReply
   *
   * englishSentenceに対する自然な返答のセリフ
   * placeとreceiverRoleに適したセリフであること。
   * 熟語・慣用句をあまり使わず、英単語の意味が分かれば日本人でも理解できる文章にしてください。
   * receiverRoleに合ったトーン（カジュアル・フォーマル・砕けた）のセリフであること。現実でよく使われる英文であること。
   * 先頭には、場面やトーン（カジュアル・フォーマル・砕けた）に合わせた相槌や感動詞をつけること
   */
  englishReply: string,
  /**
   * japaneseReply
   *
   * englishReplyの自然な日本語訳。
   * placeとreceiverRoleに適したセリフであること。
   * 直訳ではなく「この場面で、日本人ならこう言うだろうな」という自然な日本語文。
   * englishReplyのトーン（カジュアル・フォーマル・砕けた）を保ったまま自然に翻訳してほしい。
   * 相槌や感動詞も翻訳すること
   * 相槌・感動詞の例: いいね、そうだね、そうでですね、うん、はい、いえ、あぁ、へぇ
   */
  japaneseReply: string,
  /**
   * incorrectOptions
   *
   * japaneseSentenceとはかなり意味が異なる日本語文3つ。
   * ただしその場面でsenderが言う可能性があるセリフ。
   * この文たちは、UI上で誤回答として表示される。
   * 3つとも、japaneseSentenceと近い文字数であること。
   * japaneseReplyと意味的に繋がらない文章であること。
   */
  incorrectOptions: [string, string, string],
}
```

## 重要

sender（話しかける人）とreceriver（返答する人）の会話が自然に繋がるように心がけてください。
