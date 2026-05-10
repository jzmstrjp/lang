-- CreateIndex
CREATE INDEX "idx_problems_audio_difficulty_expression" ON "problems"("audioReady", "difficultyLevel", "expression");
