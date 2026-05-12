-- CreateTable
CREATE TABLE "words" (
    "id" TEXT NOT NULL,
    "expression" TEXT NOT NULL,
    "isKids" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "words_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "words_expression_key" ON "words"("expression");

-- CreateIndex
CREATE INDEX "words_isKids_idx" ON "words"("isKids");
