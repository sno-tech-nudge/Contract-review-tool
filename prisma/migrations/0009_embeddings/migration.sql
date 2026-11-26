-- CreateTable
CREATE TABLE "Embedding" (
    "hash" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "vector" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Embedding_pkey" PRIMARY KEY ("hash")
);

