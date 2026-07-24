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
    if (!submission?.object_path) return new Response(null, { status: 404 });
    if (Date.parse(submission.expires_at) <= Date.now()) {
      return new Response(null, { status: 410 });
    }
    const media = await getStaffMedia(submission.object_path);
    if (!media || media.statusCode !== 200 || !media.stream) return new Response(null, { status: 404 });
    return new Response(media.stream, {
      headers: {
        "content-type": submission.mime_type,
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
