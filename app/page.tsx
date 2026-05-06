import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, AUTH_SESSION_VALUE } from "@/lib/auth";

export default async function Home() {
  const cookieStore = await cookies();
  const isAuthenticated = cookieStore.get(AUTH_COOKIE_NAME)?.value === AUTH_SESSION_VALUE;
  redirect(isAuthenticated ? "/repairs" : "/login");
}
