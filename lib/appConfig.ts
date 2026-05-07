export const APP_NAME = "Repair Control Room";

export function getPublicAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim() || "";
}

export function buildAbsoluteUrl(path: string, fallbackOrigin?: string) {
  const baseUrl = getPublicAppUrl() || fallbackOrigin?.trim() || "";
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
