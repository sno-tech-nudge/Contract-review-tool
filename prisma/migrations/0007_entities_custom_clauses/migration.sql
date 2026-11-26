-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "entity" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "CustomClause" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'operational',
    "description" TEXT NOT NULL DEFAULT '',
    "phrases" TEXT NOT NULL DEFAULT '',
    "standardText" TEXT NOT NULL DEFAULT '',
    "contractTypes" TEXT NOT NULL DEFAULT '',
    "entities" TEXT NOT NULL DEFAULT '',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomClause_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Document_entity_idx" ON "Document"("entity");

