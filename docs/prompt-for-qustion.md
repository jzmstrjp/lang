英会話アプリを作っている。

sender（話しかける人）とreceriver（返答する人）の会話文をたくさん作りたい。
場面に合ったトーン（カジュアル・フォーマル・砕けた）の英文にしてほしい。

以下の形式で30個の配列を出力してくれ。10個ずつ分割して出力してもいいから、品質を優先してくれ。
変数名とか要らないから配列部分だけ出力してくれ。

既存の問題と被らないように気をつけてバリエーション豊かにしてくれ。

## 重要

- englishSentence
  - 2単語から10単語くらいの英文になるようにして欲しい
    - 短文・長文をバランスよく生成して欲しい
  - 以下を半分ずつバランスよく生成して欲しい
    - 英単語の意味が分かれば直訳で理解できる「直訳系」
    - 日本人が苦手そうな「熟語・慣用句系」
- englishReply
  - 全て、英単語の意味が分かれば直訳で理解できる「直訳系」であること
- 日本語の文について
  「500円」などの数値は全て「五百円」と漢数字で表記すること

```TypeScript
type SeedProblemData = {
  /**
   * その会話が行われる場所
   * 少し具体的であること
   * 例: カフェのカウンター、レストランの入り口、コンビニのレジ、ホテルのフロント、空港の搭乗ゲート、駅の改札前、バス停のベンチ、病院の待合室、学校の教室、会社の会議室、スーパーの試食コーナー、公園のベンチ、観光地のチケット売り場、図書館の受付、映画館のチケットカウンター、郵便局の窓口、銀行のATM前、ショッピングモールのフードコート
   */
  place: string
  /**
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚
   */
  senderRole: string,
  /**
   * senderの声タイプ
   */
  senderVoice: 'male' | 'female',
  /**
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚
   */
  receiverRole: string,
  /**
   * receiverの声タイプ
   */
  receiverVoice: 'male' | 'female',
  /**
   * senderのセリフ。
   * placeに合ったセリフであること。現実でよく使われる英文であること。
   */
  englishSentence: string,
  /**
   * englishSentenceの自然な日本語訳。
   * 直訳ではなく「この場面で、日本人ならこう言うだろうな」という自然な日本語文。
   * englishSentenceのトーン（カジュアル・フォーマル・砕けた）を保ったまま自然に翻訳してほしい。
   */
  japaneseSentence: string,
  /**
   * englishSentenceに対する返答のセリフ
   * 先頭には、場面に合った相槌や感動詞を必ずつけること
   * 相槌・感動詞の例:
   * - That’s right / Yeah, true
   * - Sounds good / Nice
   * - Yeah / Uh-huh
   * - Got it / I see / Understood
   * - Really? / Huh
   * - I see / Makes sense
   * - Wow
   * - What? / Huh? / Eh?
   */
  englishReply: string,
  /**
   * englishReplyの自然な日本語訳。
   * 直訳ではなく「この場面で、日本人ならこう言うだろうな」という自然な日本語文。
   * englishReplyのトーン（カジュアル・フォーマル・砕けた）を保ったまま自然に翻訳してほしい。
   */
  japaneseReply: string,
  /**
   * 無関係な日本語文3つ。
   * できる限りjapaneseSentenceと同じ文字数であること。
   * 依頼や質問や提案や意見や情報共有のような、話しかける形式のセリフであること。
   */
  incorrectOptions: [string, string, string],
  audioEnUrl: null,
  audioJaUrl: null,
  imageUrl: null,
}
```

## 既存の問題

（ここにproblemN.tsを貼る）
