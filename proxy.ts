import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME, AUTH_SESSION_VALUE } from "@/lib/auth";

function isAuthenticated(request: NextRequest) {
  return request.cookies.get(AUTH_COOKIE_NAME)?.value === AUTH_SESSION_VALUE;
}

function loginUrl(request: NextRequest) {
  return new URL("/login", request.url);
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);

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

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login", "/repairs/:path*", "/api/repairs/:path*", "/api/masters"],
};
