import { NextResponse } from "next/server";
import { listMasters } from "@/lib/mongoStore";
import { DAMAGE_CATEGORIES, DELIVERY_MODES, REPAIR_STATUSES } from "@/lib/types";

export async function GET() {
  return NextResponse.json({
    ...(await listMasters()),
    damageCategories: DAMAGE_CATEGORIES,
    deliveryModes: DELIVERY_MODES,
    repairStatuses: REPAIR_STATUSES,
  });
}
