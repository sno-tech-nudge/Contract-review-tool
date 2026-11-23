-- AlterTable
ALTER TABLE "FindingFeedback" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "userName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "weight" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "LearningEvent" ADD COLUMN     "userName" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "MissedIssue" ADD COLUMN     "userId" TEXT,
ADD COLUMN     "userName" TEXT NOT NULL DEFAULT '';

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "setupHash" TEXT NOT NULL DEFAULT '',
    "setupExpires" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

