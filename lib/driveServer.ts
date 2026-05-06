import "server-only";

import { google } from "googleapis";
import { Readable } from "node:stream";
import { normalizePhotoLink } from "./drive";

const DEFAULT_DRIVE_FOLDER_ID = "11sBIg88exFVOEnkO5xg7sCEALVfhzAr2";

export async function uploadImageToDrive(input: { fileName: string; mimeType: string; bytes: Buffer }) {
  const drive = google.drive({ version: "v3", auth: googleServiceAccountAuth() });
  await assertDriveFolderAccess(drive, googleDriveFolderId());
  const file = await drive.files.create({
    requestBody: {
      name: safeFileName(input.fileName),
      parents: [googleDriveFolderId()],
      mimeType: input.mimeType,
    },
    media: {
      mimeType: input.mimeType,
      body: Readable.from(input.bytes),
    },
    fields: "id,name,mimeType,webViewLink",
    supportsAllDrives: true,
  });

  const fileId = file.data.id;
  if (!fileId) throw new Error("Google Drive upload succeeded but no file ID was returned.");

  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
    supportsAllDrives: true,
  });

  return normalizePhotoLink(file.data.webViewLink ?? `https://drive.google.com/file/d/${fileId}/view`, file.data.name ?? input.fileName);
}

export async function debugDriveConnection() {
  const env = {
    email: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()),
    privateKey: Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()),
    folderId: Boolean(process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID),
  };

  const rawPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY ?? "";
  const privateKey = rawPrivateKey.replace(/\\n/g, "\n");
  const privateKeyChecks = {
    startsWithBegin: privateKey.startsWith("-----BEGIN PRIVATE KEY-----"),
    includesEnd: privateKey.includes("-----END PRIVATE KEY-----"),
  };

  const auth = googleServiceAccountAuth();
  await auth.authorize();
  const drive = google.drive({ version: "v3", auth });
  await assertDriveFolderAccess(drive, googleDriveFolderId());

  return {
    env,
    privateKeyChecks,
    auth: "ok" as const,
    folderAccess: "ok" as const,
  };
}

export function googleServiceAccountConfigError() {
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()) return "GOOGLE_SERVICE_ACCOUNT_EMAIL is missing.";
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.trim()) return "GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is missing.";
  return "";
}

function googleDriveFolderId() {
  return process.env.GOOGLE_DRIVE_FOLDER_ID?.trim() || DEFAULT_DRIVE_FOLDER_ID;
}

function googleServiceAccountAuth() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) {
    throw new Error(googleServiceAccountConfigError() || "Google service account is not configured.");
  }

  return new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
}

async function assertDriveFolderAccess(drive: ReturnType<typeof google.drive>, folderId: string) {
  try {
    const folder = await drive.files.get({
      fileId: folderId,
      fields: "id,name,mimeType",
      supportsAllDrives: true,
    });

    if (folder.data.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("Configured Google Drive ID is not a folder.");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Google Drive error.";
    throw new Error(`Google Drive folder access failed for folder ${folderId}. ${message}`);
  }
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^\w.\- ]+/g, "_");
}
