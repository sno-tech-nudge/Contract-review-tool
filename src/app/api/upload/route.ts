import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { jsonError, MAX_UPLOAD_BYTES } from "@/lib/api";
import { ACCEPTED_TYPES } from "@/lib/extract";
import { blobEnabled, UPLOAD_PREFIX } from "@/lib/storage";

// Issues short-lived tokens so the browser can upload a contract straight to
// the private Blob store. The proxy (sign-in check) protects this route.
export async function POST(request: Request) {
  if (!blobEnabled()) return jsonError("Direct uploads are not configured.", 400);
  const body = (await request.json()) as HandleUploadBody;
  try {
    const result = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(UPLOAD_PREFIX) || !/\.(pdf|docx|txt)$/i.test(pathname)) throw new Error("Only PDF, Word or text files can be uploaded.");
        return {
          allowedContentTypes: Object.values(ACCEPTED_TYPES),
          maximumSizeInBytes: MAX_UPLOAD_BYTES,
          addRandomSuffix: true,
        };
      },
    });
    return NextResponse.json(result);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed.", 400);
  }
}
