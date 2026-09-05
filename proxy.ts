import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/session";

async function isAuthenticated(request: NextRequest) {
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;
  return (await verifySession(token)) !== null;
}

function loginUrl(request: NextRequest) {
  return new URL("/login", request.url);
}

const MUTATING_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

function isSameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin") ?? request.headers.get("referer");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.nextUrl.host;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = await isAuthenticated(request);

  if (pathname === "/login") {
    if (authenticated) {
      return NextResponse.redirect(new URL("/repairs", request.url));
    }
    return NextResponse.next();
  }

  const isProtectedPage = pathname === "/" || pathname.startsWith("/repairs");
  const isProtectedApi = pathname.startsWith("/api/repairs") || pathname === "/api/masters";

  if (!authenticated && isProtectedPage) {
    return NextResponse.redirect(loginUrl(request));
  }

  if (!authenticated && isProtectedApi) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (isProtectedApi && MUTATING_METHODS.has(request.method) && !isSameOrigin(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/repairs/:path*", "/api/repairs/:path*", "/api/masters"],
};
