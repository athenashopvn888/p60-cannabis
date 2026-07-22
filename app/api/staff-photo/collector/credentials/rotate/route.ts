import { verifyBearer } from "@/app/lib/staffPhotoAuth";
import { publicError, staffDb } from "@/app/lib/staffPhotoDb";

export async function POST(request: Request) {
  if (!verifyBearer(request, process.env.PNY_STAFF_RETRIEVAL_TOKEN)) return Response.json({ ok: false }, { status: 401 });
  try {
    const { data, error } = await staffDb().rpc("rotate_staff_photo_pin");
    if (error) throw error;
    return Response.json({ ok: true, pinVersion: data, rotatedAt: new Date().toISOString() });
  } catch (error) { return publicError(error); }
}
