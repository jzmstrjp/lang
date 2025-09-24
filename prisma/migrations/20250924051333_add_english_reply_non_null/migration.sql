/*
  Warnings:

  - Made the column `englishReply` on table `problems` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "problems" ALTER COLUMN "englishReply" SET NOT NULL;
