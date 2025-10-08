/*
  Warnings:

  - You are about to drop the column `patternId` on the `problems` table. All the data in the column will be lost.
  - You are about to drop the `pattern_sets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "problems" DROP CONSTRAINT "problems_patternId_fkey";

-- DropIndex
DROP INDEX "problems_patternId_idx";

-- AlterTable
ALTER TABLE "problems" DROP COLUMN "patternId";

-- DropTable
DROP TABLE "pattern_sets";
