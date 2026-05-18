/*
  Warnings:

  - A unique constraint covering the columns `[expression,expressionJa,isKids]` on the table `words` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[expression,expressionJa,targetLength]` on the table `words` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "words_expression_expressionJa_key";

-- CreateIndex
CREATE UNIQUE INDEX "words_expression_expressionJa_isKids_key" ON "words"("expression", "expressionJa", "isKids");

-- CreateIndex
CREATE UNIQUE INDEX "words_expression_expressionJa_targetLength_key" ON "words"("expression", "expressionJa", "targetLength");
