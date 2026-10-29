"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import { matchItems, type Focus } from "./match";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

type Props = {
  fileUrl: string;
  zoom: number;
  focus: Focus | null;
  onPageCount: (n: number) => void;
  onCurrentPage: (n: number) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
};

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export default function PdfViewer({ fileUrl, zoom, focus, onPageCount, onCurrentPage, scrollRef }: Props) {
  const [numPages, setNumPages] = useState(0);
  const [width, setWidth] = useState(720);
  const [texts, setTexts] = useState<Record<number, string[]>>({});
  const [marked, setMarked] = useState<{ page: number; items: Set<number> } | null>(null);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  // Fit pages to the panel width.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(Math.min(el.clientWidth - 96, 900)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [scrollRef]);

  // Track which page is in view: the last page whose top has passed the
  // upper third of the panel.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root || !numPages) return;
    const onScroll = () => {
      const line = root.getBoundingClientRect().top + root.clientHeight / 3;
      let current = 1;
      for (let n = 1; n <= numPages; n++) {
        const el = pageRefs.current[n];
        if (el && el.getBoundingClientRect().top <= line) current = n;
      }
      onCurrentPage(current);
    };
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, [numPages, onCurrentPage, scrollRef]);

  // Work out which text items to highlight for the focused quote.
  useEffect(() => {
    if (!focus) return setMarked(null);
    const order = focus.page ? [focus.page, ...Object.keys(texts).map(Number).filter((p) => p !== focus.page)] : Object.keys(texts).map(Number);
    for (const p of order) {
      const items = texts[p];
      if (!items || !focus.quote) continue;
      const hit = matchItems(items, focus.quote);
      if (hit.size) return setMarked({ page: p, items: hit });
    }
    setMarked(null);
  }, [focus, texts]);

  // Scroll to the highlight (or the page) once the text layer has painted.
  useEffect(() => {
    if (!focus) return;
    let tries = 0;
    const t = setInterval(() => {
      tries++;
      const page = marked?.page ?? focus.page;
      const pageEl = page ? pageRefs.current[page] : null;
      const mark = pageEl?.querySelector(".react-pdf__Page__textContent mark");
      if (mark) {
        mark.scrollIntoView({ block: "center", behavior: "smooth" });
        clearInterval(t);
      } else if (tries > 12) {
        pageEl?.scrollIntoView({ block: "start", behavior: "smooth" });
        clearInterval(t);
      }
    }, 80);
    return () => clearInterval(t);
  }, [focus, marked]);

  const renderText = useCallback(
    ({ str, itemIndex, pageNumber }: { str: string; itemIndex: number; pageNumber: number }) =>
      marked && marked.page === pageNumber && marked.items.has(itemIndex) ? `<mark>${escapeHtml(str)}</mark>` : escapeHtml(str),
    [marked]
  );

  const pages = useMemo(() => Array.from({ length: numPages }, (_, i) => i + 1), [numPages]);

  return (
    <Document
      file={fileUrl}
      onLoadSuccess={({ numPages }) => {
        setNumPages(numPages);
        onPageCount(numPages);
      }}
      loading={<div className="viewer__loading">Loading document…</div>}
      error={<div className="viewer__loading">This PDF could not be displayed. Use download to open it.</div>}
    >
      <div className="viewer__pages">
        {pages.map((n) => (
          <div key={n} className="viewer__page" data-page={n} ref={(el) => void (pageRefs.current[n] = el)}>
            <Page
              pageNumber={n}
              width={Math.max(320, width * zoom)}
              renderAnnotationLayer={false}
              customTextRenderer={renderText}
              onGetTextSuccess={(tc) => setTexts((t) => ({ ...t, [n]: tc.items.map((it) => ("str" in it ? it.str : "")) }))}
              loading={<div style={{ height: Math.max(320, width * zoom) * 1.414 }} />}
            />
            <span className="viewer__pageno">{n}</span>
          </div>
        ))}
      </div>
    </Document>
  );
}
