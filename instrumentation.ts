export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { isMongoConfigured, mongoConfigError } = await import("@/lib/mongodb");

  if (!isMongoConfigured() && process.env.NODE_ENV === "production") {
    console.error(`[repair-app] Startup check failed: ${mongoConfigError()}`);
  }
}
