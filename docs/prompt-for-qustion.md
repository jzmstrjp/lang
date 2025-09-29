英会話アプリを作っている。

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。
場面や役割に合わせたトーン（カジュアル・フォーマル・砕けた）の英文にしてほしい。
状況が分かりやすく、絵が浮かぶような会話にしてほしい。
英文も日本語訳も、実際にその場面で使われる自然な言い回しにしてほしい。

以下の形式で30個の配列を出力してくれ。10個ずつ分割して出力してもいいから、自然な会話や文章の品質を優先してくれ。
変数名とか要らないから配列の中身だけ出力してくれ。
[]このカッコ要らない。{},{},{}こう中身だけくれ。
TypeScriptのコードブロックでください。

既存の問題と被らないように気をつけてバリエーション豊かにしてくれ。

## 条件

- englishSentence
  - 5単語から10単語くらいの英文になるようにして欲しい
    - 短文・長文の量をバランスよく生成して欲しい
  - 以下のバランスで生成して欲しい
    - 10%: 英単語の意味が分かれば直訳で理解できる「直訳系」
    - 90%: 日本人が苦手そうな「熟語・慣用句系」
- englishReply
  - 熟語・慣用句をあまり使わず、英単語の意味が分かれば日本人でも理解できる文章にしてください。
  - englishSentenceの完全なオウム返しの文章ではなく、部分的に言及するような文章にしてください。
    - 悪い例: 「豆乳にしますか？」に対して「はい、豆乳にします」
    - 良い例: 「豆乳にしますか？」に対して「はい、お願いします」
- 日本語の文について
  「500円」などの数値は全て「五百円」と漢数字で表記すること

```TypeScript
type SeedProblemData = {
  /**
   * place
   *
   * その会話が行われる場所
   * 少し具体的であること
   * 例: カフェのカウンター、レストランの入り口、コンビニのレジ、ホテルのフロント、空港の搭乗ゲート、駅の改札前、バス停のベンチ、病院の待合室、学校の教室、会社の会議室、スーパーの試食コーナー、公園のベンチ、観光地のチケット売り場、図書館の受付、映画館のチケットカウンター、郵便局の窓口、銀行のATM前、ショッピングモールのフードコート
   */
  place: string
  /**
   * senderRole
   *
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚
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
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚
   */
  receiverRole: string,
  /**
   * receiverVoice
   *
   * receiverの声タイプ
   */
  receiverVoice: 'male' | 'female',
  /**
   * englishSentence
   *
   * senderのセリフ。
   * placeに合ったセリフであること。現実でよく使われる英文であること。
   * receiverRoleに合ったトーン（カジュアル・フォーマル・砕けた）のセリフであること。
   */
  englishSentence: string,
  /**
   * japaneseSentence
   *
   * englishSentenceの自然な日本語訳。
   * 直訳ではなく「この場面で、日本人ならこう言うだろうな」という自然な日本語文。
   * englishSentenceのトーン（カジュアル・フォーマル・砕けた）を保ったまま自然に翻訳してほしい。
   */
  japaneseSentence: string,
  /**
   * englishReply
   *
   * englishSentenceに対する自然な返答のセリフ
   * receiverRoleに合ったトーン（カジュアル・フォーマル・砕けた）のセリフであること。現実でよく使われる英文であること。
   * 先頭には、場面やトーン（カジュアル・フォーマル・砕けた）に合わせた相槌や感動詞をつけること
   */
  englishReply: string,
  /**
   * japaneseReply
   *
   * englishReplyの自然な日本語訳。
   * 直訳ではなく「この場面で、日本人ならこう言うだろうな」という自然な日本語文。
   * englishReplyのトーン（カジュアル・フォーマル・砕けた）を保ったまま自然に翻訳してほしい。
   * 相槌や感動詞も翻訳すること
   * 相槌・感動詞の例: いいね、そうだね、そうでですね、うん、はい、いえ、あぁ、へぇ
   */
  japaneseReply: string,
  /**
   * incorrectOptions
   *
   * japaneseSentenceとは異なる日本語文3つ。
   * ただしその場面で言う可能性があるセリフ。
   * できる限りjapaneseSentenceと同じ文字数であること。
   * 依頼や質問や提案や意見や情報共有のような、話しかける形式のセリフであること。
   */
  incorrectOptions: [string, string, string],
}
```

# 会話データ作成ルール

## 不自然な文章は禁止します

- **japaneseSentence**
  - 悪い例: 「映画が始まる前に一番近いトイレを教えてもらえますか？」
  - 良い例: 「映画が始まる前にトイレに行きたいんですけど、一番近いのはどこですかね？」

- **japaneseReply**
  - 悪い例: 「あぁ、お願いします。少しだけで。」
  - 良い例: 「お願いします。少しだけで大丈夫です。」

- **englishSentence**
  - 悪い例: "Excuse me, when will my name be called?"
  - 良い例: "Excuse me, when will I be called?"

---

## 不自然な流れの会話は禁止します

- 悪い例1:
  - japaneseSentence: 「黒板を見てください。」
  - japaneseReply: 「はい、今黒板を見ています」
- 良い例1:
  - japaneseSentence: 「黒板を見てください。」
  - japaneseReply: 「はい、見ますね」

- 悪い例2:
  - englishSentence: "Would you like to try a sample of this cheese?"
  - englishReply: "No, I don’t like coffee."
- 良い例2:
  - englishSentence: "Would you like to try a sample of this cheese?"
  - englishReply: "Yes please, just a small piece."

- 悪い例3:
  - japaneseSentence: 「このコーヒーを持ち帰りにしてもらえますか？」
  - japaneseReply: 「三番ホームから青い路線に乗ってください。」
- 良い例3:
  - japaneseSentence: 「このコーヒーを持ち帰りにしてもらえますか？」
  - japaneseReply: 「はい、テイクアウト用のカップに入れますね」

---

## 繰り返し・重複は禁止します

- 悪い例: 同じ「映画館のロビー」「公園のベンチ」の会話を複数回登録する
- 良い例: すべてのシーンが一度ずつだけ出てくるようにする

---

## 不自然な敬語や硬すぎる表現は禁止します

- 悪い例: 「あぁ、いいえ、空いていますよ。ここに座れます。」
- 良い例: 「いいえ、空いていますよ。どうぞ座ってください。」

- 悪い例: 「はい、すぐに手配いたします。」（カジュアルなやりとりに対して）
- 良い例: 「はい、すぐに手配しますね。」

---

## 直訳調の文は禁止します

- 悪い例: japaneseSentence「支払いを二枚のカードに分けてもらえますか？」
- 良い例: japaneseSentence「二つのカードで支払えますか？」

- 悪い例: englishReply: "Yes, that would be very helpful."（部下とのカジュアルな会話）
- 良い例: englishReply: "Yeah, that would help a lot."

## 重要

sender（話しかける人）とreceriver（返答する人）の会話が自然に繋がるように心がけてください。
「普通そんな問いかけしないだろ」「普通そんな返事しないだろ」「日本人はそうは言わねーよ」っていう会話は作らないでください。

まずは、レビューしたいから

place
senderRole
englishSentence
englishReply
receiverRole
japaneseSentence
japaneseReply

のみ30問分生成してみてくれ。
