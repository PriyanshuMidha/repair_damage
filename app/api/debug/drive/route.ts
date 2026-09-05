import { NextResponse } from "next/server";
import { startApiTimer } from "@/lib/apiTiming";
import { debugDriveConnection } from "@/lib/driveServer";

export async function GET() {
  const timer = startApiTimer("GET /api/debug/drive");
  try {
    const result = await debugDriveConnection();
    timer.logSuccess();
    return NextResponse.json(result);
  } catch (error) {
    timer.logError(error);
    return NextResponse.json(
      {
        env: {
          email: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()),
          privateKey: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()),
          folderId: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim()),
        },
        privateKeyChecks: {
          startsWithBegin: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").startsWith("-----BEGIN PRIVATE KEY-----") ?? false,
          includesEnd: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n").includes("-----END PRIVATE KEY-----") ?? false,
        },
        auth: "fail",
        folderAccess: "fail",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
