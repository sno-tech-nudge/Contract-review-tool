"use client";

import { useEffect, useRef, useState } from "react";

// Contract on the left, panel on the right, with a divider people can drag
// (or move with the arrow keys) to give either side more room. The chosen
// split is remembered per browser; double-click the divider to reset it.

const MIN = 30;
const MAX = 75;
const clamp = (v: number) => Math.min(MAX, Math.max(MIN, v));

export function SplitPane({ left, right, storageKey, defaultSplit = 56 }: { left: React.ReactNode; right: React.ReactNode; storageKey: string; defaultSplit?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(defaultSplit);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(storageKey));
      if (saved >= MIN && saved <= MAX) setSplit(saved);
    } catch {
      // storage unavailable (private window): keep the default
    }
  }, [storageKey]);

  const save = (v: number) => {
    const next = clamp(v);
    setSplit(next);
    try {
      localStorage.setItem(storageKey, String(Math.round(next * 10) / 10));
    } catch {
      // not essential
    }
  };

  const startDrag = (e: React.PointerEvent) => {
    if (e.button !== 0 || !ref.current) return;
    e.preventDefault();
    const rect = ref.current.getBoundingClientRect();
    const move = (ev: PointerEvent) => save(((ev.clientX - rect.left) / rect.width) * 100);
    const stop = () => {
      window.removeEventListener("pointermove", move);
      document.body.classList.remove("is-resizing");
    };
    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") save(split - 2);
    else if (e.key === "ArrowRight") save(split + 2);
    else if (e.key === "Home") save(defaultSplit);
    else return;
    e.preventDefault();
  };

  return (
    <div ref={ref} className="split" style={{ "--split": `${split}%` } as React.CSSProperties}>
      {left}
      <div
        className="split__handle"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize the contract and review panels"
        aria-valuenow={Math.round(split)}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        tabIndex={0}
        title="Drag to resize · double-click to reset"
        onPointerDown={startDrag}
        onKeyDown={onKey}
        onDoubleClick={() => save(defaultSplit)}
      >
        <span aria-hidden />
      </div>
      {right}
    </div>
  );
}
