import { NextRequest, NextResponse } from "next/server";
import { getRepair, softDeleteRepair, updateRepairWhileReceived } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repair = await getRepair(id);
    if (!repair) return NextResponse.json({ error: "Repair not found." }, { status: 404 });
    return NextResponse.json({ repair });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const repair = await updateRepairWhileReceived(id, await request.json());
    return NextResponse.json({ repair });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const repair = await softDeleteRepair(id, typeof body?.deleteReason === "string" ? body.deleteReason : undefined);
    return NextResponse.json({ repair });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
