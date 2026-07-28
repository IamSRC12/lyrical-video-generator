export interface UploadAssetResponse {
  id: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

export interface FetchAssetOptions {
  signal?: AbortSignal;
}

/**
 * Uploads a file asset (audio, image, video) to the server.
 */
export async function uploadAsset(
  file: File,
  options?: FetchAssetOptions
): Promise<UploadAssetResponse> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/assets", {
    method: "POST",
    body: form,
    signal: options?.signal
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.error ?? body.message ?? `Asset upload failed (HTTP ${response.status}).`
    );
  }

  return {
    id: body.id,
    url: body.url ?? `/api/assets/${body.id}`,
    filename: body.filename ?? file.name,
    mimeType: body.mimeType ?? file.type,
    size: body.size ?? file.size
  };
}

/**
 * Returns the formatted API URL for accessing an asset by ID or path.
 */
export function getAssetUrl(assetId: string): string {
  if (!assetId) return "";
  if (
    assetId.startsWith("/") ||
    assetId.startsWith("http://") ||
    assetId.startsWith("https://") ||
    assetId.startsWith("blob:")
  ) {
    return assetId;
  }
  return `/api/assets/${encodeURIComponent(assetId)}`;
}

/**
 * Fetches an asset as a raw Blob object.
 */
export async function fetchAssetBlob(
  assetId: string,
  options?: FetchAssetOptions
): Promise<Blob> {
  const url = getAssetUrl(assetId);
  const response = await fetch(url, { signal: options?.signal });

  if (!response.ok) {
    throw new Error(`Failed to fetch asset "${assetId}" (HTTP ${response.status}).`);
  }

  return await response.blob();
}

/**
 * Fetches an asset and returns an object URL suitable for media playback.
 */
export async function fetchAssetObjectUrl(
  assetId: string,
  options?: FetchAssetOptions
): Promise<string> {
  const blob = await fetchAssetBlob(assetId, options);
  return URL.createObjectURL(blob);
}

/**
 * Checks whether an asset exists on the server.
 */
export async function checkAssetExists(
  assetId: string,
  options?: FetchAssetOptions
): Promise<boolean> {
  try {
    const url = getAssetUrl(assetId);
    const response = await fetch(url, {
      method: "HEAD",
      signal: options?.signal
    });
    return response.ok;
  } catch {
    return false;
  }
}
