import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { repairsToCsv } from "@/lib/mongoStore";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const timer = startApiTimer("GET /api/repairs/export");
  try {
    const csv = await repairsToCsv({
      party: search.get("party") ?? undefined,
      person: search.get("person") ?? undefined,
      search: search.get("search") ?? undefined,
    });

    timer.logSuccess();
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=repairs-export.csv",
      },
    });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 500 });
  }
}
