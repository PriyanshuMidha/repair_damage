import { NextRequest, NextResponse } from "next/server";
import { generateReceipt, getRepair } from "@/lib/mongoStore";
import { renderReceiptHtml } from "@/lib/receipt";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const repair = await getRepair(id);
  if (!repair) return NextResponse.json({ error: "Repair not found." }, { status: 404 });
  return new NextResponse(renderReceiptHtml(repair), { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function POST(_: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const receipt = await generateReceipt(id);
    return NextResponse.json({ receipt });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
