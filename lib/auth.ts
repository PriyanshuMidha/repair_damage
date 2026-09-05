import bcrypt from "bcryptjs";
import { findAuthUserByUsername } from "./mongoStore";

export { AUTH_COOKIE_NAME } from "./session";

export async function verifyLogin(username: string, password: string) {
  const user = await findAuthUserByUsername(username);
  if (!user) return null;

  const isValid = user.passwordHash
    ? await bcrypt.compare(password, user.passwordHash)
    : user.password === password;

  if (!isValid) return null;

  return { id: user.id, name: user.name, role: user.role };
}
