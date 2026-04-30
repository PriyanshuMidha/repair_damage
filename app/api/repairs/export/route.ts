import { NextRequest, NextResponse } from "next/server";
import { repairsToCsv } from "@/lib/mongoStore";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const csv = await repairsToCsv({
    status: search.get("status") ?? undefined,
    party: search.get("party") ?? undefined,
    productCode: search.get("productCode") ?? undefined,
    staff: search.get("staff") ?? undefined,
    repairNumber: search.get("repairNumber") ?? undefined,
    from: search.get("from") ?? undefined,
    to: search.get("to") ?? undefined,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=repairs-export.csv",
    },
  });
}
