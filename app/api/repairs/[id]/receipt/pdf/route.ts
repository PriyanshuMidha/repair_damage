import { NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { getRepair } from "@/lib/mongoStore";
import { buildPdfBytes } from "@/lib/receipt";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  const timer = startApiTimer("GET /api/repairs/[id]/receipt/pdf");
  try {
    const { id } = await params;
    const repair = await getRepair(id);
    if (!repair) return NextResponse.json({ error: "Repair not found." }, { status: 404 });

    timer.logSuccess(`returned ${id}`);
    return new NextResponse(buildPdfBytes(repair), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${repair.repairNumber}.pdf"`,
      },
    });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 500 });
  }
}
