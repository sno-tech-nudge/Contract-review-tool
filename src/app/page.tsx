import Link from "next/link";
import { FileSearch } from "lucide-react";
import { prisma } from "@/lib/db";
import { contractTypeLabel } from "@/lib/contracts/types";
import { LEGAL_RULES } from "@/lib/checks/legal/rules";
import type { ReviewResult } from "@/lib/review/types";
import { ReviewUpload } from "@/components/ReviewUpload";
import { RiskPill, formatDate } from "@/components/ui";
import { blobEnabled } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [reviews, repositoryCount] = await Promise.all([
    prisma.review.findMany({ orderBy: { createdAt: "desc" }, take: 25, include: { document: { select: { title: true, fileName: true } } } }),
    prisma.document.count({ where: { kind: "REPOSITORY" } }),
  ]);

  return (
    <main className="page">
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
                    <td>
                      <RiskPill score={r.riskScore} />
                    </td>
                    <td className="num">{issues}</td>
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
