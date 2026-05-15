/*
  Warnings:

  - A unique constraint covering the columns `[expression,expressionJa]` on the table `words` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "words_expression_key";

-- CreateIndex
CREATE UNIQUE INDEX "words_expression_expressionJa_key" ON "words"("expression", "expressionJa");
