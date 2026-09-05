import "server-only";

import { DeleteObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { normalizePhotoLink } from "./drive";

const DEFAULT_R2_UPLOAD_LIMIT_BYTES = 9.5 * 1024 * 1024 * 1024;
const R2_USAGE_CACHE_MS = 60 * 1000;
let usageCache: { bytes: number; checkedAt: number } | undefined;

export function r2ConfigError() {
  if (!process.env.R2_ACCOUNT_ID?.trim()) return "R2_ACCOUNT_ID is missing.";
  if (!process.env.R2_ACCESS_KEY_ID?.trim()) return "R2_ACCESS_KEY_ID is missing.";
  if (!process.env.R2_SECRET_ACCESS_KEY?.trim()) return "R2_SECRET_ACCESS_KEY is missing.";
  if (!process.env.R2_BUCKET_NAME?.trim()) return "R2_BUCKET_NAME is missing.";
  if (!process.env.R2_PUBLIC_BASE_URL?.trim()) return "R2_PUBLIC_BASE_URL is missing.";
  return "";
}

export function isR2Configured() {
  return !r2ConfigError();
}

export async function uploadImageToR2(input: { bytes: Buffer; fileName: string; id: string; mimeType: string }) {
  const configError = r2ConfigError();
  if (configError) throw new Error(configError);

  const bucket = process.env.R2_BUCKET_NAME!.trim();
  const key = buildObjectKey(input.id, input.fileName);
  const client = r2Client();
  await assertR2StorageAvailable(client, bucket, input.bytes.byteLength);

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: input.bytes,
      ContentType: input.mimeType,
    }),
  );

  const publicBaseUrl = process.env.R2_PUBLIC_BASE_URL!.trim().replace(/\/$/, "");
  usageCache = usageCache ? { bytes: usageCache.bytes + input.bytes.byteLength, checkedAt: Date.now() } : undefined;
  return {
    ...normalizePhotoLink(`${publicBaseUrl}/${key.split("/").map(encodeURIComponent).join("/")}`, input.fileName),
    linkType: "r2-object" as const,
    storageKey: key,
  };
}

export async function deleteImageFromR2(storageKey: string) {
  const configError = r2ConfigError();
  if (configError) throw new Error(configError);

  await r2Client().send(
    new DeleteObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!.trim(),
      Key: storageKey,
    }),
  );

  usageCache = undefined;
}

async function assertR2StorageAvailable(client: S3Client, bucket: string, nextUploadBytes: number) {
  const limitBytes = r2UploadLimitBytes();
  const usedBytes = await r2UsedBytes(client, bucket);
  if (usedBytes + nextUploadBytes <= limitBytes) return;

  throw new Error(
    `R2 storage limit reached. Current app storage is ${formatGb(usedBytes)}, this photo is ${formatGb(nextUploadBytes)}, and the upload limit is ${formatGb(
      limitBytes,
    )}. Delete old photos to reduce storage before uploading more.`,
  );
}

async function r2UsedBytes(client: S3Client, bucket: string) {
  const now = Date.now();
  if (usageCache && now - usageCache.checkedAt < R2_USAGE_CACHE_MS) return usageCache.bytes;

  let continuationToken: string | undefined;
  let bytes = 0;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: process.env.R2_USAGE_PREFIX?.trim() || "repairs/",
        ContinuationToken: continuationToken,
      }),
    );
    for (const object of response.Contents ?? []) {
      bytes += object.Size ?? 0;
    }
    continuationToken = response.NextContinuationToken;
  } while (continuationToken);

  usageCache = { bytes, checkedAt: now };
  return bytes;
}

function r2Client() {
  const accountId = process.env.R2_ACCOUNT_ID!.trim();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!.trim(),
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!.trim(),
    },
  });
}

function buildObjectKey(repairId: string, fileName: string) {
  const extension = extensionFor(fileName);
  const baseName = safePathPart(fileName.replace(/\.[^/.]+$/, "") || "repair-photo");
  return `repairs/${safePathPart(repairId)}/${Date.now()}-${baseName}${extension}`;
}

function r2UploadLimitBytes() {
  const configuredGb = Number(process.env.R2_UPLOAD_LIMIT_GB);
  if (Number.isFinite(configuredGb) && configuredGb > 0) {
    return configuredGb * 1024 * 1024 * 1024;
  }
  return DEFAULT_R2_UPLOAD_LIMIT_BYTES;
}

function formatGb(bytes: number) {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

function extensionFor(fileName: string) {
  const lowerName = fileName.toLowerCase();
  return [".jpg", ".jpeg", ".png", ".webp", ".gif"].find((extension) => lowerName.endsWith(extension)) ?? ".jpg";
}

function safePathPart(value: string) {
  return value.replace(/[^\w.\-]+/g, "_").replace(/^_+|_+$/g, "") || "repair-photo";
}
