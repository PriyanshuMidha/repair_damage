import { NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { AUTH_COOKIE_NAME } from "@/lib/auth";

export async function POST() {
  const timer = startApiTimer("POST /api/auth/logout");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  timer.logSuccess();
  return response;
}
