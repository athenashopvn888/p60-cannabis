import "server-only";
import {
  BlobAccessError,
  BlobPreconditionFailedError,
  del,
  get,
  put,
} from "@vercel/blob";

export const STAFF_STATE_PATH = "staff-photo/state/v1.json";
export const STAFF_MEDIA_PREFIX = "staff-photo/media/";

export type SubmissionState = "pending" | "retrieved" | "invalid" | "posted" | "expired";
export type IssueState = "open" | "retrieved";

export interface StaffSubmission {
  id: string;
  day_key: string;
  week_key: string;
  slot: number;
  prompt_key: string;
  object_path: string | null;
  original_name: string;
  mime_type: string;
  byte_size: number;
  status: SubmissionState;
  created_at: string;
  expires_at: string;
  retrieved_at: string | null;
  posted_at: string | null;
  validation_note: string | null;
}

export interface StaffIssue {
  id: string;
  day_key: string;
  category: string;
  note: string | null;
  status: IssueState;
  attachment_path: string | null;
  attachment_mime: string | null;
  attachment_bytes: number | null;
  created_at: string;
  attachment_expires_at: string | null;
  retrieved_at: string | null;
}

export interface StaffRandomCheck {
  day_key: string;
  check_key: string;
  question: string;
  result: "ok" | "issue";
  issue_id: string | null;
  completed_at: string;
}

export interface StaffPhotoState {
  schemaVersion: 1;
  pinVersion: number;
  updatedAt: string;
  submissions: StaffSubmission[];
  issues: StaffIssue[];
  randomChecks: StaffRandomCheck[];
  loginAttempts: Array<{ client_key: string; succeeded: boolean; created_at: string }>;
  pinAudit: Array<{ pin_version: number; rotated_at: string }>;
}

function ensureBlobConfigured() {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const hasOidc = Boolean(process.env.VERCEL_OIDC_TOKEN && process.env.BLOB_STORE_ID);
  if (!hasToken && !hasOidc) throw new Error("Private staff photo Blob storage is not configured.");
}

export function defaultStaffState(now = new Date()): StaffPhotoState {
  return {
    schemaVersion: 1,
    pinVersion: 1,
    updatedAt: now.toISOString(),
    submissions: [],
    issues: [],
    randomChecks: [],
    loginAttempts: [],
    pinAudit: [],
  };
}

function parseState(value: unknown): StaffPhotoState {
  if (!value || typeof value !== "object") throw new Error("Staff photo state is invalid.");
  const state = value as Partial<StaffPhotoState>;
  if (
    state.schemaVersion !== 1 ||
    !Number.isInteger(state.pinVersion) ||
    Number(state.pinVersion) < 1 ||
    !Array.isArray(state.submissions) ||
    !Array.isArray(state.issues) ||
    !Array.isArray(state.randomChecks) ||
    !Array.isArray(state.loginAttempts) ||
    !Array.isArray(state.pinAudit)
  ) {
    throw new Error("Staff photo state is invalid.");
  }
  return state as StaffPhotoState;
}

async function readStateVersion() {
  ensureBlobConfigured();
  const result = await get(STAFF_STATE_PATH, { access: "private", useCache: false });
  if (!result) {
    const state = defaultStaffState();
    try {
      const created = await put(STAFF_STATE_PATH, JSON.stringify(state), {
        access: "private",
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: false,
      });
      return { state, etag: created.etag };
    } catch (error) {
      if (!(error instanceof BlobAccessError)) throw error;
      const raced = await get(STAFF_STATE_PATH, { access: "private", useCache: false });
      if (!raced || raced.statusCode !== 200 || !raced.stream) throw error;
      const text = await new Response(raced.stream).text();
      return { state: parseState(JSON.parse(text)), etag: raced.blob.etag };
    }
  }
  if (result.statusCode !== 200 || !result.stream) throw new Error("Staff photo state could not be read.");
  const text = await new Response(result.stream).text();
  return { state: parseState(JSON.parse(text)), etag: result.blob.etag };
}

export async function readStaffState() {
  return (await readStateVersion()).state;
}

export async function mutateStaffState<T>(mutator: (draft: StaffPhotoState) => T | Promise<T>) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const { state, etag } = await readStateVersion();
    const draft = structuredClone(state);
    const result = await mutator(draft);
    draft.updatedAt = new Date().toISOString();
    try {
      await put(STAFF_STATE_PATH, JSON.stringify(draft), {
        access: "private",
        contentType: "application/json",
        cacheControlMaxAge: 60,
        allowOverwrite: etag !== null,
        ...(etag ? { ifMatch: etag } : {}),
      });
      return result;
    } catch (error) {
      if (error instanceof BlobPreconditionFailedError) continue;
      throw error;
    }
  }
  throw new Error("Staff photo state was busy. Please try again.");
}

export async function uploadStaffMedia(pathname: string, bytes: Uint8Array, contentType: string) {
  ensureBlobConfigured();
  const fullPath = `${STAFF_MEDIA_PREFIX}${pathname}`;
  await put(fullPath, Buffer.from(bytes), {
    access: "private",
    contentType,
    cacheControlMaxAge: 60,
    allowOverwrite: false,
  });
  return fullPath;
}

export async function getStaffMedia(pathname: string) {
  ensureBlobConfigured();
  return get(pathname, { access: "private", useCache: false });
}

export async function deleteStaffMedia(pathname: string | string[]) {
  ensureBlobConfigured();
  await del(pathname);
}

export function publicError(error: unknown) {
  console.error("Staff photo operation failed", error instanceof Error ? error.message : "unknown error");
  return Response.json(
    { ok: false, error: "The staff photo service is temporarily unavailable." },
    { status: 503 },
  );
}
