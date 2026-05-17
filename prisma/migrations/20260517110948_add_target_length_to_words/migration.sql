-- CreateEnum
CREATE TYPE "ProblemLength" AS ENUM ('kids', 'short', 'medium', 'long');

-- AlterTable
ALTER TABLE "words" ADD COLUMN     "targetLength" "ProblemLength";

-- CreateIndex
CREATE INDEX "words_targetLength_idx" ON "words"("targetLength");
