import { prisma } from "@/lib/db";
import { RepositoryBrowser } from "@/components/repository/RepositoryBrowser";
import { blobEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";
export const metadata = { title: "Repository · Contract review" };

export default async function RepositoryPage() {
  const docs = await prisma.document.findMany({
    where: { kind: "REPOSITORY" },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      contractType: true,
      counterparty: true,
      tags: true,
      isTemplate: true,
      pageCount: true,
      size: true,
      createdAt: true,
      text: true,
      _count: { select: { clauses: true } },
    },
  });

  return (
    <RepositoryBrowser
      directUpload={blobEnabled()}
      docs={docs.map((d) => ({
        id: d.id,
        title: d.title,
        fileName: d.fileName,
        contractType: d.contractType,
        counterparty: d.counterparty,
        tags: d.tags.split(";").filter(Boolean),
        isTemplate: d.isTemplate,
        pageCount: d.pageCount,
        size: d.size,
        createdAt: d.createdAt.toISOString(),
        clauses: d._count.clauses,
        // a lower-cased slice of the text so search covers contents, not just titles
        search: `${d.title} ${d.counterparty} ${d.tags} ${d.fileName} ${d.text.slice(0, 12000)}`.toLowerCase(),
      }))}
    />
  );
}
