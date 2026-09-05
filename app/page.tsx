import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE_NAME, verifySession } from "@/lib/session";

export default async function Home() {
  const cookieStore = await cookies();
  const session = await verifySession(cookieStore.get(AUTH_COOKIE_NAME)?.value);
  redirect(session ? "/repairs" : "/login");
}
