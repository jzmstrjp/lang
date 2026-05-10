-- DropIndex
DROP INDEX "idx_problems_audio_difficulty_expression";

-- CreateIndex
CREATE INDEX "idx_problems_audio_wordcount_difficulty_expression" ON "problems"("audioReady", "wordCount", "difficultyLevel", "expression");
