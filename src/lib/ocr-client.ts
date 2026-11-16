// Text recognition for scanned PDFs, run in the browser before upload so it
// costs nothing and isn't bound by serverless time limits. Only pages without a
// text layer are recognised; the server keeps real text wherever it exists.
// Loaded on demand: pdf.js and tesseract.js are large.

// Matches SCANNED_PAGE_CHARS in src/lib/extract.ts.
const SCANNED_PAGE_CHARS = 30;
// Wide enough for small print to read reliably, small enough to stay quick.
const RENDER_WIDTH = 1700;

export type OcrProgress = { stage: "checking" } | { stage: "loading" } | { stage: "page"; done: number; total: number };

// Returns text for each page (null where the PDF already has text), or null
// when no page needs recognising.
export async function recogniseScannedPages(file: File, onProgress: (p: OcrProgress) => void): Promise<(string | null)[] | null> {
  if (!/\.pdf$/i.test(file.name)) return null;
  onProgress({ stage: "checking" });

  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;

  try {
    const scanned: number[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      const chars = content.items.reduce((sum, item) => sum + ("str" in item ? item.str.replace(/\s/g, "").length : 0), 0);
      if (chars < SCANNED_PAGE_CHARS) scanned.push(n);
    }
    if (!scanned.length) return null;

    onProgress({ stage: "loading" });
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng");
    const texts: (string | null)[] = Array(pdf.numPages).fill(null);
    try {
      for (let i = 0; i < scanned.length; i++) {
        onProgress({ stage: "page", done: i, total: scanned.length });
        const page = await pdf.getPage(scanned[i]);
        const base = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: RENDER_WIDTH / base.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        // "print" renders without waiting for animation frames, so it keeps
        // going when the tab is in the background.
        await page.render({ canvas, viewport, intent: "print" }).promise;
        const { data } = await worker.recognize(canvas);
        texts[scanned[i] - 1] = data.text;
        canvas.width = canvas.height = 0; // free the bitmap
      }
      onProgress({ stage: "page", done: scanned.length, total: scanned.length });
    } finally {
      await worker.terminate();
    }
    return texts;
  } finally {
    await pdf.destroy();
  }
}

export function describeOcr(p: OcrProgress | null): string {
  if (!p) return "";
  if (p.stage === "checking") return "Checking for scanned pages";
  if (p.stage === "loading") return "Scanned pages found: getting text recognition ready";
  return p.done >= p.total ? `Recognised text on ${p.total} scanned page${p.total === 1 ? "" : "s"}` : `Recognising text on scanned page ${p.done + 1} of ${p.total}`;
}
