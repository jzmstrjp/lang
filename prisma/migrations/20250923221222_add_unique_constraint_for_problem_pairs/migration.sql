/*
  Warnings:

  - A unique constraint covering the columns `[englishSentence,japaneseReply]` on the table `problems` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "problems_englishSentence_japaneseReply_key" ON "problems"("englishSentence", "japaneseReply");
