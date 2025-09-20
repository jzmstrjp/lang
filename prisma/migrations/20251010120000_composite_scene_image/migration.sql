-- Consolidate scene images into a single composite image
ALTER TABLE "problem_assets" ADD COLUMN "compositeImage" TEXT;
UPDATE "problem_assets" SET "compositeImage" = COALESCE("sceneAImage", "sceneBImage");
ALTER TABLE "problem_assets" ALTER COLUMN "compositeImage" SET NOT NULL;
ALTER TABLE "problem_assets" DROP COLUMN "sceneAImage";
ALTER TABLE "problem_assets" DROP COLUMN "sceneBImage";

ALTER TABLE "problems" ADD COLUMN "compositeImageUrl" TEXT;
UPDATE "problems" SET "compositeImageUrl" = COALESCE("sceneAImageUrl", "sceneBImageUrl");
ALTER TABLE "problems" DROP COLUMN "sceneAImageUrl";
ALTER TABLE "problems" DROP COLUMN "sceneBImageUrl";
