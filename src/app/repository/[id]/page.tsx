import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { RepositoryDocument } from "@/components/repository/RepositoryDocument";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, select: { title: true } });
  return { title: doc ? `${doc.title} · Repository` : "Not found" };
}

export default async function RepositoryDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findFirst({
    where: { id, kind: "REPOSITORY" },
    include: { clauses: { orderBy: { position: "asc" }, select: { id: true, heading: true, text: true, clauseType: true, page: true } } },
  });
  if (!doc) notFound();

  return (
    <RepositoryDocument
      doc={{
        id: doc.id,
        title: doc.title,
        fileName: doc.fileName,
        mimeType: doc.mimeType,
        contractType: doc.contractType,
        counterparty: doc.counterparty,
        tags: doc.tags.split(";").filter(Boolean).join(", "),
        isTemplate: doc.isTemplate,
        notes: doc.notes,
        pageCount: doc.pageCount,
        size: doc.size,
        createdAt: doc.createdAt.toISOString(),
        text: doc.mimeType === "text/plain" ? doc.text : "",
      }}
      clauses={doc.clauses}
    />
  );
}
