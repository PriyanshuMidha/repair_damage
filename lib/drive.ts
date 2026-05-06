export type StoredPhotoLinkType = "drive-file" | "drive-folder" | "external-image" | "external-link" | "local-file";

export type NormalizedPhotoLink = {
  fileName: string;
  url: string;
  previewUrl?: string;
  driveFileId?: string;
  linkType: StoredPhotoLinkType;
};

export function normalizePhotoLink(url: string, fileName = "repair-photo.jpg"): NormalizedPhotoLink {
  const trimmedUrl = url.trim();
  const trimmedName = fileName.trim() || "repair-photo.jpg";
  const localPath = trimmedUrl.startsWith("/");
  if (localPath) {
    return { fileName: trimmedName, url: trimmedUrl, previewUrl: trimmedUrl, linkType: "local-file" };
  }

  const folderId = extractDriveFolderId(trimmedUrl);
  if (folderId) {
    return {
      fileName: trimmedName,
      url: `https://drive.google.com/drive/folders/${folderId}`,
      linkType: "drive-folder",
    };
  }

  const fileId = extractDriveFileId(trimmedUrl);
  if (fileId) {
    return {
      fileName: trimmedName,
      url: `https://drive.google.com/file/d/${fileId}/view`,
      previewUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w1200`,
      driveFileId: fileId,
      linkType: "drive-file",
    };
  }

  if (looksLikeImageUrl(trimmedUrl)) {
    return {
      fileName: trimmedName,
      url: trimmedUrl,
      previewUrl: trimmedUrl,
      linkType: "external-image",
    };
  }

  return {
    fileName: trimmedName,
    url: trimmedUrl,
    linkType: "external-link",
  };
}

export function isPreviewablePhoto(photo: { previewUrl?: string; linkType?: StoredPhotoLinkType; url: string }) {
  if (photo.previewUrl) return true;
  if (photo.linkType === "drive-folder" || photo.linkType === "external-link") return false;
  return looksLikeImageUrl(photo.url) || photo.url.startsWith("/");
}

function extractDriveFolderId(url: string) {
  const match = url.match(/drive\/folders\/([a-zA-Z0-9_-]+)/);
  return match?.[1];
}

function extractDriveFileId(url: string) {
  const fileMatch = url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
  if (fileMatch?.[1]) return fileMatch[1];

  const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (openMatch?.[1]) return openMatch[1];

  return undefined;
}

function looksLikeImageUrl(url: string) {
  return /\.(jpg|jpeg|png|webp|gif|bmp|svg)(\?|#|$)/i.test(url);
}
