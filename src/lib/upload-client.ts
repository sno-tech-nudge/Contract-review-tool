import { upload } from "@vercel/blob/client";

// Sends a contract to one of the ingest routes. With direct uploads on (Vercel
// Blob configured), the file goes from the browser straight to private Blob
// storage and the route receives only its pathname; otherwise it is posted as
// a regular form.
export async function sendContract(endpoint: string, file: File, fields: Record<string, string>, direct: boolean): Promise<Response> {
  if (direct) {
    const safeName = file.name.replace(/[^\w.\- ()]+/g, "_");
    const blob = await upload(`uploads/${safeName}`, file, {
      access: "private",
      handleUploadUrl: "/api/upload",
      contentType: file.type || undefined,
    });
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blobPathname: blob.pathname, fileName: file.name, ...fields }),
    });
  }
  const body = new FormData();
  body.append("file", file);
  for (const [k, v] of Object.entries(fields)) body.append(k, v);
  return fetch(endpoint, { method: "POST", body });
}
