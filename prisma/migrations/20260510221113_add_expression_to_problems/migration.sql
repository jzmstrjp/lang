-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "expression" TEXT;

-- CreateIndex
CREATE INDEX "idx_problems_audio_ready_expression" ON "problems"("audioReady", "expression");
