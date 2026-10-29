-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Document" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "counterparty" TEXT NOT NULL DEFAULT '',
    "tags" TEXT NOT NULL DEFAULT '',
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT NOT NULL DEFAULT '',
    "pageCount" INTEGER NOT NULL DEFAULT 0,
    "text" TEXT NOT NULL DEFAULT '',
    "pagesJson" TEXT NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "heading" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "clauseType" TEXT NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETE',
    "contractType" TEXT NOT NULL,
    "riskScore" INTEGER NOT NULL DEFAULT 0,
    "resultJson" TEXT NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" TEXT NOT NULL,
    "pattern" TEXT NOT NULL DEFAULT '',
    "threshold" DOUBLE PRECISION,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "appliesTo" TEXT NOT NULL DEFAULT '',
    "guidance" TEXT NOT NULL DEFAULT '',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalRuleSetting" (
    "ruleId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "LegalRuleSetting_pkey" PRIMARY KEY ("ruleId")
);

-- CreateTable
CREATE TABLE "Meta" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "Document_kind_contractType_idx" ON "Document"("kind", "contractType");

-- CreateIndex
CREATE INDEX "Clause_clauseType_idx" ON "Clause"("clauseType");

-- CreateIndex
CREATE INDEX "Clause_documentId_idx" ON "Clause"("documentId");

-- CreateIndex
CREATE INDEX "Review_createdAt_idx" ON "Review"("createdAt");

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

