import { NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { listMasters } from "@/lib/mongoStore";
import { REPAIR_STATUSES } from "@/lib/types";

export async function GET() {
  const timer = startApiTimer("GET /api/masters");
  try {
    const masters = await listMasters();
    timer.logSuccess();
    return NextResponse.json({
      ...masters,
      repairStatuses: REPAIR_STATUSES,
    });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Request failed." }, { status: 500 });
  }
}
