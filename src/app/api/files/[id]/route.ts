import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/api";
import { readFile } from "@/lib/storage";

export const runtime = "nodejs";

// Streams a stored contract back, inline for the viewer or as a download.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const doc = await prisma.document.findUnique({ where: { id }, select: { storageKey: true, mimeType: true, fileName: true } });
  if (!doc) return jsonError("File not found.", 404);
  const download = new URL(request.url).searchParams.has("download");
  const body = await readFile(doc.storageKey);
  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
