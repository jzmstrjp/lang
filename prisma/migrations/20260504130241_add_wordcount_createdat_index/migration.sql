-- CreateIndex
CREATE INDEX "idx_problems_audio_wordcount_createdat_desc" ON "problems"("audioReady", "wordCount", "createdAt" DESC);
