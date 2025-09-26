-- CreateIndex
CREATE INDEX "idx_problems_wordcount_audio_notnull" ON "problems"("wordCount", "audioEnUrl", "audioJaUrl", "audioEnReplyUrl");
