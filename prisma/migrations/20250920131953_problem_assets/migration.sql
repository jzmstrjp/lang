-- CreateEnum
CREATE TYPE "ProblemType" AS ENUM ('short', 'medium', 'long');

-- CreateEnum
CREATE TYPE "InteractionIntent" AS ENUM ('request', 'question', 'opinion', 'agreement', 'info');

-- CreateTable
CREATE TABLE "problems" (
    "id" TEXT NOT NULL,
    "type" "ProblemType" NOT NULL,
    "english" TEXT NOT NULL,
    "japaneseReply" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "correctIndex" INTEGER NOT NULL,
    "audioEnUrl" TEXT,
    "audioJaUrl" TEXT,
    "sceneAImageUrl" TEXT,
    "sceneBImageUrl" TEXT,
    "sceneId" TEXT NOT NULL,
    "scenePrompt" TEXT NOT NULL,
    "speakersSceneA" TEXT NOT NULL,
    "speakersSceneB" TEXT NOT NULL,
    "nuance" TEXT,
    "genre" TEXT,
    "patternGroup" TEXT,
    "wordCount" INTEGER NOT NULL,
    "interactionIntent" "InteractionIntent" NOT NULL,
    "isCached" BOOLEAN NOT NULL DEFAULT false,
    "qualityCheck" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "problem_assets" (
    "id" TEXT NOT NULL,
    "problemId" TEXT NOT NULL,
    "scenePrompt" TEXT NOT NULL,
    "sceneAImage" TEXT NOT NULL,
    "sceneBImage" TEXT NOT NULL,
    "audioEn" TEXT NOT NULL,
    "audioJa" TEXT NOT NULL,
    "debugMode" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "problem_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "problems_type_isCached_qualityCheck_idx" ON "problems"("type", "isCached", "qualityCheck");

-- CreateIndex
CREATE INDEX "problems_sceneId_idx" ON "problems"("sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "problems_english_interactionIntent_sceneId_key" ON "problems"("english", "interactionIntent", "sceneId");

-- CreateIndex
CREATE UNIQUE INDEX "problem_assets_problemId_key" ON "problem_assets"("problemId");

-- AddForeignKey
ALTER TABLE "problem_assets" ADD CONSTRAINT "problem_assets_problemId_fkey" FOREIGN KEY ("problemId") REFERENCES "problems"("id") ON DELETE CASCADE ON UPDATE CASCADE;
