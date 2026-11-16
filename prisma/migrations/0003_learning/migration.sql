-- CreateTable
CREATE TABLE "FindingFeedback" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT,
    "findingId" TEXT NOT NULL,
    "ruleKey" TEXT NOT NULL,
    "check" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "verdict" TEXT NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FindingFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MissedIssue" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT,
    "contractType" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'medium',
    "page" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MissedIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleOverride" (
    "ruleKey" TEXT NOT NULL,
    "contractType" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RuleOverride_pkey" PRIMARY KEY ("ruleKey","contractType")
);

-- CreateTable
CREATE TABLE "TrainingExample" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingExample_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LearningEvent" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LearningEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FindingFeedback_ruleKey_contractType_idx" ON "FindingFeedback"("ruleKey", "contractType");

-- CreateIndex
CREATE UNIQUE INDEX "FindingFeedback_reviewId_findingId_key" ON "FindingFeedback"("reviewId", "findingId");

-- CreateIndex
CREATE INDEX "MissedIssue_status_idx" ON "MissedIssue"("status");

-- CreateIndex
CREATE INDEX "TrainingExample_kind_idx" ON "TrainingExample"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingExample_kind_sourceId_key" ON "TrainingExample"("kind", "sourceId");

-- CreateIndex
CREATE INDEX "LearningEvent_createdAt_idx" ON "LearningEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "FindingFeedback" ADD CONSTRAINT "FindingFeedback_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MissedIssue" ADD CONSTRAINT "MissedIssue_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "Review"("id") ON DELETE SET NULL ON UPDATE CASCADE;

