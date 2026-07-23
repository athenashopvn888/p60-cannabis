import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { mutateStaffState, publicError } from "@/app/lib/staffPhotoStore";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return Response.json({ ok: false }, { status: 401 });
  try {
    const rotatedAt = new Date().toISOString();
    const pinVersion = await mutateStaffState((state) => {
      state.pinVersion += 1;
      state.pinAudit.push({ pin_version: state.pinVersion, rotated_at: rotatedAt });
      return state.pinVersion;
    });
    return Response.json({ ok: true, pinVersion, rotatedAt });
  } catch (error) { return publicError(error); }
}
