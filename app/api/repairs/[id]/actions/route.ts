import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { performAction } from "@/lib/mongoStore";
import { getSessionFromRequest } from "@/lib/session";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const timer = startApiTimer("POST /api/repairs/[id]/actions");
  try {
    const { id } = await params;
    const session = await getSessionFromRequest(request);
    if (!session) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    const body = await request.json();
    const repair = await performAction(id, body, session.role);
    timer.logSuccess(`${body.action ?? "action"} ${id}`);
    return NextResponse.json({ repair });
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}
