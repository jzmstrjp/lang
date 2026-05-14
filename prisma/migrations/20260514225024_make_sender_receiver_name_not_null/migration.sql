/*
  Warnings:

  - Made the column `receiverName` on table `problems` required. This step will fail if there are existing NULL values in that column.
  - Made the column `senderName` on table `problems` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "problems" ALTER COLUMN "receiverName" SET NOT NULL,
ALTER COLUMN "senderName" SET NOT NULL;
