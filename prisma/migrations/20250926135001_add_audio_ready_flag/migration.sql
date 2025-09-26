-- DropIndex
DROP INDEX "idx_problems_wordcount_audio_notnull";

-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "audioReady" BOOLEAN NOT NULL DEFAULT false;

-- Backfill audioReady for existing records where all required audio assets are present.
UPDATE "problems"
SET "audioReady" = CASE
  WHEN "audioEnUrl" IS NOT NULL
    AND "audioJaUrl" IS NOT NULL
    AND ("audioEnReplyUrl" IS NOT NULL OR "englishReply" = '')
  THEN true
  ELSE false
END;

-- CreateIndex
CREATE INDEX "idx_problems_audio_ready_wordcount" ON "problems"("audioReady", "wordCount");
