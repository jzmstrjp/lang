-- CreateEnum
CREATE TYPE "VoiceType" AS ENUM ('male', 'female');

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "wordCount" INTEGER NOT NULL,
    "englishSentence" TEXT NOT NULL,
    "japaneseSentence" TEXT NOT NULL,
    "japaneseReply" TEXT NOT NULL,
    "incorrectOptions" JSONB NOT NULL,
    "audioEnUrl" TEXT,
    "audioJaUrl" TEXT,
    "imageUrl" TEXT,
    "senderVoice" "VoiceType" NOT NULL,
    "senderRole" TEXT NOT NULL,
    "receiverVoice" "VoiceType" NOT NULL,
    "receiverRole" TEXT NOT NULL,
    "place" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

