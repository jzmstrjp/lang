/*
  Warnings:

  - A unique constraint covering the columns `[englishSentence]` on the table `problems` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "problems_englishSentence_japaneseReply_key";

-- CreateIndex
CREATE UNIQUE INDEX "problems_englishSentence_key" ON "problems"("englishSentence");
