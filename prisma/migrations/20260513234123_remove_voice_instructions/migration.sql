/*
  Warnings:

  - You are about to drop the column `receiverVoiceInstruction` on the `problems` table. All the data in the column will be lost.
  - You are about to drop the column `senderVoiceInstruction` on the `problems` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "problems" DROP COLUMN "receiverVoiceInstruction",
DROP COLUMN "senderVoiceInstruction";
