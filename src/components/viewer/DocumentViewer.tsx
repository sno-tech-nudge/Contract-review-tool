"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, Minus, Plus, Scan } from "lucide-react";
import HtmlViewer from "./HtmlViewer";
import type { Focus } from "./match";

const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => <div className="viewer__loading">Loading document…</div>,
});

type Props = {
  documentId: string;
  fileName: string;
  mimeType: string;
  text: string; // fallback for plain text files
  focus: Focus | null;
};

const escapeHtml = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]!);

export function DocumentViewer({ documentId, fileName, mimeType, text, focus }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pages, setPages] = useState(0);
  const [current, setCurrent] = useState(1);
  const [html, setHtml] = useState<string | null>(null);
  const isPdf = mimeType === "application/pdf";
  const isDocx = mimeType.includes("wordprocessingml");

  useEffect(() => {
    if (isDocx) {
      fetch(`/api/files/${documentId}/html`)
        .then((r) => r.json())
        .then((j) => setHtml(j.html ?? "<p>Could not display this document.</p>"))
        .catch(() => setHtml("<p>Could not display this document.</p>"));
    } else if (!isPdf) {
      setHtml(text.split(/\n{2,}/).map((p) => `<p class="viewer__text">${escapeHtml(p)}</p>`).join(""));
    }
  }, [documentId, isDocx, isPdf, text]);

  const onCurrent = useCallback((n: number) => setCurrent(n), []);
  const onPageCount = useCallback((n: number) => setPages(n), []);

  return (
    <section className="viewer" aria-label="Contract">
      <div className="viewer__bar">
        <span className="viewer__name" title={fileName}>
          {fileName}
        </span>
        <div className="viewer__tools">
          {isPdf && pages > 0 && (
            <span className="micro num" style={{ marginRight: "var(--space-2)" }}>
              Page {current} / {pages}
            </span>
          )}
          {isPdf && (
            <>
              <button className="btn btn--ghost btn--icon" onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.15).toFixed(2)))} aria-label="Zoom out" title="Zoom out">
                <Minus />
              </button>
              <span className="micro num" style={{ minWidth: 38, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </span>
              <button className="btn btn--ghost btn--icon" onClick={() => setZoom((z) => Math.min(2, +(z + 0.15).toFixed(2)))} aria-label="Zoom in" title="Zoom in">
                <Plus />
              </button>
              <button className="btn btn--ghost btn--icon" onClick={() => setZoom(1)} aria-label="Fit to width" title="Fit to width">
                <Scan />
              </button>
              <span className="sep" />
            </>
          )}
          <a className="btn btn--ghost btn--icon" href={`/api/files/${documentId}?download=1`} aria-label="Download original" title="Download original">
            <Download />
          </a>
        </div>
      </div>
      <div className="viewer__scroll" ref={scrollRef}>
        {isPdf ? (
          <PdfViewer fileUrl={`/api/files/${documentId}`} zoom={zoom} focus={focus} onPageCount={onPageCount} onCurrentPage={onCurrent} scrollRef={scrollRef} />
        ) : html === null ? (
          <div className="viewer__loading">Loading document…</div>
        ) : (
          <HtmlViewer html={html} focus={focus} />
        )}
      </div>
    </section>
  );
}
