import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { createRepair, listRepairs } from "@/lib/mongoStore";
import { createRepairSchema, formatZodError } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const timer = startApiTimer("GET /api/repairs");
  try {
    const repairs = await listRepairs({
      party: search.get("party") ?? undefined,
      person: search.get("person") ?? undefined,
      status: search.get("status") ?? undefined,
      search: search.get("search") ?? undefined,
    });
    timer.logSuccess(`returned ${repairs.length} repairs`);
    return NextResponse.json({ repairs });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const timer = startApiTimer("POST /api/repairs");
  try {
    const parsed = createRepairSchema.safeParse(await request.json());
    if (!parsed.success) {
      const message = formatZodError(parsed.error);
      timer.logSuccess(`rejected invalid payload: ${message}`);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    const repair = await createRepair(parsed.data);
    timer.logSuccess(`created ${repair.id}`);
    return NextResponse.json({ repair }, { status: 201 });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
