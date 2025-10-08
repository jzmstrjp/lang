英語リスニングのクイズアプリを作っている。

以下のTOEIC頻出単語や熟語を使った問題を作りたい。

### 📦 ビジネス一般

- submit（提出する）
- approve / approval（承認する／承認）
- deadline（締め切り）
- supervisor（上司）
- conference / seminar / workshop（会議／セミナー／研修）
- schedule / reschedule（予定／予定を変更する）
- attend / participant / attendee（出席する／参加者）
- applicant / candidate（応募者／候補者）
- promotion / demotion（昇進／降格）

### 💰 経済・会計・取引

- invoice / receipt / estimate / quotation（請求書／領収書／見積もり）
- profit / revenue / expense / cost（利益／収益／費用／コスト）
- budget / financial statement（予算／財務諸表）
- refund / reimbursement（返金／払い戻し）
- negotiate / contract / agreement（交渉する／契約／合意）

### 🏢 オフィス・職場表現

- make a reservation / appointment（予約を取る）
- run out of ~（～を使い果たす）
- be responsible for ~（～の責任がある）
- in charge of ~（～を担当している）
- on behalf of ~（～を代表して）
- as soon as possible (ASAP)（できるだけ早く）
- ahead of schedule / behind schedule（予定より早く／遅れて）

### 🚗 通勤・出張・旅行

- boarding pass / itinerary / departure / arrival（搭乗券／旅程／出発／到着）
- carry-on luggage / baggage claim（機内持ち込み荷物／荷物受取所）
- accommodation / vacancy / reservation（宿泊施設／空室／予約）
- transportation / shuttle / fare（交通手段／送迎バス／運賃）

### 🧾 熟語・慣用句

- call off / put off / postpone（中止・延期する）
- take over（引き継ぐ）
- look forward to ~ing（～を楽しみにする）
- fill out / fill in（記入する）
- set up / arrange / organize（設定・手配・準備する）
- turn in / hand in / submit（提出する）
- carry out / conduct / perform（実施する）
- come up with（思いつく）
- be supposed to（～することになっている）

### ✉️ よく出るビジネス文の型

- We are pleased to inform you that...（～をお知らせできることを嬉しく思います）
- Please be advised that...（～をご承知おきください）
- Should you have any questions, please feel free to contact us.（ご質問があればお気軽にご連絡ください）
- Due to unforeseen circumstances, ...（予期せぬ事情により～）

# 問題文の作り方

sender（話しかける人）とreceriver（返答する人）の、口語として自然な会話文をたくさん作りたい。
ユーザーは、AI音声で再生されるenglishSentenceを聴いて、正しい意味を答える。
japaneseReplyの内容もヒントになる。

以下の形式で5個の問題データを出力してくれ。
JSON形式の配列で出力してくれ。
[]このカッコ要らない。{},{},{}こう中身だけくれ。
TypeScriptのコードブロックでください。

## 条件

- englishSentence
  - 正確に、3語以上かつ10語以内の文章のみを生成すること。
  - 以下のバランスで生成して欲しい
    - 50%: 英単語の意味が分かれば直訳で理解できる「直訳系」
    - 50%: 日本人が苦手そうな「熟語・慣用句系」
- reply系
  - 必要に応じて自然な相槌や感動詞も使用すること
- 全てのセリフは、それぞれの人物の役割に応じたトーン（カジュアル・フォーマル・丁寧・砕けた）であること
- 日本語文は、直訳ではなく自然に翻訳したものであること。
  - 英文のニュアンス（カジュアル・フォーマル・丁寧・砕けた）を保つこと。
- incorrectOptions
  - incorrectOptionsの3つのセリフの文字数はjapaneseSentenceと正確に同じ文字数であること。japaneseSentenceより短い文は禁止する。似たような文章ばかりなのも禁止する。

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
   * englishSentenceやjapaneseSentenceに書かれていない文脈・背景・場所の様子・登場人物の動機を言語化すること。
   * AIによる画像生成に使用する。
   */
  scenePrompt: string
  /**
   * senderRole
   *
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚、デザイナー、エンジニア、プロジェクトマネージャー、母親、父親、息子、娘
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
   * senderの役割
   * 例: カフェの店員、レストランの客、教師、生徒、上司、部下、同僚、デザイナー、エンジニア、プロジェクトマネージャー、母親、父親、息子、娘
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
   */
  englishSentence: string
  /**
   * japaneseSentence
   *
   * englishSentenceの日本語訳。
   * この文が、UI上で正解として表示される。
   */
  japaneseSentence: string
  /**
   * englishReply
   *
   * englishSentenceに対するreceiverの返答。
   * 熟語・慣用句をあまり使わず、英単語の意味が分かれば日本人でも理解できる文章であること。
   */
  englishReply: string
  /**
   * japaneseReply
   *
   * englishReplyの日本語訳。
   */
  japaneseReply: string
  /**
   * incorrectOptions
   *
   * japaneseSentenceと正確に同じ文字数の日本語のセリフ3つ。
   * senderRoleの言いそうなセリフであること。receiverRoleのようなセリフは禁止する。
   * この文たちは、UI上で誤回答として表示される。
   * 短いセリフばかりだと「長いセリフを選べば正解だな」とユーザーに推測されてしまうのでやめてほしい。
   * 長いセリフばかりだと「短いセリフを選べば正解だな」とユーザーに推測されてしまうのでやめてほしい。
   * 「一番長いものが正解」「一番短いのが正解」「真ん中くらいのが正解」これを問題ごとにバラけさせてほしい。
   * 3つのセリフの文字数はjapaneseSentenceと正確に同じ文字数であること。japaneseSentenceより短い文は禁止する。似たような文章ばかりなのも禁止する。
   * 例: JapaneseSentenceが「よろしければ新作の抹茶ラテ、試してみませんか？」の場合には「すみません、抹茶のラテは売り切れてしまいました。」「抹茶のラテはありませんが、通常のカフェラテならございます。」「このバナナパフェが当店の一番人気でございます。」などを生成すること。
   */
  incorrectOptions: [string, string, string]
  /**
   * senderVoiceInstruction
   *
   * senderの声のトーン
   * senderRoleとenglishSentenceに適した指示であること。
   * ニュアンス（カジュアル・フォーマル・丁寧・砕けた）や感情に言及した具体的な指示であること
   * 例: 「明るく楽しみにしている気持ちを込めて」「厳しく冷たい口調で」「激しい怒りを込めて」「親切で落ち着いた丁寧な話し方」「カジュアルで親しみやすく、元気そうに」
   */
  senderVoiceInstruction: string
  /**
   * receiverVoiceInstruction
   *
   * receiverの声のトーン
   * receiverRoleとjapaneseReplyに適した指示であること。
   * ニュアンス（カジュアル・フォーマル・丁寧・砕けた）や感情に言及した具体的な指示であること
   * 例: 「明るく楽しみにしている気持ちを込めて」「厳しく冷たい口調で」「激しい怒りを込めて」「親切で落ち着いた丁寧な話し方」「カジュアルで親しみやすく、元気そうに」
   */
  receiverVoiceInstruction: string
}
```

## 重要

- incorrectOptionsの3つのセリフの文字数はjapaneseSentenceと正確に同じ文字数であること。japaneseSentenceより短い文は禁止する。似たような文章ばかりなのも禁止する。
