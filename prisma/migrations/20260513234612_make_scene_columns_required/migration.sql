/*
  Warnings:

  - Made the column `expression` on table `problems` required. This step will fail if there are existing NULL values in that column.
  - Made the column `how` on table `problems` required. This step will fail if there are existing NULL values in that column.
  - Made the column `receiverPlace` on table `problems` required. This step will fail if there are existing NULL values in that column.
  - Made the column `senderWant` on table `problems` required. This step will fail if there are existing NULL values in that column.
  - Made the column `senderWhen` on table `problems` required. This step will fail if there are existing NULL values in that column.
  - Made the column `senderWhy` on table `problems` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "problems" ALTER COLUMN "expression" SET NOT NULL,
ALTER COLUMN "how" SET NOT NULL,
ALTER COLUMN "receiverPlace" SET NOT NULL,
ALTER COLUMN "senderWant" SET NOT NULL,
ALTER COLUMN "senderWhen" SET NOT NULL,
ALTER COLUMN "senderWhy" SET NOT NULL;
