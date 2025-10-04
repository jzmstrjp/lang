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
  - 正確に、3語以上、10語以下の英文であること
    - 語数は5問ばらけさせること
  - 以下のバランスで生成して欲しい
    - 10%: 英単語の意味が分かれば直訳で理解できる「直訳系」
    - 90%: 日本人が苦手そうな「熟語・慣用句系」

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
   * scenePrompt
   *
   * どのような場面なのか具体的に説明した文章。
   * englishSentenceやjapaneseSentenceに書かれていない背景や、登場人物の動機が書かれている。
   * AIによる画像生成の際に使用する。
   */
  scenePrompt: string
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
   */
  englishSentence: string,
  /**
   * japaneseSentence
   *
   * receiverのセリフ
   * この文が、UI上で正解として表示される。
   * englishSentenceの自然な日本語訳。
   */
  japaneseSentence: string,
  /**
   * englishReply
   *
   * englishSentenceに対する自然な返答のセリフ
   * 熟語・慣用句をあまり使わず、英単語の意味が分かれば日本人でも理解できる簡潔な文章であること。
   */
  englishReply: string,
  /**
   * japaneseReply
   *
   * englishReplyの自然な日本語訳。
   */
  japaneseReply: string,
  /**
   * incorrectOptions
   *
   * 日本語のセリフ3つ。
   * この文たちは、UI上で誤回答として表示される。
   * japaneseSentenceとは無関係な内容であること。
   * 3つとも、japaneseSentenceと同じ文字数であること。
   * 返答ではなく、何かを質問したり話しかける内容であること。
   */
  incorrectOptions: [string, string, string],
}
```
