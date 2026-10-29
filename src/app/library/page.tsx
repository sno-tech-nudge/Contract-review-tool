import { prisma } from "@/lib/db";
import { ClauseLibrary } from "@/components/library/ClauseLibrary";
import { unwrapLines } from "@/lib/text/locate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Clause library · Contract review" };

export default async function LibraryPage() {
  const clauses = await prisma.clause.findMany({
    // preambles and signature blocks are specific to each contract, not reusable wording
    where: { document: { kind: "REPOSITORY" }, clauseType: { notIn: ["other", "parties", "signatures"] } },
    orderBy: [{ document: { isTemplate: "desc" } }, { document: { createdAt: "desc" } }, { position: "asc" }],
    select: {
      id: true,
      heading: true,
      text: true,
      clauseType: true,
      page: true,
      document: { select: { id: true, title: true, isTemplate: true, contractType: true } },
    },
  });
  return <ClauseLibrary clauses={clauses.map((c) => ({ ...c, text: unwrapLines(c.text) }))} />;
}
