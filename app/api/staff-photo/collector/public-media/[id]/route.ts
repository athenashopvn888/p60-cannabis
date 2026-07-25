import { getStaffMedia, publicError, readStaffState } from "@/app/lib/staffPhotoStore";
import { verifyStaffMediaSignature } from "@/app/lib/staffPhotoSignedMedia";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const url = new URL(request.url);
    const exp = url.searchParams.get("exp") || "";
    const signature = url.searchParams.get("sig") || "";
    if (!verifyStaffMediaSignature({
      id,
      exp,
      signature,
      secret: process.env.PNY_STAFF_RETRIEVAL_TOKEN,
    })) {
      return new Response(null, {
        status: 403,
        headers: {
          "cache-control": "private, no-store",
          "x-robots-tag": "noindex, nofollow, noarchive",
        },
      });
    }

    const state = await readStaffState();
    const submission = state.submissions.find((row) => row.id === id);
    const enhanced = state.enhancedMedia.find((row) => row.id === id);
    const objectPath = enhanced?.object_path || submission?.object_path;
    const mimeType = enhanced?.mime_type || submission?.mime_type;
    const expiresAt = enhanced?.expires_at || submission?.expires_at;
    if (!objectPath || !mimeType || !expiresAt) return new Response(null, { status: 404 });
    if (Date.parse(expiresAt) <= Date.now()) {
      return new Response(null, { status: 410 });
    }
    const media = await getStaffMedia(objectPath);
    if (!media || media.statusCode !== 200 || !media.stream) return new Response(null, { status: 404 });
    return new Response(media.stream, {
      headers: {
        "content-type": mimeType,
        "content-disposition": `inline; filename="${id}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-robots-tag": "noindex, nofollow, noarchive",
      },
    });
  } catch (error) {
    return publicError(error);
  }
}
