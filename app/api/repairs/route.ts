import { NextRequest, NextResponse } from "next/server";
import { createRepair, listRepairs } from "@/lib/mongoStore";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  try {
    return NextResponse.json({
      repairs: await listRepairs({
        party: search.get("party") ?? undefined,
        person: search.get("person") ?? undefined,
        status: search.get("status") ?? undefined,
        search: search.get("search") ?? undefined,
      }),
    });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const repair = await createRepair(await request.json());
    return NextResponse.json({ repair }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
