import { createHash } from "node:crypto";
import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import {
  deleteStaffMedia,
  mutateStaffState,
  publicError,
  readStaffState,
  uploadStaffMedia,
} from "@/app/lib/staffPhotoStore";
import { createSignedStaffMediaUrl } from "@/app/lib/staffPhotoSignedMedia";
import { inspectImage } from "@/app/lib/staffPhotoUpload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function signedResponse(
  request: Request,
  mediaId: string,
  sourceSubmissionId: string,
  mediaExpiresAt: string,
) {
  const secret = process.env.PNY_STAFF_RETRIEVAL_TOKEN || "";
  const remainingSeconds = Math.floor((Date.parse(mediaExpiresAt) - Date.now()) / 1000);
  if (remainingSeconds < 1) throw new Error("Enhanced media has expired.");
  const signed = createSignedStaffMediaUrl({
    origin: new URL(request.url).origin,
    id: mediaId,
    secret,
    maxAgeSeconds: Math.min(5 * 60, remainingSeconds),
  });
  return Response.json(
    {
      ok: true,
      mediaId,
      sourceSubmissionId,
      sourceUrl: signed.url,
      sourceUrlExpiresAt: new Date(signed.expiresAt * 1000).toISOString(),
    },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) {
    return Response.json({ ok: false }, { status: 401 });
  }
  try {
    const form = await request.formData();
    const sourceSubmissionId = String(form.get("submissionId") || "").toLowerCase();
    if (!UUID_PATTERN.test(sourceSubmissionId)) {
      return Response.json({ ok: false, error: "Invalid submission id." }, { status: 400 });
    }

    const snapshot = await readStaffState();
    const source = snapshot.submissions.find((row) => row.id === sourceSubmissionId);
    if (!source) return Response.json({ ok: false, error: "Submission not found." }, { status: 404 });
    if (!["pending", "retrieved"].includes(source.status) || Date.parse(source.expires_at) <= Date.now()) {
      return Response.json(
        { ok: false, error: "Submission is no longer eligible for enhancement." },
        { status: 409 },
      );
    }
    const existing = snapshot.enhancedMedia.find(
      (row) =>
        row.source_submission_id === sourceSubmissionId &&
        Date.parse(row.expires_at) > Date.now(),
    );
    if (existing) {
      return signedResponse(request, existing.id, sourceSubmissionId, existing.expires_at);
    }

    const image = await inspectImage(form.get("photo"), "enhanced");
    if ("error" in image) {
      return Response.json({ ok: false, error: image.error }, { status: 400 });
    }
    const sha256 = createHash("sha256").update(image.bytes).digest("hex");
    const objectPath = await uploadStaffMedia(image.objectPath, image.bytes, image.mime);
    try {
      const result = await mutateStaffState((state) => {
        const currentSource = state.submissions.find((row) => row.id === sourceSubmissionId);
        if (
          !currentSource ||
          !["pending", "retrieved"].includes(currentSource.status) ||
          Date.parse(currentSource.expires_at) <= Date.now()
        ) {
          throw new Error("source-ineligible");
        }
        const raced = state.enhancedMedia.find(
          (row) =>
            row.source_submission_id === sourceSubmissionId &&
            Date.parse(row.expires_at) > Date.now(),
        );
        if (raced) return { created: false, mediaId: raced.id };
        state.enhancedMedia.push({
          id: image.id,
          source_submission_id: sourceSubmissionId,
          object_path: objectPath,
          original_name: image.originalName,
          mime_type: image.mime,
          byte_size: image.size,
          sha256,
          created_at: new Date().toISOString(),
          expires_at: currentSource.expires_at,
        });
        return { created: true, mediaId: image.id };
      });
      if (!result.created) await deleteStaffMedia(objectPath).catch(() => undefined);
      return signedResponse(request, result.mediaId, sourceSubmissionId, source.expires_at);
    } catch (error) {
      await deleteStaffMedia(objectPath).catch(() => undefined);
      if (error instanceof Error && error.message === "source-ineligible") {
        return Response.json(
          { ok: false, error: "Submission is no longer eligible for enhancement." },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    return publicError(error);
  }
}
