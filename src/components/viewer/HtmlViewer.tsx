"use client";

import { useEffect, useRef } from "react";
import { matchItems, type Focus } from "./match";

// Shows Word documents (converted to HTML) and plain text, and highlights a
// quote by wrapping the matching text nodes in <mark>.
export default function HtmlViewer({ html, focus }: { html: string; focus: Focus | null }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    root.querySelectorAll("mark.hl").forEach((m) => m.replaceWith(...Array.from(m.childNodes)));
    root.normalize();
    if (!focus?.quote) return;

    const nodes: Text[] = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) nodes.push(walker.currentNode as Text);
    const hit = matchItems(nodes.map((n) => n.data), focus.quote);
    let first: HTMLElement | null = null;
    nodes.forEach((node, i) => {
      if (!hit.has(i) || !node.data.trim()) return;
      const mark = document.createElement("mark");
      mark.className = "hl";
      node.replaceWith(mark);
      mark.appendChild(node);
      first ??= mark;
    });
    (first as HTMLElement | null)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [focus, html]);

  return <div ref={ref} className="viewer__html" dangerouslySetInnerHTML={{ __html: html }} />;
}
