import { NextRequest, NextResponse } from "next/server";
import { uploadPhoto } from "@/lib/mongoStore";
import { googleServiceAccountConfigError, uploadImageToDrive } from "@/lib/driveServer";

type Params = { params: Promise<{ id: string }> };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      throw new Error("Photo upload must be sent as a file.");
    }

    const formData = await request.formData();
    const file = formData.get("photo");
    const kind = formData.get("kind") === "proof" ? "proof" : "product";
    if (!(file instanceof File)) {
      throw new Error("Photo file is required.");
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      throw new Error("Only JPG, PNG, WEBP, or GIF images are allowed.");
    }
    if (file.size > MAX_PHOTO_BYTES) {
      throw new Error("Photo must be 5 MB or smaller.");
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadImageToDrive({ fileName: file.name || `repair-photo${extensionFor(file.name, file.type)}`, mimeType: file.type, bytes });
    const photo = await uploadPhoto(id, driveFile.fileName, driveFile.url, kind, {
      previewUrl: driveFile.previewUrl,
      driveFileId: driveFile.driveFileId,
      linkType: driveFile.linkType,
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error && /GOOGLE_SERVICE_ACCOUNT_|Google service account|Google Drive folder access failed/.test(error.message)) {
    return `${error.message} Share the Google Drive folder with the service account email before uploading.`;
  }
  if (!googleServiceAccountConfigError()) {
    return error instanceof Error ? error.message : "Request failed.";
  }
  return error instanceof Error ? error.message : "Request failed.";
}

function extensionFor(fileName: string, mimeType: string) {
  const lowerName = fileName.toLowerCase();
  const existing = [".jpg", ".jpeg", ".png", ".webp", ".gif"].find((extension) => lowerName.endsWith(extension));
  if (existing) return existing;
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/gif") return ".gif";
  return ".jpg";
}
