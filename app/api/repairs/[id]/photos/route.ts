import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { uploadPhoto } from "@/lib/mongoStore";

type Params = { params: Promise<{ id: string }> };
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const contentType = request.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
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
      const extension = extensionFor(file.name, file.type);
      const safeName = `${Date.now()}-${crypto.randomUUID()}${extension}`;
      const uploadDir = join(process.cwd(), "public", "uploads", "repairs", id);
      await mkdir(uploadDir, { recursive: true });
      await writeFile(join(uploadDir, safeName), bytes);

      const photo = await uploadPhoto(id, file.name, `/uploads/repairs/${id}/${safeName}`, kind);
      return NextResponse.json({ photo }, { status: 201 });
    }

    const body = await request.json();
    const photo = await uploadPhoto(id, body.fileName, body.url, body.kind === "proof" ? "proof" : "product");
    return NextResponse.json({ photo }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 400 });
  }
}

function errorMessage(error: unknown) {
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
