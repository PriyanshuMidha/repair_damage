import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./types";

export const AUTH_COOKIE_NAME = "repair_app_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

export type SessionPayload = {
  sub: string;
  name: string;
  role: Role;
};

function secretKey() {
  const secret = process.env.AUTH_JWT_SECRET?.trim();
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_JWT_SECRET is missing. Set it in the server environment.");
  }
  return new TextEncoder().encode("dev-only-insecure-secret-do-not-use-in-production");
}

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ name: payload.name, role: payload.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.name !== "string") return null;
    if (payload.role !== "staff" && payload.role !== "admin") return null;
    return { sub: payload.sub, name: payload.name, role: payload.role };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_SECONDS;

export async function getSessionFromRequest(request: { cookies: { get(name: string): { value: string } | undefined } }) {
  return verifySession(request.cookies.get(AUTH_COOKIE_NAME)?.value);
}
