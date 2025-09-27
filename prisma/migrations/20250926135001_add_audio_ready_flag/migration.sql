-- DropIndex
DROP INDEX "idx_problems_wordcount_audio_notnull";

-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "audioReady" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "idx_problems_audio_ready_wordcount" ON "problems"("audioReady", "wordCount");
