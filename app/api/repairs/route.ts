import { NextRequest, NextResponse } from "next/server";
import { createRepair, listRepairs } from "@/lib/mongoStore";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  return NextResponse.json({
    repairs: await listRepairs({
      status: search.get("status") ?? undefined,
      party: search.get("party") ?? undefined,
      productCode: search.get("productCode") ?? undefined,
      staff: search.get("staff") ?? undefined,
      repairNumber: search.get("repairNumber") ?? undefined,
      from: search.get("from") ?? undefined,
      to: search.get("to") ?? undefined,
    }),
  });
}

export async function POST(request: NextRequest) {
  try {
    const repair = await createRepair(await request.json());
    return NextResponse.json({ repair, warning: repair.photos.length === 0 ? "No photo attached yet." : undefined }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
