-- CreateTable
CREATE TABLE "english_sentence_quality_logs" (
    "id" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "wordCountLength" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "englishSentence" TEXT NOT NULL,
    "isOk" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "correctSentenceDraft" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "english_sentence_quality_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "english_sentence_quality_logs_expression_idx" ON "english_sentence_quality_logs"("expression");

-- CreateIndex
CREATE INDEX "english_sentence_quality_logs_isOk_idx" ON "english_sentence_quality_logs"("isOk");
