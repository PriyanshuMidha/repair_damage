import { NextResponse } from "next/server";
import { mongoDb, isMongoConfigured } from "@/lib/mongodb";

export async function GET() {
  if (!isMongoConfigured()) {
    return NextResponse.json({ ok: false, mongo: "not_configured" }, { status: 503 });
  }

  try {
    const db = await mongoDb();
    await db.command({ ping: 1 });
    return NextResponse.json({ ok: true, mongo: "up", timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json(
      { ok: false, mongo: "down", error: error instanceof Error ? error.message : String(error) },
      { status: 503 },
    );
  }
}
