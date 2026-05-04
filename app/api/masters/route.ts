import { NextResponse } from "next/server";
import { listMasters } from "@/lib/mongoStore";
import { REPAIR_STATUSES } from "@/lib/types";

export async function GET() {
  return NextResponse.json({
    ...(await listMasters()),
    repairStatuses: REPAIR_STATUSES,
  });
}
