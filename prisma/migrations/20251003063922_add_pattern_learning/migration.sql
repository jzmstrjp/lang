-- AlterTable
ALTER TABLE "problems" ADD COLUMN     "patternId" TEXT;

-- CreateTable
CREATE TABLE "pattern_sets" (
    "id" TEXT NOT NULL,
    "patternName" TEXT NOT NULL,
    "correctAnswer" TEXT NOT NULL,
    "incorrectOptions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pattern_sets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problems_patternId_idx" ON "problems"("patternId");

-- AddForeignKey
ALTER TABLE "problems" ADD CONSTRAINT "problems_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "pattern_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
