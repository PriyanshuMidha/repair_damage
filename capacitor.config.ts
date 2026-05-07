import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();

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
