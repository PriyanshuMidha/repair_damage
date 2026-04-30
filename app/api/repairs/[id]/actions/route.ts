import { NextRequest, NextResponse } from "next/server";
import { performAction } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const role = body.role === "admin" ? "admin" : "staff";
    const repair = await performAction(id, body, role);
    return NextResponse.json({ repair });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
