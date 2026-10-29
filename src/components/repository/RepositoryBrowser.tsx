"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BadgeCheck, CircleAlert, CircleCheck, Folder, FolderOpen, LayoutGrid, List, Search, Star, Upload, X } from "lucide-react";
import { CONTRACT_TYPES, CONTRACT_TYPE_KEYS, contractTypeLabel } from "@/lib/contracts/types";
import { extOf, formatDate, formatSize } from "@/components/ui";

export type RepoDoc = {
  id: string;
  title: string;
  fileName: string;
  contractType: string;
  counterparty: string;
  tags: string[];
  isTemplate: boolean;
  pageCount: number;
  size: number;
  createdAt: string;
  clauses: number;
  search: string;
};

type UploadItem = { key: string; name: string; state: "queued" | "uploading" | "done" | "error"; error?: string; id?: string; contractType?: string; isTemplate?: boolean };

const ACCEPTED = /\.(pdf|docx|txt)$/i;

export function RepositoryBrowser({ docs }: { docs: RepoDoc[] }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [folder, setFolder] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<"recent" | "title">("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const dragDepth = useRef(0);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: docs.length, templates: docs.filter((d) => d.isTemplate).length };
    for (const d of docs) c[d.contractType] = (c[d.contractType] ?? 0) + 1;
    return c;
  }, [docs]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs
      .filter((d) => (folder === "all" ? true : folder === "templates" ? d.isTemplate : d.contractType === folder))
      .filter((d) => !q || q.split(/\s+/).every((w) => d.search.includes(w)))
      .sort((a, b) => (sort === "title" ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt)));
  }, [docs, folder, query, sort]);

  const update = (key: string, patch: Partial<UploadItem>) => setUploads((u) => u.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  // Upload files one at a time so each shows its own progress.
  const addFiles = useCallback(
    async (files: File[]) => {
      const items: UploadItem[] = files.map((f, i) => ({
        key: `${Date.now()}-${i}`,
        name: f.name,
        state: ACCEPTED.test(f.name) ? "queued" : "error",
        error: ACCEPTED.test(f.name) ? undefined : "Only PDF, Word or text files",
      }));
      setUploads((u) => [...items, ...u]);
      for (let i = 0; i < files.length; i++) {
        if (items[i].state === "error") continue;
        update(items[i].key, { state: "uploading" });
        const body = new FormData();
        body.append("file", files[i]);
        if (folder !== "all" && folder !== "templates") body.append("contractType", folder);
        if (folder === "templates") body.append("isTemplate", "true");
        try {
          const res = await fetch("/api/repository", { method: "POST", body });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error ?? "Upload failed");
          update(items[i].key, { state: "done", id: json.id, contractType: json.contractType, isTemplate: folder === "templates" });
        } catch (e) {
          update(items[i].key, { state: "error", error: e instanceof Error ? e.message : "Upload failed" });
        }
      }
      router.refresh();
    },
    [folder, router]
  );

  // Dropping files anywhere on the page adds them.
  useEffect(() => {
    const enter = (e: DragEvent) => {
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragDepth.current++;
      setDragging(true);
    };
    const leave = () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (!dragDepth.current) setDragging(false);
    };
    const over = (e: DragEvent) => e.preventDefault();
    const drop = (e: DragEvent) => {
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      const files = Array.from(e.dataTransfer?.files ?? []);
      if (files.length) addFiles(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragleave", leave);
    window.addEventListener("dragover", over);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("dragover", over);
      window.removeEventListener("drop", drop);
    };
  }, [addFiles]);

  const patchDoc = async (item: UploadItem, patch: { contractType?: string; isTemplate?: boolean }) => {
    update(item.key, patch);
    await fetch(`/api/repository/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    router.refresh();
  };

  const folderList = [
    { key: "all", label: "All contracts", icon: FolderOpen },
    { key: "templates", label: "Approved templates", icon: BadgeCheck },
  ];
  const totalClauses = docs.reduce((n, d) => n + d.clauses, 0);
  const activeUploads = uploads.some((u) => u.state === "queued" || u.state === "uploading");

  return (
    <main className="page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "var(--space-5)", flexWrap: "wrap", marginBottom: "var(--space-6)" }}>
        <div>
          <span className="kicker">Repository</span>
          <h1 className="page-title">Contract repository</h1>
          <p className="lead">The knowledge base behind every review. New contracts are compared with the clauses stored here, and approved templates count the most.</p>
        </div>
        <button className="btn" onClick={() => input.current?.click()}>
          <Upload /> Add contracts
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept=".pdf,.docx,.txt"
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) addFiles(files);
          }}
        />
      </div>

      <div className="repo-stats">
        <div className="repo-stat">
          <div className="repo-stat__value">{docs.length}</div>
          <div className="repo-stat__label">Contracts stored</div>
        </div>
        <div className="repo-stat">
          <div className="repo-stat__value">{counts.templates}</div>
          <div className="repo-stat__label">Approved templates</div>
        </div>
        <div className="repo-stat">
          <div className="repo-stat__value">{totalClauses.toLocaleString("en-IN")}</div>
          <div className="repo-stat__label">Clauses indexed for comparison</div>
        </div>
      </div>

      <div className="repo">
        <nav className="folders" aria-label="Folders">
          {folderList.map(({ key, label, icon: Icon }) => (
            <button key={key} className={`folder${folder === key ? " folder--active" : ""}`} onClick={() => setFolder(key)}>
              <Icon strokeWidth={1.6} /> {label}
              <span className="folder__count">{counts[key] ?? 0}</span>
            </button>
          ))}
          <hr />
          <span className="micro" style={{ padding: "0 0.7em var(--space-2)" }}>
            By type
          </span>
          {CONTRACT_TYPE_KEYS.map((k) => (
            <button key={k} className={`folder${folder === k ? " folder--active" : ""}`} onClick={() => setFolder(k)}>
              <Folder strokeWidth={1.6} /> {CONTRACT_TYPES[k].label}
              <span className="folder__count">{counts[k] ?? 0}</span>
            </button>
          ))}
        </nav>

        <section>
          <div className="toolbar">
            <div className="search" style={{ flex: 1, minWidth: 220, maxWidth: 440 }}>
              <Search />
              <input className="input" placeholder="Search titles, parties and contract text" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search the repository" />
            </div>
            <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
              <select className="select" style={{ width: "auto" }} value={sort} onChange={(e) => setSort(e.target.value as "recent" | "title")} aria-label="Sort">
                <option value="recent">Recently added</option>
                <option value="title">Title A to Z</option>
              </select>
              <div className="seg" role="group" aria-label="View">
                <button aria-pressed={view === "grid"} onClick={() => setView("grid")} aria-label="Grid view">
                  <LayoutGrid size={15} />
                </button>
                <button aria-pressed={view === "list"} onClick={() => setView("list")} aria-label="List view">
                  <List size={15} />
                </button>
              </div>
            </div>
          </div>

          {docs.length === 0 ? (
            <button className="dropzone" style={{ width: "100%" }} onClick={() => input.current?.click()}>
              <span className="dropzone__icon">
                <Upload strokeWidth={1.5} />
              </span>
              <p className="dropzone__title">Start your repository</p>
              <p className="dropzone__hint">
                Drop signed contracts and approved templates anywhere on this page, or <u>choose files</u>.
              </p>
              <span className="dropzone__meta">Several files at once · PDF, Word or text · up to 25 MB each</span>
            </button>
          ) : shown.length === 0 ? (
            <div className="empty">
              <h3>No matches</h3>
              <p>Try another search or folder.</p>
            </div>
          ) : view === "grid" ? (
            <div className="doc-grid">
              {shown.map((d) => (
                <Link key={d.id} href={`/repository/${d.id}`} className="doc">
                  <div className="doc__thumb" aria-hidden>
                    <div className="doc__sheet">
                      <i />
                      <i style={{ width: "92%" }} />
                      <i style={{ width: "86%" }} />
                      <i style={{ width: "95%" }} />
                      <i style={{ width: "70%" }} />
                      <i style={{ width: "90%" }} />
                    </div>
                    <span className="doc__ext badge badge--dark">{extOf(d.fileName)}</span>
                    {d.isTemplate && (
                      <span className="doc__star badge badge--brown">
                        <Star size={11} /> Template
                      </span>
                    )}
                  </div>
                  <div className="doc__body">
                    <span className="micro">{contractTypeLabel(d.contractType)}</span>
                    <span className="doc__title">{d.title}</span>
                    {d.counterparty && <span className="caption" style={{ fontSize: "var(--text-xs)" }}>{d.counterparty}</span>}
                    <span className="doc__meta num">
                      <span>{d.pageCount} pp</span>·<span>{d.clauses} clauses</span>·<span>{formatDate(d.createdAt)}</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Counterparty</th>
                  <th>Clauses</th>
                  <th>Size</th>
                  <th>Added</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((d) => (
                  <tr key={d.id}>
                    <td>
                      <Link className="rowlink" href={`/repository/${d.id}`}>
                        {d.title}
                      </Link>{" "}
                      {d.isTemplate && <span className="badge badge--brown">Template</span>}
                    </td>
                    <td className="muted">{contractTypeLabel(d.contractType)}</td>
                    <td className="muted">{d.counterparty || "—"}</td>
                    <td className="num">{d.clauses}</td>
                    <td className="muted num">{formatSize(d.size)}</td>
                    <td className="muted num">{formatDate(d.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </section>
      </div>

      {dragging && (
        <div className="drop-overlay">
          <div className="drop-overlay__box">
            <Upload />
            <p>Drop to add to the repository</p>
            <span className="caption" style={{ color: "var(--taupe-300)" }}>
              {folder !== "all" ? `Files go into ${folder === "templates" ? "approved templates" : contractTypeLabel(folder)}` : "Contract types are detected automatically"}
            </span>
          </div>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="uploads" role="status">
          <div className="uploads__head">
            <span>{activeUploads ? `Adding ${uploads.filter((u) => u.state === "queued" || u.state === "uploading").length} file(s)…` : `${uploads.filter((u) => u.state === "done").length} added`}</span>
            <button onClick={() => setUploads([])} aria-label="Close" disabled={activeUploads}>
              <X size={16} />
            </button>
          </div>
          <div className="uploads__list">
            {uploads.map((u) => (
              <div className="upload" key={u.key}>
                <span style={{ paddingTop: 2 }}>
                  {u.state === "done" ? <CircleCheck size={18} color="var(--moss)" /> : u.state === "error" ? <CircleAlert size={18} color="var(--clay)" /> : <span className="spinner" style={{ display: "block" }} />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="upload__name" title={u.name}>
                    {u.state === "done" && u.id ? <Link href={`/repository/${u.id}`}>{u.name}</Link> : u.name}
                  </div>
                  <div className="upload__row">
                    {u.state === "uploading" && "Reading and indexing clauses…"}
                    {u.state === "queued" && "Waiting"}
                    {u.state === "error" && <span className="upload__err">{u.error}</span>}
                    {u.state === "done" && (
                      <>
                        <select className="select" value={u.contractType} onChange={(e) => patchDoc(u, { contractType: e.target.value })} aria-label="Contract type">
                          {CONTRACT_TYPE_KEYS.map((k) => (
                            <option key={k} value={k}>
                              {CONTRACT_TYPES[k].label}
                            </option>
                          ))}
                        </select>
                        <label className="check">
                          <input type="checkbox" checked={!!u.isTemplate} onChange={(e) => patchDoc(u, { isTemplate: e.target.checked })} /> Template
                        </label>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  );
}
