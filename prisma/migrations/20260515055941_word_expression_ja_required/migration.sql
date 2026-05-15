/*
  Warnings:

  - Made the column `expressionJa` on table `words` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "words" ALTER COLUMN "expressionJa" SET NOT NULL;
