/*
  Warnings:

  - Added the required column `initial_alphabet` to the `problems` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "initial_alphabet" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "problems_type_initial_alphabet_idx" ON "problems"("type", "initial_alphabet");
