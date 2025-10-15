import { SeedProblemData } from '../src/types/problem';

const problemData: SeedProblemData[] = [
  {
    place: '町のクリニック受付',
    senderRole: '受付係',
    senderVoice: 'female',
    receiverRole: '患者',
    receiverVoice: 'male',
    englishSentence: 'We’re a bit short-staffed today—could I slot you in at noon instead?',
    japaneseSentence: '本日は人手不足で、正午に変更でもよろしいですか？',
    englishReply: 'No problem. Noon works for me. Do I need to bring anything?',
    japaneseReply: '大丈夫です。正午で構いません。何か持ち物はありますか？',
    scenePrompt:
      '小さな町の内科クリニックの受付前。午前中に予約が集中しており、受付係は人員不足で時間変更の協力をお願いしている。患者は近所に住む常連で、落ち着いた雰囲気の待合室には観葉植物と雑誌が置かれている。',
    senderVoiceInstruction: '丁寧で申し訳なさをにじませる落ち着いた口調で、迅速に事情を説明する。',
    receiverVoiceInstruction: '落ち着いた口調で理解を示し、穏やかに確認する。',
    incorrectOptions: [
      'ただちに診察へご案内が可能でございます。本日中。',
      '診察は月の満ち欠け次第で決めます。宇宙基準です。',
      '夕方に空きがなく、本日は受付終了です。申し訳なし。',
    ],
  },
  {
    place: 'カフェのバックヤード',
    senderRole: '店長',
    senderVoice: 'male',
    receiverRole: 'コーヒー豆の卸担当',
    receiverVoice: 'female',
    englishSentence: 'Our house blend is back-ordered; could you expedite a partial shipment?',
    japaneseSentence: '看板ブレンドが入荷待ちで、部分出荷を早められますか？',
    englishReply: 'I can rush a half pallet today and the rest tomorrow. Does that help?',
    japaneseReply: '本日半パレット、明日残りを急送できます。お役に立ちますか？',
    scenePrompt:
      '昼どきの繁忙前、カフェの在庫棚を確認しながら店長が卸業者に電話。看板ブレンドの在庫が切れかけており、部分出荷の前倒しを交渉している。店内は挽きたての香りと低いBGMが流れている。',
    senderVoiceInstruction: '切迫感を軽くにじませつつ、実務的で礼儀正しい口調。',
    receiverVoiceInstruction: '手際よく事務的に、即答できる自信のある口調で。',
    incorrectOptions: [
      '在庫は十分あり、納期は通常通りです。ご安心ください。',
      '豆は自家栽培なので宇宙から届きます。たぶん明日も、ね',
      '欠品のため、本日の受注は見合わせとなります。ご了承ね',
    ],
  },
  {
    place: '本社オフィスのITヘルプデスク',
    senderRole: 'ヘルプデスク担当者',
    senderVoice: 'female',
    receiverRole: '社員',
    receiverVoice: 'male',
    englishSentence:
      'Heads-up: there’s a planned outage tonight—could you back up your files beforehand?',
    japaneseSentence: '今夜は計画停止のため、事前にファイルをバックアップしてください。',
    englishReply: 'Got it. I’ll save everything to the shared drive before I leave.',
    japaneseReply: '了解です。退勤前に共有ドライブへ保存しておきます。',
    scenePrompt:
      '夕方のフロア。定期メンテナンスでファイルサーバーが夜間停止予定。担当者が社内チャットと口頭で周知し、社員は作業締めに入っている。周囲にはデュアルモニターと書類が並ぶ。',
    senderVoiceInstruction: '端的でフレンドリー、注意喚起をはっきり伝える口調。',
    receiverVoiceInstruction: '落ち着いた確認のトーンで、協力する意思を明快に示す。',
    incorrectOptions: [
      '今夜の停止はなく、準備は不要ですのでそのままで大丈夫です。本日中。',
      '停電の代わりに満月が光るので、PCを月光充電してください。今夜も',
      '明日の朝に停止予定で、今夜の対応は必要ありません。ご了承ください。',
    ],
  },
  {
    place: 'シティホテルのフロント',
    senderRole: 'コンシェルジュ',
    senderVoice: 'male',
    receiverRole: '宿泊客',
    receiverVoice: 'female',
    englishSentence:
      'As a goodwill gesture, we can comp your breakfast and upgrade you, if that works.',
    japaneseSentence: 'お詫びとして朝食を無料にし、客室のアップグレードも承ります。',
    englishReply: 'Thank you. That would make up for the delay. I appreciate it.',
    japaneseReply: 'ありがとうございます。遅延の件もそれで納得できます。助かります。',
    scenePrompt:
      'チェックインで部屋準備が遅れ、コンシェルジュが誠意を示して提案。大理石のロビー、柔らかな照明、静かなピアノ曲が流れている。宿泊客は出張中で時間に余裕は少ない。',
    senderVoiceInstruction: '丁寧で誠実、落ち着いた声でお詫びと提案を伝える。',
    receiverVoiceInstruction: '安心した様子で感謝を述べる穏やかな口調。',
    incorrectOptions: [
      '追加料金をいただき、客室は下位タイプへの変更となります。本日。',
      '朝食は雲の上で提供し、部屋は宇宙船に変形します。夢の演出です',
      '本日は満室ですが、ラウンジの利用権は無償でご用意します。特典',
    ],
  },
  {
    place: '物流倉庫の出荷カウンター',
    senderRole: '出荷担当',
    senderVoice: 'female',
    receiverRole: '取引先担当者',
    receiverVoice: 'male',
    englishSentence:
      'We’re in a last-minute crunch, but I can bump your order up if you’re flexible on quantity.',
    japaneseSentence: '大詰めですが、数量に融通いただければご注文を前倒しできます。',
    englishReply: 'I can accept fewer units this week. Please ship whatever you can.',
    japaneseReply: '今週は数量を減らして構いません。可能な分で出荷してください。',
    scenePrompt:
      '月末の締めで倉庫は慌ただしい。出荷担当は優先度を入れ替えながらフォークリフトの動きを指示。取引先は発売に間に合わせたい事情があり、数量調整を相談している。',
    senderVoiceInstruction: '迅速で実務的、配慮を感じさせるはっきりした口調。',
    receiverVoiceInstruction: '前向きで協力的、ていねいに依頼を受け入れるトーン。',
    incorrectOptions: [
      '前倒しは不可で、数量の変更も受け付けられません。以上ですね',
      'ご注文は魔法で増やせるので、今から空に放り投げます。多分嘘です',
      '本日は混雑のため、通常順での出荷しか対応できませんですね。',
    ],
  },
  {
    place: '企業の会議室',
    senderRole: '部長',
    senderVoice: 'male',
    receiverRole: '課長',
    receiverVoice: 'female',
    englishSentence: 'Could you consolidate the feedback and circulate the summary before noon?',
    japaneseSentence: '午前中までにフィードバックをまとめて、要約を回覧してもらえますか？',
    englishReply: 'Absolutely. I’ll compile everything and share it by eleven.',
    japaneseReply: '承知しました。十一時までにまとめて共有します。',
    scenePrompt:
      '会議終了直後の会議室。部長が各部署の意見をまとめた報告書を昼までに共有するよう依頼している。課長はノートPCを開きながらメモを取っている。窓際にはコーヒーが冷めかけている。',
    senderVoiceInstruction: '落ち着いたが明確に指示を出すフォーマルな口調で。',
    receiverVoiceInstruction: 'きびきびとした応答で、即行動に移す姿勢を示す。',
    incorrectOptions: [
      '午後までに全員の意見を破棄して報告書を削除しておきます。',
      '内容は未確認のまま全社員に即時送信しますのでご安心を。',
      '明日の午後に共有しますので、今日は何もしませんね。',
    ],
  },
  {
    place: '空港の搭乗ゲート',
    senderRole: '地上係員',
    senderVoice: 'female',
    receiverRole: '乗客',
    receiverVoice: 'male',
    englishSentence: 'Due to a gate change, your flight will now depart from Gate 32B.',
    japaneseSentence: 'ゲート変更のため、便は32Bゲートから出発いたします。',
    englishReply: 'Got it. Thanks for the heads-up. Do I need to recheck in?',
    japaneseReply: '了解です。知らせてくれてありがとうございます。再チェックインは必要ですか？',
    scenePrompt:
      '空港の出発ロビー。搭乗口付近のアナウンスに合わせて、地上係員が個別に案内している。乗客はスーツケースを持ち、掲示板を見上げている。',
    senderVoiceInstruction: '丁寧かつ事務的に、落ち着いたトーンで案内を行う。',
    receiverVoiceInstruction: '礼儀正しく感謝を述べながらも確認する穏やかな口調で。',
    incorrectOptions: [
      '搭乗口はそのままなので走らずにゆっくり寝ていてください。',
      '便はキャンセルされ、代わりに徒歩で向かっていただきます。',
      '変更はありません。全ての便が同じゲートから出ます。',
    ],
  },
  {
    place: '企業の受付ロビー',
    senderRole: '受付担当',
    senderVoice: 'female',
    receiverRole: '来訪者',
    receiverVoice: 'male',
    englishSentence: 'Could you sign in here and wait until Ms. Rivera comes down to meet you?',
    japaneseSentence: 'こちらにご署名の上、リベラ様がお迎えに来るまでお待ちください。',
    englishReply: 'Of course. I’ll take a seat right over there.',
    japaneseReply: 'かしこまりました。あちらの席でお待ちします。',
    scenePrompt:
      '企業ビルの明るい受付。ガラスの扉越しに外の通りが見える。受付係が来客用タブレットを差し出し、来訪者は丁寧に頷いて署名をしている。',
    senderVoiceInstruction: '丁寧で親切な口調で、案内するように落ち着いて話す。',
    receiverVoiceInstruction: '穏やかに応じ、礼儀正しく受け答えする。',
    incorrectOptions: [
      'リベラ様は本日退社しましたので、屋上でお待ちください。',
      '署名の代わりにサインペンを食べていただけますか？',
      '署名不要です。そのまま執務室に突撃して構いません。',
    ],
  },
  {
    place: '社内会議',
    senderRole: 'プロジェクトマネージャー',
    senderVoice: 'male',
    receiverRole: 'チームメンバー',
    receiverVoice: 'female',
    englishSentence: 'If we streamline the approval process, we could cut turnaround time by half.',
    japaneseSentence: '承認プロセスを効率化すれば、対応時間を半減できるはずです。',
    englishReply: 'That makes sense. I’ll draft a simpler workflow for review.',
    japaneseReply: 'なるほどです。確認用に簡易なワークフロー案を作ってみます。',
    scenePrompt:
      '社内の打ち合わせ室。ホワイトボードには進行中の案件フロー図。マネージャーが改善案を提示し、メンバーがノートパソコンを操作しながら反応している。',
    senderVoiceInstruction: '分析的で落ち着いた口調。論理的に提案する。',
    receiverVoiceInstruction: '賛同を示し、前向きに行動を提案する明るい声で。',
    incorrectOptions: [
      '承認を複雑にして三倍の時間をかけましょう。',
      '効率化の代わりに全員で紙芝居をしましょう。',
      '現状維持で問題ないので、何も変えなくていいです。',
    ],
  },
  {
    place: '商談用の会議室',
    senderRole: '営業担当',
    senderVoice: 'female',
    receiverRole: 'クライアント',
    receiverVoice: 'male',
    englishSentence:
      'We can tailor the proposal to your budget if you could share your upper limit.',
    japaneseSentence: 'ご予算の上限をお知らせいただければ、提案を調整いたします。',
    englishReply: 'Sure, our ceiling is around thirty thousand dollars. Please work within that.',
    japaneseReply: 'わかりました。上限は三万ドルほどです。その範囲でお願いします。',
    scenePrompt:
      '会議室で営業担当がプレゼン資料を開きながら柔らかい口調で説明。クライアントは慎重に頷きながら予算について具体的な数字を提示している。',
    senderVoiceInstruction: '柔らかく誠実な営業トーンで、調整可能であることを示す。',
    receiverVoiceInstruction: '落ち着いて具体的に回答し、信頼感を持って話す。',
    incorrectOptions: [
      '上限は無限大です。宇宙までどうぞ。',
      '予算を超えてでも全力で破産しますので問題ありません。',
      '予算の話は後日で構いません。今日は世間話だけにしましょう。',
    ],
  },
  {
    place: '企業のオフィス廊下',
    senderRole: '人事担当',
    senderVoice: 'female',
    receiverRole: '社員',
    receiverVoice: 'male',
    englishSentence:
      'Just a heads-up, your performance review has been moved to next Wednesday afternoon.',
    japaneseSentence: 'お知らせですが、人事評価面談は来週の水曜午後に変更になりました。',
    englishReply: 'Thanks for letting me know. Should I prepare any documents?',
    japaneseReply: '教えてくださってありがとうございます。何か資料を用意すべきですか？',
    scenePrompt:
      'オフィスの廊下で、人事担当が通りがかりの社員に声をかけてスケジュール変更を伝えている。周囲にはコピー機の音が響く静かな午後。',
    senderVoiceInstruction: '事務的で落ち着いたトーンで、フレンドリーに伝える。',
    receiverVoiceInstruction: '礼儀正しく確認の意を込めて穏やかに返答する。',
    incorrectOptions: [
      '面談は本日10分後に変更されました。走ってください！',
      '面談は無期限延期です。永遠に準備しなくて大丈夫です。',
      '次回は先週に行われました。時間旅行が必要ですね。',
    ],
  },
  {
    place: 'レストランのキッチン',
    senderRole: '料理長',
    senderVoice: 'male',
    receiverRole: '副料理長',
    receiverVoice: 'female',
    englishSentence: 'We’re running low on basil—could you check if the delivery has arrived?',
    japaneseSentence: 'バジルの在庫が少ないので、納品が届いているか確認してもらえますか？',
    englishReply: 'On it. I’ll ask the delivery staff right away.',
    japaneseReply: '了解です。すぐに納品担当に確認します。',
    scenePrompt:
      'ディナー前の忙しいキッチン。料理長がハーブ棚を見てバジルが足りないことに気づき、副料理長に確認を頼む。周囲は調理音とスチームの匂いが立ちこめている。',
    senderVoiceInstruction: '少し急ぎの様子で実務的に指示を出す。',
    receiverVoiceInstruction: '即座に行動に移る意志を明るく示す。',
    incorrectOptions: [
      'バジルではなくパセリで全部代用しておきました！',
      '納品確認は来週に回します。気が向いたら。',
      'バジルは空から降ってくると思うので待ちましょう。',
    ],
  },
  {
    place: '企業の商談会議室',
    senderRole: '購買担当',
    senderVoice: 'female',
    receiverRole: '営業担当',
    receiverVoice: 'male',
    englishSentence: 'Before we move forward, could you clarify the warranty coverage?',
    japaneseSentence: '先に進む前に、保証の範囲を明確にしてもらえますか？',
    englishReply: 'Of course. It covers all manufacturing defects for two years.',
    japaneseReply: 'もちろんです。製造上の不具合は2年間保証されます。',
    scenePrompt:
      '明るい会議室。契約書のドラフトをテーブルに広げ、購買担当が確認事項を質問。営業担当がパンフレットを指しながら説明している。',
    senderVoiceInstruction: '落ち着いて、確認を求める丁寧なトーンで。',
    receiverVoiceInstruction: '誠実かつ安心感のある口調で説明する。',
    incorrectOptions: [
      '保証は一切ありませんが、気持ちはこもっています。',
      '保証は100年間有効で、月にも対応します。',
      '保証内容は非公開ですので想像でお願いします。',
    ],
  },
  {
    place: 'コワーキングスペースのラウンジ',
    senderRole: '起業家',
    senderVoice: 'male',
    receiverRole: '共同創業者',
    receiverVoice: 'female',
    englishSentence: 'Let’s touch base tomorrow to finalize the pitch deck revisions.',
    japaneseSentence: '明日打ち合わせをして、ピッチ資料の修正版を確定しましょう。',
    englishReply: 'Sounds good. I’ll review the slides tonight.',
    japaneseReply: 'いいですね。今夜スライドを確認しておきます。',
    scenePrompt:
      'ノートパソコンを開いてコーヒーを飲む二人。スタートアップのピッチ資料を修正しており、夕方の日差しが窓から差し込む。',
    senderVoiceInstruction: 'リラックスしつつ前向きなトーンで、軽やかに提案する。',
    receiverVoiceInstruction: '明るく即答し、行動意欲を見せる自然な口調で。',
    incorrectOptions: [
      '打ち合わせは100年後で構いません。急ぎませんから。',
      '資料は完成済みなので二度と触れません。',
      '明日の会議は資料なしで歌って乗り切りましょう。',
    ],
  },
  {
    place: '企業の倉庫オフィス',
    senderRole: '在庫管理担当',
    senderVoice: 'female',
    receiverRole: '配送チームリーダー',
    receiverVoice: 'male',
    englishSentence:
      'The shipment’s been held up at customs, so we might need to adjust the delivery schedule.',
    japaneseSentence:
      '出荷が税関で止まっているため、納品スケジュールを調整する必要がありそうです。',
    englishReply: 'Understood. I’ll notify the clients about the possible delay.',
    japaneseReply: '了解しました。納期遅延の可能性を取引先に伝えます。',
    scenePrompt:
      '在庫管理室。モニターには物流システムのトラッキング画面。担当者が画面を見つめながらリーダーに報告している。外ではフォークリフトの音が響く。',
    senderVoiceInstruction: '冷静で事務的に、状況を正確に報告する。',
    receiverVoiceInstruction: '責任感を持ち、冷静に次の対応を伝える落ち着いた口調で。',
    incorrectOptions: [
      '税関で止まってません。むしろ宇宙に届きました。',
      '遅延ではなく、未来に先行出荷しました。時間逆行です。',
      'スケジュール通りですが、納品先を忘れました。',
    ],
  },
  {
    place: '本社のプレゼン会場',
    senderRole: 'マーケティング部長',
    senderVoice: 'male',
    receiverRole: 'チームリーダー',
    receiverVoice: 'female',
    englishSentence:
      'Could you walk the executives through the campaign metrics during the presentation?',
    japaneseSentence: '発表の際に、経営陣へキャンペーン指標の説明をお願いできますか？',
    englishReply: 'Of course. I’ll prepare clear visuals to make it easy to follow.',
    japaneseReply: '承知しました。理解しやすい資料を準備します。',
    scenePrompt:
      '広い会議室。スクリーンにグラフが映り、部長が発表内容を確認している。チームリーダーはノートPCでスライドを最終調整している。',
    senderVoiceInstruction: 'フォーマルで落ち着いた口調、期待を込めて頼む。',
    receiverVoiceInstruction: '自信を持って応じ、誠実なトーンで答える。',
    incorrectOptions: [
      '発表中に寝てしまうと思うので説明はやめておきます。',
      '指標ではなくジョークを披露して盛り上げます。',
      '経営陣には数値は秘密にしておきましょう。',
    ],
  },
  {
    place: 'ホテルの宴会場',
    senderRole: 'イベントコーディネーター',
    senderVoice: 'female',
    receiverRole: '司会者',
    receiverVoice: 'male',
    englishSentence:
      'Just to confirm, could you announce the award winners right after the keynote speech?',
    japaneseSentence: '確認ですが、基調講演の直後に受賞者を発表していただけますか？',
    englishReply: 'Got it. I’ll cue the list as soon as the speech ends.',
    japaneseReply: '了解です。講演終了後すぐに受賞者を読み上げます。',
    scenePrompt:
      '華やかなホテルの宴会場。照明が柔らかく、音響チェックの最中。イベントコーディネーターが進行表を手にし、司会者とタイミングを確認している。',
    senderVoiceInstruction: '明るくプロフェッショナルな口調で、丁寧に確認する。',
    receiverVoiceInstruction: 'きびきびとした自信あるトーンで応答する。',
    incorrectOptions: [
      '受賞者は明日の朝に発表します。寝不足対策です。',
      '講演の前に発表してサプライズを台無しにします。',
      '受賞者を発表せずに全員で黙祷します。',
    ],
  },
  {
    place: 'メーカーの設計室',
    senderRole: '品質管理担当',
    senderVoice: 'male',
    receiverRole: '設計エンジニア',
    receiverVoice: 'female',
    englishSentence:
      'We’ve spotted a minor defect in the prototype. Could you take another look at the design file?',
    japaneseSentence: '試作品に小さな欠陥が見つかったので、設計データを再確認してもらえますか？',
    englishReply: 'Sure thing. I’ll check the dimensions and tolerance again.',
    japaneseReply: 'わかりました。寸法と許容差を再確認します。',
    scenePrompt:
      '設計図面が広がる静かな設計室。品質担当者が3Dモデルを指差しながら説明し、エンジニアがノートPCを操作して修正点を確認している。',
    senderVoiceInstruction: '冷静で分析的な口調。落ち着いて事実を伝える。',
    receiverVoiceInstruction: '集中して作業に向かう意思を示す、落ち着いたトーンで。',
    incorrectOptions: [
      '欠陥は気のせいです。問題は心の中にあります。',
      '確認は来世に回します。今日は終わりです。',
      '欠陥は放置してデザインを派手にします。',
    ],
  },
  {
    place: '商業ビルのエレベーターホール',
    senderRole: '清掃スタッフ',
    senderVoice: 'female',
    receiverRole: 'ビル管理者',
    receiverVoice: 'male',
    englishSentence: 'One of the elevators is acting up—it keeps stopping between floors.',
    japaneseSentence: 'エレベーターの一台が不調で、階の途中で止まることがあります。',
    englishReply: 'Thanks for catching that. I’ll call maintenance right away.',
    japaneseReply: '気づいてくれて助かります。すぐに保守業者へ連絡します。',
    scenePrompt:
      'ビルのエレベーターホール。清掃スタッフがモップを持ちながら管理者に報告している。廊下には警告ランプが点滅している。',
    senderVoiceInstruction: '落ち着いたが少し心配そうな声で報告する。',
    receiverVoiceInstruction: '冷静に感謝を伝え、行動を約束する誠実なトーンで。',
    incorrectOptions: [
      'エレベーターは踊りたがっているだけなので問題ありません。',
      '止まるのは仕様です。冒険気分を楽しんでください。',
      '動作に問題はなく、むしろ速すぎるくらいです。',
    ],
  },
  {
    place: 'IT企業のオンラインミーティング',
    senderRole: 'プロダクトマネージャー',
    senderVoice: 'male',
    receiverRole: 'デザイナー',
    receiverVoice: 'female',
    englishSentence: 'If we tweak the layout slightly, the user flow will feel much smoother.',
    japaneseSentence: 'レイアウトを少し調整すれば、ユーザー導線がより自然になります。',
    englishReply: 'I agree. I’ll adjust the spacing and margins tonight.',
    japaneseReply: '賛成です。今夜スペースと余白を調整します。',
    scenePrompt:
      'オンライン会議中。画面共有でUIデザインを確認しながら、改善案を話し合う二人。背後にはそれぞれ自宅オフィスの様子が見える。',
    senderVoiceInstruction: '柔らかく前向きなトーンで、提案を自然に伝える。',
    receiverVoiceInstruction: '明るく賛同し、行動を引き受ける声で答える。',
    incorrectOptions: [
      '調整せずに画面を上下逆にして個性を出しましょう。',
      '導線を消して迷子体験を提供しましょう。',
      '今のままで完璧です。むしろ触らないでおきましょう。',
    ],
  },
  {
    place: '大学の事務室',
    senderRole: '事務スタッフ',
    senderVoice: 'female',
    receiverRole: '学生',
    receiverVoice: 'male',
    englishSentence:
      'You’ll need to submit your transcript request by Friday to meet the application deadline.',
    japaneseSentence:
      '出願締切に間に合わせるためには、成績証明書の申請を金曜日までに提出してください。',
    englishReply: 'Thanks for the reminder. I’ll drop it off this afternoon.',
    japaneseReply: '教えてくださってありがとうございます。今日の午後に提出します。',
    scenePrompt:
      '大学の事務室で、窓口に学生が来て書類を確認している。事務スタッフがパソコンを操作しながら締切を伝え、学生は頷いてスケジュールを確認している。',
    senderVoiceInstruction: '穏やかで丁寧に案内する口調で話す。',
    receiverVoiceInstruction: '礼儀正しく安心したトーンで答える。',
    incorrectOptions: [
      '締切は昨日でしたが、気にせず出さなくて大丈夫です。',
      '金曜日ではなく、金星までに提出してください。',
      '申請は来年でも間に合うと思います。',
    ],
  },
  {
    place: '病院の受付カウンター',
    senderRole: '受付スタッフ',
    senderVoice: 'female',
    receiverRole: '患者',
    receiverVoice: 'male',
    englishSentence: 'Could you fill out this consent form before your examination?',
    japaneseSentence: '診察の前に、こちらの同意書にご記入をお願いいたします。',
    englishReply: 'Sure. Do you need both copies signed?',
    japaneseReply: 'わかりました。両方の用紙に署名が必要ですか？',
    scenePrompt:
      '病院の受付で、スタッフが書類を渡し、患者がボールペンを手に取る。周囲には待合室で静かに順番を待つ人々がいる。',
    senderVoiceInstruction: '丁寧で落ち着いたトーン、穏やかに案内する。',
    receiverVoiceInstruction: '控えめながらも確認するような落ち着いた口調で。',
    incorrectOptions: [
      '同意書は燃やしていただいて結構です。',
      '記入は必要ありません。占いで判断します。',
      '診察の後に同意を取り消せば問題ありません。',
    ],
  },
  {
    place: 'コールセンターのオフィス',
    senderRole: 'スーパーバイザー',
    senderVoice: 'male',
    receiverRole: '新人オペレーター',
    receiverVoice: 'female',
    englishSentence:
      'If a customer sounds frustrated, try acknowledging their concern before offering solutions.',
    japaneseSentence: 'お客様が苛立っているようなら、解決策を出す前にまず共感を示してください。',
    englishReply: 'Got it. I’ll make sure to do that during my next call.',
    japaneseReply: '了解しました。次の対応から意識してやってみます。',
    scenePrompt:
      'オフィス内のコールセンター。スーパーバイザーが新人の席に立ち、ヘッドセット越しに指導している。新人はメモを取りながら頷いている。',
    senderVoiceInstruction: '穏やかで教える姿勢を持つ落ち着いた声で。',
    receiverVoiceInstruction: '前向きで真剣に受け止める明るいトーンで。',
    incorrectOptions: [
      '苛立っていたら電話を切って休憩しましょう。',
      '共感の代わりに謎かけをして落ち着かせましょう。',
      '無視してスクリプトを早口で読み続けてください。',
    ],
  },
  {
    place: 'カフェカウンター',
    senderRole: '店員',
    senderVoice: 'female',
    receiverRole: '客',
    receiverVoice: 'male',
    englishSentence:
      'Your order will be ready in about five minutes. Would you like it for here or to go?',
    japaneseSentence:
      'ご注文は5分ほどでご用意できます。店内でお召し上がりですか？お持ち帰りですか？',
    englishReply: 'To go, please. I’m in a bit of a hurry.',
    japaneseReply: '持ち帰りでお願いします。少し急いでいるので。',
    scenePrompt:
      'カフェのカウンターで店員が笑顔でオーダーを確認している。客はスマートフォンを手にしながら財布を取り出している。',
    senderVoiceInstruction: '明るく親しみやすい口調で、丁寧に尋ねる。',
    receiverVoiceInstruction: '急いでいる様子を穏やかに表す自然なトーンで。',
    incorrectOptions: [
      'お持ち帰りではなく、永住でお願いします。',
      '5分では遅いので1秒でお願いします。',
      'ここで食べますが、席は空港でお願いします。',
    ],
  },
  {
    place: '出版社の編集部',
    senderRole: '編集長',
    senderVoice: 'male',
    receiverRole: 'ライター',
    receiverVoice: 'female',
    englishSentence: 'Your draft looks solid, but could you trim down the introduction a bit?',
    japaneseSentence: '原稿はよくできていますが、冒頭を少し短くしてもらえますか？',
    englishReply: 'Sure, I’ll tighten it up and send a revised version tonight.',
    japaneseReply: 'わかりました。簡潔にして今夜修正版をお送りします。',
    scenePrompt:
      '編集部のデスク周り。原稿のプリントが散らばり、編集長が赤ペンを持ちながらライターにアドバイスしている。窓の外には夕焼け。',
    senderVoiceInstruction: '冷静で穏やかに、肯定を含む丁寧な口調で話す。',
    receiverVoiceInstruction: '前向きで自信を持ちながら応じる声で。',
    incorrectOptions: [
      '冒頭を三倍に伸ばして圧倒させましょう。',
      '短くする代わりに詩を100行足します。',
      '冒頭は削除せず、終わりを消して完結させます。',
    ],
  },
  {
    place: '空港の搭乗ゲート',
    senderRole: '搭乗スタッフ',
    senderVoice: 'female',
    receiverRole: '乗客',
    receiverVoice: 'male',
    englishSentence:
      'Your flight’s been slightly delayed due to weather conditions. We expect boarding to start in thirty minutes.',
    japaneseSentence: '天候の影響でフライトが少し遅れています。搭乗は30分後に開始予定です。',
    englishReply: 'Thanks for the update. I’ll wait nearby.',
    japaneseReply: 'お知らせありがとうございます。近くで待機します。',
    scenePrompt:
      '空港の搭乗ゲート付近。大型モニターに遅延情報が表示され、スタッフがマイク越しに乗客へ案内している。周囲には待合客が静かに座っている。',
    senderVoiceInstruction: '落ち着いた丁寧なトーンで、安心感を与えるように話す。',
    receiverVoiceInstruction: '穏やかに理解を示す声で応答する。',
    incorrectOptions: [
      '遅延ではなく、飛行機が逆方向に飛んでいます。',
      '30分後ではなく、30年前に出発しました。',
      '天候は完璧ですが、気分で遅らせています。',
    ],
  },
  {
    place: '会社の受付ロビー',
    senderRole: '受付スタッフ',
    senderVoice: 'female',
    receiverRole: '訪問客',
    receiverVoice: 'male',
    englishSentence: 'Could you please sign in here before heading to the meeting room?',
    japaneseSentence: '会議室へお進みになる前に、こちらでご署名をお願いいたします。',
    englishReply: 'Of course. Do I need to show my ID as well?',
    japaneseReply: 'かしこまりました。身分証の提示も必要ですか？',
    scenePrompt:
      '企業の受付ロビー。来客用のサインインシートが置かれ、受付スタッフが微笑みながらペンを差し出している。',
    senderVoiceInstruction: '丁寧で親しみやすい声で案内する。',
    receiverVoiceInstruction: '礼儀正しく確認する柔らかなトーンで。',
    incorrectOptions: [
      '署名は後ほど夢の中で行います。',
      'ここではなく、屋上でサインしてください。',
      '署名せずに忍び足で通り抜けます。',
    ],
  },
  {
    place: 'IT企業のプロジェクト会議室',
    senderRole: 'プロジェクトマネージャー',
    senderVoice: 'male',
    receiverRole: 'デベロッパー',
    receiverVoice: 'female',
    englishSentence: 'Let’s circle back to the API issue after lunch and finalize the fix plan.',
    japaneseSentence: '昼食後にAPIの問題に戻って、修正計画を確定しましょう。',
    englishReply: 'Sounds good. I’ll prepare the updated logs by then.',
    japaneseReply: '了解です。その時間までに最新のログを用意しておきます。',
    scenePrompt:
      'モニターにコードのログが映る会議室。マネージャーが議事をまとめ、デベロッパーがノートPCを操作しながら頷いている。',
    senderVoiceInstruction: '実務的で落ち着いたトーン、前向きに提案する。',
    receiverVoiceInstruction: '明るく責任感のある声で返答する。',
    incorrectOptions: [
      'APIではなく、AIに祈りを捧げましょう。',
      '修正は来世で行う予定です。',
      '昼食後は昼寝なので作業は来週にします。',
    ],
  },
  {
    place: '病院の診察室',
    senderRole: '医師',
    senderVoice: 'male',
    receiverRole: '患者',
    receiverVoice: 'female',
    englishSentence:
      'Your test results look normal, but I’d still recommend a follow-up in a month.',
    japaneseSentence: '検査結果は正常ですが、念のため1か月後に再診をお勧めします。',
    englishReply: 'Thank you, doctor. I’ll make an appointment before I leave.',
    japaneseReply: 'ありがとうございます。帰る前に予約を取ります。',
    scenePrompt: '明るい診察室。医師がタブレットで検査結果を見せ、患者が安心した表情で聞いている。',
    senderVoiceInstruction: '穏やかで安心感を与えるトーンで説明する。',
    receiverVoiceInstruction: '感謝と安堵を込めて穏やかに答える。',
    incorrectOptions: [
      '結果は正常ですが、宇宙旅行を控えてください。',
      '再診は必要ありません。永遠に健康です。',
      '結果は正常なので祝勝パーティーを開きましょう。',
    ],
  },
  {
    place: 'ホテルのフロント',
    senderRole: 'フロントスタッフ',
    senderVoice: 'female',
    receiverRole: '宿泊客',
    receiverVoice: 'male',
    englishSentence: 'If you need a late check-out, please let us know by noon.',
    japaneseSentence: 'レイトチェックアウトをご希望の場合は、正午までにお知らせください。',
    englishReply: 'Got it. I might need an extra hour, so I’ll inform you later this morning.',
    japaneseReply: '承知しました。1時間延長するかもしれないので、午前中にお伝えします。',
    scenePrompt:
      'ホテルのフロントで、スタッフが笑顔で案内している。客はキャリーバッグを持ち、出発時間を検討している。',
    senderVoiceInstruction: '丁寧で柔らかな口調で案内する。',
    receiverVoiceInstruction: '落ち着いて検討する様子で、礼儀正しく返答する。',
    incorrectOptions: [
      'チェックアウトは正午どころか正月になります。',
      '延長ではなく、永住を希望します。',
      'レイトチェックアウトではなく早朝チェックインを希望します。',
    ],
  },
  {
    place: '空港の搭乗ゲート前',
    senderRole: '搭乗アナウンス係',
    senderVoice: 'female',
    receiverRole: '乗客',
    receiverVoice: 'male',
    englishSentence: 'Your flight has been pushed back again.',
    japaneseSentence: 'お客様の便は再び遅延となりました。',
    englishReply: 'Oh, not again. Do you know how long?',
    japaneseReply: 'またですか。どれくらいの遅れでしょうか？',
    scenePrompt:
      '搭乗ゲート前で待機中の乗客に、係員がフライトの再遅延を伝える場面。電光掲示板には変更表示が点滅している。',
    senderVoiceInstruction: '申し訳なさそうに、落ち着いたトーンで説明する。',
    receiverVoiceInstruction: '困惑しながらも冷静に尋ねる口調で。',
    incorrectOptions: [
      '出発時刻が予定より早まりました。', // 逆の意味
      'ドラゴンが滑走路を占領してしまいました。', // 馬鹿馬鹿しい
      '定刻どおりの運航となっています。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'オフィスの会議室',
    senderRole: '上司',
    senderVoice: 'male',
    receiverRole: '部下',
    receiverVoice: 'female',
    englishSentence: "Let's circle back on this tomorrow morning.",
    japaneseSentence: 'この件は明日の朝に再確認しましょう。',
    englishReply: 'Got it. I’ll prepare the updates by then.',
    japaneseReply: '了解です。それまでに更新しておきます。',
    scenePrompt: '会議の終盤、議論を一時保留して翌日のフォローアップを提案する上司。',
    senderVoiceInstruction: '落ち着いて締めくくるように、やや疲れた声で。',
    receiverVoiceInstruction: '前向きに引き取る柔らかいトーンで。',
    incorrectOptions: [
      '今日中に結論を出してしまいましょう。', // 逆の意味
      'イルカ会議で検討してもらいましょう。', // 馬鹿馬鹿しい
      '午後に改めて確認してもよいですか。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'ホテルのフロントデスク',
    senderRole: 'フロントスタッフ',
    senderVoice: 'female',
    receiverRole: '宿泊客',
    receiverVoice: 'male',
    englishSentence: 'Could I offer you a late checkout today?',
    japaneseSentence: '本日レイトチェックアウトをご案内してもよろしいでしょうか？',
    englishReply: 'That would be perfect. Thank you so much.',
    japaneseReply: '助かります。ありがとうございます。',
    scenePrompt: '宿泊客がチェックアウト手続きに訪れた際、スタッフが柔軟な提案をする場面。',
    senderVoiceInstruction: '丁寧で柔らかい口調で親切に提案する。',
    receiverVoiceInstruction: '安堵して感謝する落ち着いたトーンで。',
    incorrectOptions: [
      '早朝チェックアウトしか対応できません。', // 逆の意味
      'ワームホール経由でお帰りいただけます。', // 馬鹿馬鹿しい
      '通常の時間でのチェックアウトも可能です。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'カフェのカウンター',
    senderRole: '店員',
    senderVoice: 'male',
    receiverRole: '客',
    receiverVoice: 'female',
    englishSentence: 'Your drink will be out in a jiffy.',
    japaneseSentence: 'お飲み物はすぐにお出ししますね。',
    englishReply: 'No rush, take your time.',
    japaneseReply: '急がなくて大丈夫です、ゆっくりで。',
    scenePrompt: 'カフェで注文後、手際よく準備しているスタッフが客に軽く声をかける。',
    senderVoiceInstruction: '明るく親しみやすく、軽い調子で。',
    receiverVoiceInstruction: '穏やかで丁寧に返す口調で。',
    incorrectOptions: [
      '明日お渡しする予定です。', // 逆の意味
      '空を飛んでお届けしますね。', // 馬鹿馬鹿しい
      '少々お時間をいただきますね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '会社の休憩室',
    senderRole: '同僚',
    senderVoice: 'female',
    receiverRole: '同僚',
    receiverVoice: 'male',
    englishSentence: 'I’m feeling a bit under the weather today.',
    japaneseSentence: '今日はちょっと体調が優れないんです。',
    englishReply: 'Oh no, take it easy and rest up.',
    japaneseReply: 'そうでしたか、無理せず休んでくださいね。',
    scenePrompt: '休憩中、少し疲れた様子の社員が同僚に体調不良を打ち明ける。',
    senderVoiceInstruction: '弱々しく、それでも明るさを残した口調で。',
    receiverVoiceInstruction: '優しく気遣う穏やかな声で。',
    incorrectOptions: [
      '今日はものすごく元気いっぱいです。', // 逆の意味
      '今日は月まで出勤してきました。', // 馬鹿馬鹿しい
      '今日は少し眠気がありますね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '職場のデスク',
    senderRole: '同僚',
    senderVoice: 'male',
    receiverRole: '同僚',
    receiverVoice: 'female',
    englishSentence: 'Let’s play it by ear tomorrow.',
    japaneseSentence: '明日は様子を見て臨機応変に対応しましょう。',
    englishReply: 'Sounds good. I’ll stay flexible.',
    japaneseReply: 'いいですね。柔軟に動けるようにします。',
    scenePrompt:
      '翌日の業務計画を立てながら、天候や状況次第で対応を決めようと話しているオフィスの昼休み。',
    senderVoiceInstruction: '軽い雑談のように、前向きで柔らかなトーンで。',
    receiverVoiceInstruction: '同意しながら穏やかに答える口調で。',
    incorrectOptions: [
      '明日は厳格にスケジュール通りに進めましょう。', // 逆の意味
      'ペンギンの行動に合わせて対応しましょう。', // 馬鹿馬鹿しい
      '予定通り進めつつ臨機応変に考えましょう。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'スーパーのレジ前',
    senderRole: '店員',
    senderVoice: 'female',
    receiverRole: '客',
    receiverVoice: 'male',
    englishSentence: 'Would you like to go paperless today?',
    japaneseSentence: '本日レシートを電子化にしますか？',
    englishReply: 'Yes, please. Save the paper.',
    japaneseReply: 'お願いします。紙は節約したいです。',
    scenePrompt:
      '支払い時に環境配慮型の電子レシートを勧めるレジスタッフ。買い物客はマイバッグを持っている。',
    senderVoiceInstruction: '丁寧で明るく提案する声で。',
    receiverVoiceInstruction: '感じよく同意する穏やかな口調で。',
    incorrectOptions: [
      '本日は必ず紙のレシートが必要です。', // 逆の意味
      '今日は木の葉でレシートを印刷します。', // 馬鹿馬鹿しい
      '希望されるなら紙のレシートも出せます。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'カスタマーサポートの電話',
    senderRole: 'オペレーター',
    senderVoice: 'female',
    receiverRole: '顧客',
    receiverVoice: 'male',
    englishSentence: 'May I put you on hold for a moment?',
    japaneseSentence: '少々お待ちいただけますか？',
    englishReply: 'Sure, take your time.',
    japaneseReply: 'どうぞ、ごゆっくり。',
    scenePrompt:
      '問い合わせの途中で別の部署に確認が必要になり、保留にする許可を取る電話オペレーター。',
    senderVoiceInstruction: '柔らかく丁寧に申し出る声で。',
    receiverVoiceInstruction: '落ち着いて承諾する優しい口調で。',
    incorrectOptions: [
      'すぐにお切りしてもよろしいですか？', // 逆の意味
      '少々お歌いいただけますか？', // 馬鹿馬鹿しい
      '確認の間、しばらくお待ちください。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '会社のエレベーター前',
    senderRole: '同僚',
    senderVoice: 'male',
    receiverRole: '上司',
    receiverVoice: 'female',
    englishSentence: 'I’ll keep you in the loop on this.',
    japaneseSentence: 'この件の進捗は随時共有しますね。',
    englishReply: 'Thanks, I appreciate that.',
    japaneseReply: 'ありがとう、助かります。',
    scenePrompt:
      'オフィスで上司とすれ違いざまに、新しいプロジェクトの報告タイミングを伝えるシーン。',
    senderVoiceInstruction: 'ていねいで誠実なトーンで短く伝える。',
    receiverVoiceInstruction: '信頼感をもって穏やかに感謝を述べる。',
    incorrectOptions: [
      'この件の進捗はすべて非公開にしますね。', // 逆の意味
      'この件の進捗はハトに伝えておきますね。', // 馬鹿馬鹿しい
      'この件の報告は明日まとめて送りますね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'カフェのテラス席',
    senderRole: '友人',
    senderVoice: 'female',
    receiverRole: '友人',
    receiverVoice: 'male',
    englishSentence: 'You really hit the nail on the head.',
    japaneseSentence: 'まさにその通りだね。',
    englishReply: 'Glad we’re on the same page.',
    japaneseReply: '意見が合ってうれしいよ。',
    scenePrompt: '友人同士がカフェで話し合い、相手の指摘が的を射ていたことを称賛する瞬間。',
    senderVoiceInstruction: '感心したように明るく賛同する声で。',
    receiverVoiceInstruction: 'うれしそうに穏やかに返す口調で。',
    incorrectOptions: [
      '全然違う方向を指しているね。', // 逆の意味
      'ハンマーでテーブルを叩いちゃったね。', // 馬鹿馬鹿しい
      'その意見は少し惜しいかもしれないね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '本社オフィスのワークスペース',
    senderRole: 'プロジェクトマネージャー',
    senderVoice: 'female',
    receiverRole: 'アシスタント',
    receiverVoice: 'male',
    englishSentence: 'Could you follow up with her by noon?',
    japaneseSentence: '彼女へのフォローを正午までにお願いできますか？',
    englishReply: 'Sure. I’ll call her and send a note.',
    japaneseReply: 'わかりました。連絡してメモも送ります。',
    scenePrompt:
      '午前の進捗確認。クライアント担当者へ確認事項が残っており、PMが期限を切ってフォロー依頼をしている。デスクにはタスク管理ボードとラップトップ。',
    senderVoiceInstruction: '端的でていねい、時間を意識させる落ち着いた口調で。',
    receiverVoiceInstruction: '即応の意思を示すはっきりした声で、前向きに。',
    incorrectOptions: [
      '明日に延ばしてください。', // 逆の意味寄り
      '宇宙評議会に回します。', // 馬鹿馬鹿しい
      'すぐ完了扱いにしてください。', // もっともらしい誤答
    ],
  },
  {
    place: 'ビジネスホテルのフロント',
    senderRole: 'フロントスタッフ',
    senderVoice: 'male',
    receiverRole: '宿泊客',
    receiverVoice: 'female',
    englishSentence: 'Breakfast is complimentary for premier members today.',
    japaneseSentence: '本日はプレミア会員のお客様は朝食が無料です。',
    englishReply: 'Great, I’ll have it before checkout.',
    japaneseReply: '助かります。チェックアウト前にいただきます。',
    scenePrompt:
      '朝のフロント。会員種別を確認しながら、スタッフが特典を案内。ロビーには軽食コーナーと観葉植物。',
    senderVoiceInstruction: '親切で落ち着いた丁寧語、案内口調で。',
    receiverVoiceInstruction: '礼儀正しく喜びを含む柔らかなトーンで。',
    incorrectOptions: [
      '有料での提供のみとなります。', // 逆の意味
      '恐竜用の朝食も無料です。', // 馬鹿馬鹿しい
      '対象外ですが割引は適用されます。', // もっともらしい誤答
    ],
  },
  {
    place: '社内会議室',
    senderRole: 'チームリード',
    senderVoice: 'female',
    receiverRole: '開発メンバー',
    receiverVoice: 'male',
    englishSentence: 'Let’s table this and revisit after the demo.',
    japaneseSentence: 'この件はいったん保留にして、デモ後に再検討しましょう。',
    englishReply: 'Understood. I’ll park the item for now.',
    japaneseReply: '承知しました。ひとまずこの議題は置いておきます。',
    scenePrompt:
      'スプリントレビュー前の短時間ミーティング。時間が押しており、議題の棚上げを提案する場面。ホワイトボードにタイムライン。',
    senderVoiceInstruction: '時間管理を意識した冷静なトーンで簡潔に。',
    receiverVoiceInstruction: '落ち着いて納得し、端的に受ける口調で。',
    incorrectOptions: [
      '今すぐ最優先で決め切りましょう。', // 逆の意味
      '議題は風船にして飛ばしましょう。', // 馬鹿馬鹿しい
      '資料が出そろってから再開します。', // もっともらしい誤答
    ],
  },
  {
    place: 'オフィスのスタンドアップミーティング',
    senderRole: 'プロダクトマネージャー',
    senderVoice: 'male',
    receiverRole: 'デザイナー',
    receiverVoice: 'female',
    englishSentence: 'We’re running up against the deadline.',
    japaneseSentence: '締切が目前まで迫ってきています。',
    englishReply: 'I see. I’ll prioritize the key screens.',
    japaneseReply: '了解です。重要な画面を優先します。',
    scenePrompt:
      '朝の立ち会議。バーンダウンが遅れており、PMが緊迫感を共有。壁には進捗ボード、時計は9時少し前。',
    senderVoiceInstruction: '焦りは抑えつつ引き締める落ち着いた声で。',
    receiverVoiceInstruction: '前向きで頼れるトーン、即応を示す。',
    incorrectOptions: [
      '締切は無期限に延長されました。', // 逆の意味
      '締切は月面時間で動きます。', // 馬鹿馬鹿しい
      '締切より後ろに作業を回します。', // もっともらしい誤答
    ],
  },
  {
    place: '社内チャット／打合せスペース',
    senderRole: 'プロジェクトコーディネーター',
    senderVoice: 'female',
    receiverRole: 'エンジニア',
    receiverVoice: 'male',
    englishSentence: 'Could you loop James in on that thread?',
    japaneseSentence: 'そのスレッドにジェームズを参加させてもらえますか？',
    englishReply: 'Sure. I’ll add him to the conversation.',
    japaneseReply: '了解です。会話に追加しておきます。',
    scenePrompt:
      '要件整理中のチャンネル。関係者を巻き込む必要があり、コーディネーターが追加依頼。PC画面にはチャットUI。',
    senderVoiceInstruction: '柔らかく実務的、抜け漏れを防ぐ調子で。',
    receiverVoiceInstruction: '手際の良さが伝わる落ち着いた承諾の声で。',
    incorrectOptions: [
      '彼は外しておきましょう。', // 逆の意味
      '彼はテレパシーで参加します。', // 馬鹿馬鹿しい
      '後で要点だけ私から伝えます。', // もっともらしい誤答
    ],
  },
  {
    place: 'オフィスの会議室',
    senderRole: 'チームリーダー',
    senderVoice: 'female',
    receiverRole: 'メンバー',
    receiverVoice: 'male',
    englishSentence: 'Could you clarify your last point?',
    japaneseSentence: '最後の発言をもう少し説明してもらえますか？',
    englishReply: 'Sure, I meant the budget part.',
    japaneseReply: 'はい、予算の部分のことです。',
    scenePrompt:
      '週次ミーティング中。リーダーがメンバーの発言意図を確認している。会議テーブルに資料が広がっている。',
    senderVoiceInstruction: '落ち着いて、丁寧に質問するトーンで。',
    receiverVoiceInstruction: '冷静に補足説明をする穏やかな声で。',
    incorrectOptions: [
      '前の説明を省略してもらえますか？', // 逆の意味
      '火星語で説明してもらえますか？', // 馬鹿馬鹿しい
      '要点をもう少し短くまとめてもらえますか？', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'カフェの一角',
    senderRole: '友人',
    senderVoice: 'male',
    receiverRole: '友人',
    receiverVoice: 'female',
    englishSentence: 'I really appreciate your help yesterday.',
    japaneseSentence: '昨日は本当に助かりました。ありがとう。',
    englishReply: 'Anytime. I’m glad it worked out.',
    japaneseReply: 'いつでも。うまくいってよかったよ。',
    scenePrompt: '友人がプレゼン準備を手伝ってもらった翌日。コーヒー片手に感謝を伝える場面。',
    senderVoiceInstruction: '素直な感謝の気持ちを込めて。',
    receiverVoiceInstruction: '軽く笑顔を含んだ親しみあるトーンで。',
    incorrectOptions: [
      '昨日は全然うまくいきませんでした。', // 逆の意味
      'タイムマシンで助けに行きました。', // 馬鹿馬鹿しい
      '前日に相談してくれて助かりました。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '社内メールの打合せスペース',
    senderRole: '上司',
    senderVoice: 'female',
    receiverRole: '部下',
    receiverVoice: 'male',
    englishSentence: 'Please submit the report by 5 p.m.',
    japaneseSentence: '午後5時までにレポートを提出してください。',
    englishReply: 'Understood. I’ll finish it right after lunch.',
    japaneseReply: '承知しました。昼食後に仕上げます。',
    scenePrompt: '月次報告の締め切り前。上司がスケジュールを再確認する。',
    senderVoiceInstruction: '事務的だが丁寧に、明確に伝える口調で。',
    receiverVoiceInstruction: '真面目で誠実に答えるトーンで。',
    incorrectOptions: [
      '夜までに送れば大丈夫です。', // 逆の意味
      'レポートをハトに運ばせましょう。', // 馬鹿馬鹿しい
      '午前中にドラフト版を送ります。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '商談の会議室',
    senderRole: '営業担当',
    senderVoice: 'male',
    receiverRole: '顧客',
    receiverVoice: 'female',
    englishSentence: 'We can accommodate small changes if needed.',
    japaneseSentence: '必要であれば小さな変更には対応できます。',
    englishReply: 'That’s good to know. I’ll check with my team.',
    japaneseReply: 'それは助かります。チームと確認しますね。',
    scenePrompt: '新しい契約内容をすり合わせ中。柔軟な対応を示す営業担当。',
    senderVoiceInstruction: '落ち着いて信頼感を与える柔らかい口調で。',
    receiverVoiceInstruction: '安心した様子で丁寧に応答する声で。',
    incorrectOptions: [
      'こちらでは一切の変更を受け付けません。', // 逆の意味
      'ユニコーンの承認があれば変更可能です。', // 馬鹿馬鹿しい
      '仕様書を確認のうえ検討させていただきます。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '会議後のオフィス通路',
    senderRole: '同僚',
    senderVoice: 'female',
    receiverRole: '同僚',
    receiverVoice: 'male',
    englishSentence: 'Let’s postpone the review until next week.',
    japaneseSentence: 'レビューは来週まで延期しましょう。',
    englishReply: 'Good idea. We need more data anyway.',
    japaneseReply: 'いい考えですね。どうせデータも足りませんし。',
    scenePrompt: '今週中のレビュー予定を、都合により翌週にずらす話をしている同僚たち。',
    senderVoiceInstruction: '軽く提案する調子でフレンドリーに。',
    receiverVoiceInstruction: '納得しながら冗談めかして返すトーンで。',
    incorrectOptions: [
      '今すぐレビューを実施しましょう。', // 逆の意味
      '永遠にレビューを延期しましょう。', // 馬鹿馬鹿しい
      '金曜日に再調整するのがよさそうですね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'オフィスの受付エリア',
    senderRole: '受付担当',
    senderVoice: 'female',
    receiverRole: '来訪者',
    receiverVoice: 'male',
    englishSentence: 'Could you please sign in at the front desk?',
    japaneseSentence: '受付でご署名をお願いいたします。',
    englishReply: 'Of course, here’s my ID as well.',
    japaneseReply: 'もちろんです。身分証もあります。',
    scenePrompt: '来客がビルに到着。受付スタッフが入館記録の署名を丁寧に案内する。',
    senderVoiceInstruction: '明るく丁寧に案内する声で。',
    receiverVoiceInstruction: '礼儀正しく落ち着いたトーンで返答する。',
    incorrectOptions: [
      '入館記録は不要ですのでお帰りください。', // 逆の意味
      'サインは透明インクでお願いします。', // 馬鹿馬鹿しい
      '受付票にお名前を書いてください。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '会議室のドア前',
    senderRole: 'マネージャー',
    senderVoice: 'male',
    receiverRole: '同僚',
    receiverVoice: 'female',
    englishSentence: 'Let’s delegate this task to the new intern.',
    japaneseSentence: 'このタスクは新しいインターンに任せましょう。',
    englishReply: 'Sounds good. She could use the experience.',
    japaneseReply: 'いいですね。良い経験になると思います。',
    scenePrompt:
      '進行中のプロジェクトで細かい仕事を分担。新メンバーを育てる目的で割り当てを決める場面。',
    senderVoiceInstruction: '穏やかに、提案するような声で。',
    receiverVoiceInstruction: '同意しながら肯定的に答えるトーンで。',
    incorrectOptions: [
      'このタスクは私が直接やります。', // 逆の意味
      'このタスクはタコに任せましょう。', // 馬鹿馬鹿しい
      'このタスクは別のチームに依頼しましょう。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'カスタマーサポートセンター',
    senderRole: 'オペレーター',
    senderVoice: 'female',
    receiverRole: '顧客',
    receiverVoice: 'male',
    englishSentence: 'I apologize for the inconvenience caused.',
    japaneseSentence: 'ご不便をおかけして申し訳ございません。',
    englishReply: 'No worries, thanks for resolving it quickly.',
    japaneseReply: '大丈夫です。すぐ対応してくれてありがとうございます。',
    scenePrompt: '電話サポート中。顧客の不具合対応が完了した直後に、担当者がお詫びを述べる。',
    senderVoiceInstruction: '誠実で落ち着いたトーンで丁寧に謝る。',
    receiverVoiceInstruction: 'やわらかく安心した様子で返す声で。',
    incorrectOptions: [
      'ご不便をおかけして光栄です。', // 逆の意味
      'ご不便をおかけして宇宙まで謝罪しました。', // 馬鹿馬鹿しい
      '対応が遅れて申し訳ありませんでした。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '営業部のデスク',
    senderRole: '上司',
    senderVoice: 'male',
    receiverRole: '部下',
    receiverVoice: 'female',
    englishSentence: 'Please confirm the client’s order details.',
    japaneseSentence: '顧客の注文内容を確認してください。',
    englishReply: 'Will do. I’ll double-check the quantities.',
    japaneseReply: '了解です。数量を再確認します。',
    scenePrompt: '出荷前の最終確認。上司がミス防止のため注文詳細を見直すよう指示する。',
    senderVoiceInstruction: 'きっぱりと明確に伝える落ち着いた声で。',
    receiverVoiceInstruction: '前向きで責任感あるトーンで。',
    incorrectOptions: [
      '顧客の注文は確認せずに送ってください。', // 逆の意味
      '顧客の注文は夢の中で確認してください。', // 馬鹿馬鹿しい
      '顧客情報をシステムで再度照合します。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '社内のブレインストーミング会議',
    senderRole: 'プロジェクトマネージャー',
    senderVoice: 'female',
    receiverRole: 'エンジニア',
    receiverVoice: 'male',
    englishSentence: 'Let’s figure out a better way to track progress.',
    japaneseSentence: '進捗を管理するより良い方法を考えましょう。',
    englishReply: 'I agree. Maybe a shared dashboard would help.',
    japaneseReply: '賛成です。共有ダッシュボードが役立ちそうですね。',
    scenePrompt: '週次のチーム会議で、進捗管理ツールの改善を検討している。',
    senderVoiceInstruction: '前向きで建設的なトーンで提案する。',
    receiverVoiceInstruction: '即興的にアイデアを出す柔らかい声で。',
    incorrectOptions: [
      '進捗は考えずに感覚で進めましょう。', // 逆の意味
      '進捗は占いで決めましょう。', // 馬鹿馬鹿しい
      '進捗を紙ベースで整理するのもありですね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'オフィスの会議室',
    senderRole: '部長',
    senderVoice: 'male',
    receiverRole: '社員',
    receiverVoice: 'female',
    englishSentence: 'Could you verify the figures once more?',
    japaneseSentence: 'もう一度数字を確認してもらえますか？',
    englishReply: 'Sure, I’ll cross-check them right away.',
    japaneseReply: 'もちろんです。すぐに確認します。',
    scenePrompt: '月次報告前の最終チェック。部長が報告書の数値確認を依頼している。',
    senderVoiceInstruction: '落ち着いたが少し急いでいるようなトーンで。',
    receiverVoiceInstruction: '誠実に対応する真面目な口調で。',
    incorrectOptions: [
      '報告書の数字はそのままで結構です。', // 逆の意味
      '宇宙の法則に基づいて確認します。', // 馬鹿馬鹿しい
      '合計値だけを再計算しておきます。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'レストランのテーブル席',
    senderRole: 'ウェイター',
    senderVoice: 'male',
    receiverRole: '客',
    receiverVoice: 'female',
    englishSentence: 'May I recommend today’s special to you?',
    japaneseSentence: '本日のおすすめをお勧めしてもよろしいでしょうか？',
    englishReply: 'Yes, please. What do you have today?',
    japaneseReply: 'お願いします。今日は何がありますか？',
    scenePrompt: 'ランチタイムのレストラン。店員が笑顔で日替わりメニューを紹介しようとしている。',
    senderVoiceInstruction: '親しみを込めて丁寧に勧めるトーンで。',
    receiverVoiceInstruction: '少し興味を持った明るい声で。',
    incorrectOptions: [
      'おすすめは一切ありません。', // 逆の意味
      '今日のおすすめは空気のスープです。', // 馬鹿馬鹿しい
      'デザートのおすすめを先に聞いてもよろしいですか？', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'オンライン会議中',
    senderRole: 'プロジェクトマネージャー',
    senderVoice: 'female',
    receiverRole: 'エンジニア',
    receiverVoice: 'male',
    englishSentence: 'Let’s consolidate all feedback by Friday.',
    japaneseSentence: '金曜日までに全てのフィードバックをまとめましょう。',
    englishReply: 'Got it. I’ll start compiling them today.',
    japaneseReply: '了解です。今日からまとめ始めます。',
    scenePrompt:
      'プロジェクト進行中の週次ミーティング。提出物に対する意見を整理する計画を立てている。',
    senderVoiceInstruction: '前向きでリーダーシップを感じる明るい声で。',
    receiverVoiceInstruction: '即座に対応する意欲的なトーンで。',
    incorrectOptions: [
      '全てのフィードバックを削除しましょう。', // 逆の意味
      '全てのフィードバックを詩にして提出しましょう。', // 馬鹿馬鹿しい
      '一部のコメントだけを先にまとめておきます。', // 惜しくも自然な誤答
    ],
  },
  {
    place: '社内カフェスペース',
    senderRole: '同僚',
    senderVoice: 'male',
    receiverRole: '同僚',
    receiverVoice: 'female',
    englishSentence: 'You should take a short break.',
    japaneseSentence: '少し休憩したほうがいいですよ。',
    englishReply: 'Yeah, I’ve been staring at this screen too long.',
    japaneseReply: 'そうですね、画面を見すぎて目が疲れました。',
    scenePrompt: '集中して作業している同僚に、軽く休憩を勧める雑談シーン。',
    senderVoiceInstruction: '気軽で優しい口調で。',
    receiverVoiceInstruction: '疲れをにじませつつ同意するトーンで。',
    incorrectOptions: [
      '少しも休憩しないほうがいいですよ。', // 逆の意味
      '少しだけ月に行ってきたほうがいいですよ。', // 馬鹿馬鹿しい
      '今の作業が落ち着いたら休憩しますね。', // 惜しくも自然な誤答
    ],
  },
  {
    place: 'クライアントとの電話会議',
    senderRole: '営業担当',
    senderVoice: 'female',
    receiverRole: '顧客',
    receiverVoice: 'male',
    englishSentence: 'We should confirm the timeline before proceeding.',
    japaneseSentence: '進める前にスケジュールを確認すべきですね。',
    englishReply: 'Absolutely. Let me check with our design team.',
    japaneseReply: 'その通りです。デザインチームに確認します。',
    scenePrompt: '次フェーズへの移行前に、納期と工程を整理している会議。',
    senderVoiceInstruction: '冷静でプロフェッショナルなトーンで。',
    receiverVoiceInstruction: '真剣に同意する落ち着いた声で。',
    incorrectOptions: [
      'スケジュールは確認せず進めましょう。', // 逆の意味
      'スケジュールは占い師に聞いてみましょう。', // 馬鹿馬鹿しい
      'スケジュールを共有してから進めましょう。', // 惜しくも自然な誤答
    ],
  },
];

export default problemData;
