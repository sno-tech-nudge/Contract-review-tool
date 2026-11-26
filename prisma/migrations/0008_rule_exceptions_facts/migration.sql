-- AlterTable
ALTER TABLE "BusinessRule" ADD COLUMN     "entities" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "exceptions" TEXT NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "factsJson" TEXT NOT NULL DEFAULT '{}';

