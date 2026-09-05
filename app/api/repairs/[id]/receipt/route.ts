import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { generateReceipt, getRepair } from "@/lib/mongoStore";
import { renderReceiptHtml } from "@/lib/receipt";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const timer = startApiTimer("GET /api/repairs/[id]/receipt");
  try {
    const { id } = await params;
    const repair = await getRepair(id);
    if (!repair) return NextResponse.json({ error: "Repair not found." }, { status: 404 });
    timer.logSuccess(`returned ${id}`);
    return new NextResponse(renderReceiptHtml(repair), { headers: { "Content-Type": "text/html; charset=utf-8" } });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(_: NextRequest, { params }: Params) {
  const timer = startApiTimer("POST /api/repairs/[id]/receipt");
  try {
    const { id } = await params;
    const receipt = await generateReceipt(id);
    timer.logSuccess(`generated ${id}`);
    return NextResponse.json({ receipt });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
