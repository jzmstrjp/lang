-- CreateIndex
CREATE INDEX "idx_problems_audio_wordcount_difficulty" ON "problems"("audioReady", "wordCount", "difficultyLevel");
