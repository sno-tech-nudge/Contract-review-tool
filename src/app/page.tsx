import Link from "next/link";
import { CircleCheck, FileSearch } from "lucide-react";
import { prisma } from "@/lib/db";
import { contractTypeLabel } from "@/lib/contracts/types";
import { entityLabel } from "@/lib/contracts/entities";
import { LEGAL_RULES } from "@/lib/checks/legal/rules";
import type { ReviewResult } from "@/lib/review/types";
import { ReviewUpload } from "@/components/ReviewUpload";
import { RiskPill, formatDate } from "@/components/ui";
import { blobEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [reviews, repositoryCount, entityGroups, libraryCount, customCount] = await Promise.all([
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { document: { select: { title: true, fileName: true, entity: true } } } }),
    prisma.document.count({ where: { kind: "REPOSITORY" } }),
    prisma.document.groupBy({ by: ["entity"], where: { kind: "REPOSITORY", entity: { not: "" } }, _count: { _all: true } }),
    prisma.libraryClause.count(),
    prisma.customClause.count({ where: { enabled: true } }),
  ]);
  const setup = [
    {
      done: repositoryCount > 0,
      title: "Build the repository",
      text: repositoryCount
        ? `${repositoryCount} contract${repositoryCount === 1 ? "" : "s"}${entityGroups.length ? ` across ${entityGroups.map((g) => `${entityLabel(g.entity)} (${g._count._all})`).join(", ")}` : ""}.`
        : "Add signed contracts and approved templates, sorted by type and by The/Nudge, the*delta or the*spark.",
      href: "/repository",
      action: repositoryCount ? "Open the repository" : "Add contracts",
    },
    {
      done: libraryCount + customCount > 0,
      title: "Set the clause library",
      text:
        libraryCount + customCount
          ? `${libraryCount} approved clause${libraryCount === 1 ? "" : "s"}${customCount ? ` and ${customCount} of your own` : ""} that every review is checked against.`
          : "Define the standard wording for each clause, including your own operational clauses.",
      href: "/library",
      action: libraryCount + customCount ? "Open the library" : "Set up the library",
    },
    { done: reviews.length > 0, title: "Review contracts", text: "Upload a contract below. Each one is checked against the repository, the clause library, the law and your business rules.", href: "", action: "" },
  ];

  return (
    <main className="page">
      <ol className="setup-steps" aria-label="How the tool works">
        {setup.map((step, i) => (
          <li key={step.title} className={step.done ? "is-done" : ""}>
            <span className="idx">{step.done ? <CircleCheck size={16} /> : `/0${i + 1}`}</span>
            <div>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
              {step.href && (
                <Link href={step.href} className="setup-steps__link">
                  {step.action} →
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="home-grid">
        <section>
          <span className="kicker">Contract review</span>
          <h1 className="page-title">Upload a contract to review</h1>
          <p className="lead" style={{ marginBottom: "var(--space-6)" }}>
            Each contract is checked three ways: against the wording in our repository, against the laws that govern Indian non-profits, and against our own business rules.
          </p>
          <ReviewUpload repositoryCount={repositoryCount} legalRuleCount={LEGAL_RULES.length} directUpload={blobEnabled()} />
        </section>

        <aside style={{ paddingTop: "var(--space-7)" }}>
          <ol className="steps">
            <li>
              <span className="idx">/01</span>
              <div>
                <h3>Boilerplate</h3>
                <p>
                  Finds missing clauses and wording that departs from{" "}
                  {repositoryCount ? (
                    <Link href="/repository">{repositoryCount} contract{repositoryCount === 1 ? "" : "s"} in the repository</Link>
                  ) : (
                    "standard practice. Add contracts to the repository to compare against your own"
                  )}
                  , and suggests standard wording.
                </p>
              </div>
            </li>
            <li>
              <span className="idx">/02</span>
              <div>
                <h3>Legal</h3>
                <p>{LEGAL_RULES.length} checks across FCRA, CSR rules, income tax, GST, the DPDP Act, stamp duty, governing law and safeguarding.</p>
              </div>
            </li>
            <li>
              <span className="idx">/03</span>
              <div>
                <h3>Business</h3>
                <p>
                  Our own rules for payment terms, renewals, approvals and more. <Link href="/rules?tab=business">Add or edit rules</Link>.
                </p>
              </div>
            </li>
          </ol>
          <p className="caption" style={{ marginTop: "var(--space-4)" }}>
            Click any finding to jump to the exact passage in the contract.
          </p>
        </aside>
      </div>

      <section style={{ marginTop: "var(--space-9)" }}>
        <div className="sechead">
          <h2>Recent reviews</h2>
          <span className="micro">{reviews.length ? `${reviews.length} shown` : ""}</span>
        </div>
        {reviews.length === 0 ? (
          <div className="empty">
            <div className="empty__icon">
              <FileSearch size={22} strokeWidth={1.5} />
            </div>
            <h3>No reviews yet</h3>
            <p>Reviews you run will appear here, so you can come back to them later.</p>
          </div>
        ) : (
          <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Contract</th>
                <th>Type</th>
                <th>Entity</th>
                <th>Risk</th>
                <th>Issues</th>
                <th>Reviewed</th>
              </tr>
            </thead>
            <tbody>
              {reviews.map((r) => {
                const result = JSON.parse(r.resultJson) as ReviewResult;
                const issues = result.findings?.filter((f) => f.status === "issue").length ?? 0;
                return (
                  <tr key={r.id}>
                    <td>
                      <Link className="rowlink" href={`/review/${r.id}`}>
                        {r.document.title}
                      </Link>
                    </td>
                    <td className="muted">{contractTypeLabel(r.contractType)}</td>
                    <td className="muted">{r.document.entity ? entityLabel(r.document.entity) : "–"}</td>
                    <td>
                      {r.status === "COMPLETE" ? (
                        <RiskPill score={r.riskScore} />
                      ) : (
                        <span className={`badge ${r.status === "FAILED" ? "badge--clay" : "badge--neutral"}`}>{r.status === "FAILED" ? "Failed" : "In progress"}</span>
                      )}
                    </td>
                    <td className="num">{r.status === "COMPLETE" ? issues : "–"}</td>
                    <td className="muted num">{formatDate(r.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </section>
    </main>
  );
}
