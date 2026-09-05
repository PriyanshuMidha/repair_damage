import { config as loadEnv } from "dotenv";
import type { CapacitorConfig } from "@capacitor/cli";

loadEnv({ path: ".env.local", quiet: true });
loadEnv({ path: ".env", quiet: true });

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

if (!serverUrl || serverUrl.includes("your-deployed-repair-app.com")) {
  console.warn(
    "[capacitor.config.ts] CAPACITOR_SERVER_URL is not set to a real deployed URL. " +
      "The APK will bundle the placeholder capacitor-shell page instead of your live app.",
  );
}

const config: CapacitorConfig = {
  appId: "com.plazergarments.repairapp",
  appName: "Repair Control Room",
  webDir: "capacitor-shell",
  server: serverUrl
    ? {
        androidScheme: "https",
        cleartext: false,
        url: serverUrl,
      }
    : undefined,
};

export default config;
