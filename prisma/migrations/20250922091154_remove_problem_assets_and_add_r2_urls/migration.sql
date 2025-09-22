/*
  Warnings:

  - You are about to drop the `problem_assets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "problem_assets" DROP CONSTRAINT "problem_assets_problemId_fkey";

-- DropTable
DROP TABLE "problem_assets";
