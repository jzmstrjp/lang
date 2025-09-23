# 新スキーマ

id String @id @default(cuid())
lengthType ProblemType
englishSentence String
japaneseSentence String
japaneseReply String
incorrectOptions Json
audioEnUrl String?
audioJaUrl String?
imageUrl String?
senderVoice String # 声色に関する情報（男性、とか）
senderRole String # 親、客、医者、とか
receiverVoice String # 声色に関する情報（男性、とか）
receiverRole String # 親、客、医者、とか
place String
createdAt DateTime
updatedAt DateTime

# 仕様
