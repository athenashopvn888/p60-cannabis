import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { STAFF_BUCKET, publicError, staffDb } from "@/app/lib/staffPhotoDb";

export const runtime = "nodejs";

async function runCleanup() {
  try {
    const db = staffDb();
    const now = new Date().toISOString();
    const [{ data: expiredSubmissions, error: submissionError }, { data: expiredIssues, error: issueError }] = await Promise.all([
      db.from("staff_photo_submissions").select("id,object_path").lt("expires_at", now).not("object_path", "is", null),
      db.from("staff_photo_issues").select("id,attachment_path").lt("attachment_expires_at", now).not("attachment_path", "is", null),
    ]);
    if (submissionError || issueError) throw submissionError || issueError;
    const paths = [
      ...(expiredSubmissions || []).map((row) => row.object_path).filter(Boolean),
      ...(expiredIssues || []).map((row) => row.attachment_path).filter(Boolean),
    ];
    if (paths.length) {
      const { error } = await db.storage.from(STAFF_BUCKET).remove(paths);
      if (error) throw error;
    }
    const submissionIds = (expiredSubmissions || []).map((row) => row.id);
    const issueIds = (expiredIssues || []).map((row) => row.id);
    if (submissionIds.length) {
      const { error } = await db.from("staff_photo_submissions").update({ object_path: null, status: "expired" }).in("id", submissionIds);
      if (error) throw error;
    }
    if (issueIds.length) {
      const { error } = await db.from("staff_photo_issues").update({ attachment_path: null }).in("id", issueIds);
      if (error) throw error;
    }
    await db.from("staff_photo_login_attempts").delete().lt("created_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
    return Response.json({ ok: true, removedObjects: paths.length, expiredSubmissions: submissionIds.length, expiredIssueAttachments: issueIds.length });
  } catch (error) { return publicError(error); }
}

export async function GET(request: Request) {
  if (!verifyBearer(request, process.env.CRON_SECRET)) return Response.json({ ok: false }, { status: 401 });
  return runCleanup();
}

export async function POST(request: Request) {
  const token = process.env.PNY_STAFF_CLEANUP_TOKEN || process.env.PNY_STAFF_RETRIEVAL_TOKEN;
  if (!verifyBearer(request, token)) return Response.json({ ok: false }, { status: 401 });
  return runCleanup();
}
