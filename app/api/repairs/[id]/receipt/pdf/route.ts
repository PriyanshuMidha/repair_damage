import { NextRequest, NextResponse } from "next/server";
import { getRepair } from "@/lib/mongoStore";
import { buildPdfBytes } from "@/lib/receipt";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: NextRequest, { params }: Params) {
  const { id } = await params;
  const repair = await getRepair(id);
  if (!repair) return NextResponse.json({ error: "Repair not found." }, { status: 404 });

  return new NextResponse(buildPdfBytes(repair), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${repair.repairNumber}.pdf"`,
    },
  });
}
