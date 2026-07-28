export interface UploadAssetResponse {
  id: string;
  url: string;
  filename?: string;
  mimeType?: string;
  size?: number;
}

export async function uploadAsset(
  file: File,
  options?: { signal?: AbortSignal }
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
    throw new Error(body.error ?? body.message ?? `Asset upload failed (HTTP ${response.status}).`);
  }

  return {
    id: body.id,
    url: body.url,
    filename: body.filename,
    mimeType: body.mimeType,
    size: body.size
  };
}
