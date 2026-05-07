import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizePhotoLink } from "@/lib/drive";
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

    const storedPhoto = await storePhotoFile({
      bytes: Buffer.from(await file.arrayBuffer()),
      fileName: file.name || `repair-photo${extensionFor(file.name, file.type)}`,
      id,
      mimeType: file.type,
    });
    const photo = await uploadPhoto(id, storedPhoto.fileName, storedPhoto.url, kind, {
      previewUrl: storedPhoto.previewUrl,
      driveFileId: storedPhoto.driveFileId,
      linkType: storedPhoto.linkType,
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

async function storePhotoFile(input: { bytes: Buffer; fileName: string; id: string; mimeType: string }) {
  const storageMode = process.env.STORAGE_MODE?.trim().toLowerCase() || "auto";
  const shouldTryDrive = storageMode !== "local";

  if (shouldTryDrive) {
    try {
      return await uploadImageToDrive(input);
    } catch (error) {
      if (storageMode === "drive") {
        throw error;
      }
    }
  }

  return savePhotoLocally(input);
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

async function savePhotoLocally(input: { bytes: Buffer; fileName: string; id: string; mimeType: string }) {
  const extension = extensionFor(input.fileName, input.mimeType);
  const normalizedName = safeFileName(input.fileName.replace(/\.[^/.]+$/, "") || "repair-photo");
  const fileName = `${Date.now()}-${normalizedName}${extension}`;
  const absoluteDir = join(process.cwd(), "public", "uploads", "repairs", input.id);
  await mkdir(absoluteDir, { recursive: true });
  await writeFile(join(absoluteDir, fileName), input.bytes);
  return normalizePhotoLink(`/uploads/repairs/${encodeURIComponent(input.id)}/${encodeURIComponent(fileName)}`, fileName);
}

function safeFileName(fileName: string) {
  return fileName.replace(/[^\w.\- ]+/g, "_").trim() || "repair-photo";
}
