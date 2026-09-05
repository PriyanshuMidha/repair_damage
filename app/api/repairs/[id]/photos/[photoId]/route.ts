import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { deletePhoto } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string; photoId: string }> };

export async function DELETE(request: NextRequest, { params }: Params) {
  const timer = startApiTimer("DELETE /api/repairs/[id]/photos/[photoId]");
  try {
    const { id, photoId } = await params;
    const configuredPassword = photoDeletePassword();
    if (!configuredPassword) {
      timer.logSuccess("rejected: PHOTO_DELETE_PASSWORD not configured");
      return NextResponse.json({ error: "Photo deletion is not configured on this server." }, { status: 500 });
    }
    const body = await request.json().catch(() => ({}));
    const password = typeof body?.password === "string" ? body.password : "";
    if (password !== configuredPassword) {
      timer.logSuccess(`rejected invalid password for ${photoId}`);
      return NextResponse.json({ error: "Photo delete password is incorrect." }, { status: 403 });
    }

    const repair = await deletePhoto(id, photoId);
    timer.logSuccess(`deleted ${photoId} from ${id}`);
    return NextResponse.json({ repair });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 400 });
  }
}

function photoDeletePassword() {
  return process.env.PHOTO_DELETE_PASSWORD?.trim() || "";
}
