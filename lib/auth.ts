export const AUTH_COOKIE_NAME = "repair_app_session";
export const AUTH_SESSION_VALUE = "authenticated";
export const LOGIN_USERNAME = "admin";
export const LOGIN_PASSWORD = "Plazer@123";

export function isValidLogin(username: string, password: string) {
  return username === LOGIN_USERNAME && password === LOGIN_PASSWORD;
}
