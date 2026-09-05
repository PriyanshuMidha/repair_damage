import { NextRequest, NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { AUTH_COOKIE_NAME, verifyLogin } from "@/lib/auth";
import { clientIp, isRateLimited } from "@/lib/rateLimit";
import { signSession, SESSION_MAX_AGE_SECONDS } from "@/lib/session";

const LOGIN_ATTEMPT_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: NextRequest) {
  const timer = startApiTimer("POST /api/auth/login");
  try {
    if (isRateLimited(`login:${clientIp(request)}`, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_MS)) {
      timer.logSuccess("rejected: rate limited");
      return NextResponse.json({ error: "Too many login attempts. Try again later." }, { status: 429 });
    }
    const body = await request.json().catch(() => ({}));
    const username = typeof body?.username === "string" ? body.username.trim() : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!username || !password) {
      timer.logSuccess("rejected missing credentials");
      return NextResponse.json({ error: "Username and password are required." }, { status: 400 });
    }

    const user = await verifyLogin(username, password);
    if (!user) {
      timer.logSuccess("rejected invalid credentials");
      return NextResponse.json({ error: "Invalid username or password" }, { status: 401 });
    }

    const token = await signSession({ sub: user.id, name: user.name, role: user.role });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
    timer.logSuccess();
    return response;
  } catch (error) {
    timer.logError(error);
    return NextResponse.json({ error: "Login failed." }, { status: 500 });
  }
}
