import "server-only";

import { v2 as cloudinary, type UploadApiOptions, type UploadApiResponse } from "cloudinary";
import { normalizePhotoLink } from "./drive";

export function cloudinaryConfigError() {
  if (!process.env.CLOUDINARY_CLOUD_NAME?.trim()) return "CLOUDINARY_CLOUD_NAME is missing.";
  if (!process.env.CLOUDINARY_API_KEY?.trim()) return "CLOUDINARY_API_KEY is missing.";
  if (!process.env.CLOUDINARY_API_SECRET?.trim()) return "CLOUDINARY_API_SECRET is missing.";
  return "";
}

export function isCloudinaryConfigured() {
  return !cloudinaryConfigError();
}

export async function uploadImageToCloudinary(input: { bytes: Buffer; fileName: string; id: string; mimeType: string }) {
  const configError = cloudinaryConfigError();
  if (configError) throw new Error(configError);

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME?.trim(),
    api_key: process.env.CLOUDINARY_API_KEY?.trim(),
    api_secret: process.env.CLOUDINARY_API_SECRET?.trim(),
    secure: true,
  });

  const folder = process.env.CLOUDINARY_FOLDER?.trim() || "repair-app/repairs";
  const result = await uploadBuffer(input.bytes, {
    folder: `${folder}/${safePathPart(input.id)}`,
    public_id: safePublicId(input.fileName),
    resource_type: "image",
    overwrite: false,
    use_filename: true,
    unique_filename: true,
  });

  if (!result.secure_url) {
    throw new Error("Cloudinary upload succeeded but no secure URL was returned.");
  }

  return normalizePhotoLink(result.secure_url, result.original_filename || input.fileName);
}

function uploadBuffer(bytes: Buffer, options: UploadApiOptions) {
  return new Promise<UploadApiResponse>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        reject(error);
        return;
      }
      if (!result) {
        reject(new Error("Cloudinary upload failed without a response."));
        return;
      }
      resolve(result);
    });

    stream.end(bytes);
  });
}

function safePublicId(fileName: string) {
  return safePathPart(fileName.replace(/\.[^/.]+$/, "") || "repair-photo");
}

function safePathPart(value: string) {
  return value.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "repair-photo";
}
