import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { deleteStaffMedia, mutateStaffState, publicError, readStaffState } from "@/app/lib/staffPhotoStore";

export const runtime = "nodejs";

async function runCleanup() {
  try {
    const snapshot = await readStaffState();
    const now = Date.now();
    const expiredSubmissions = snapshot.submissions.filter((row) => row.object_path && Date.parse(row.expires_at) <= now);
    const expiredIssues = snapshot.issues.filter((row) => row.attachment_path && row.attachment_expires_at && Date.parse(row.attachment_expires_at) <= now);
    const paths = [
      ...expiredSubmissions.map((row) => row.object_path),
      ...expiredIssues.map((row) => row.attachment_path),
    ].filter((path): path is string => Boolean(path));
    if (paths.length) await deleteStaffMedia(paths);
    const submissionIds = new Set(expiredSubmissions.map((row) => row.id));
    const issueIds = new Set(expiredIssues.map((row) => row.id));
    await mutateStaffState((state) => {
      for (const row of state.submissions) {
        if (submissionIds.has(row.id)) {
          row.object_path = null;
          row.status = "expired";
        }
      }
      for (const row of state.issues) {
        if (issueIds.has(row.id)) row.attachment_path = null;
      }
      state.loginAttempts = state.loginAttempts.filter((attempt) => Date.parse(attempt.created_at) >= now - 24 * 60 * 60_000);
    });
    return Response.json({ ok: true, removedObjects: paths.length, expiredSubmissions: submissionIds.size, expiredIssueAttachments: issueIds.size });
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
