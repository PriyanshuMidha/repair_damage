import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { getRepair, softDeleteRepair, updateRepairWhileReceived } from "@/lib/mongoStore";
import { updateRepairSchema, formatZodError } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const timer = startApiTimer("GET /api/repairs/[id]");
  try {
    const { id } = await params;
    const repair = await getRepair(id);
    if (!repair) return NextResponse.json({ error: "Repair not found." }, { status: 404 });
    timer.logSuccess(`returned ${id}`);
    return NextResponse.json({ repair });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const timer = startApiTimer("PATCH /api/repairs/[id]");
  try {
    const { id } = await params;
    const parsed = updateRepairSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = formatZodError(parsed.error);
      timer.logSuccess(`rejected invalid payload: ${message}`);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const repair = await updateRepairWhileReceived(id, parsed.data);
    timer.logSuccess(`updated ${id}`);
    return NextResponse.json({ repair });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const timer = startApiTimer("DELETE /api/repairs/[id]");
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const repair = await softDeleteRepair(id, typeof body?.deleteReason === "string" ? body.deleteReason : undefined);
    timer.logSuccess(`deleted ${id}`);
    return NextResponse.json({ repair });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
