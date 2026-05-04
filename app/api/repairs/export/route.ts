import { NextRequest, NextResponse } from "next/server";
import { repairsToCsv } from "@/lib/mongoStore";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const csv = await repairsToCsv({
    party: search.get("party") ?? undefined,
    person: search.get("person") ?? undefined,
    search: search.get("search") ?? undefined,
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=repairs-export.csv",
    },
  });
}
