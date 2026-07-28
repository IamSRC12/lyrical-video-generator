export type UploadedAsset = {
  id: string;
  url: string;
  size: number;
};

export async function uploadAsset(
  file: File
): Promise<UploadedAsset> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/assets", {
    method: "POST",
    body: form,
    cache: "no-store"
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message ?? "Asset upload failed.");
  }

  if (
    typeof body.id !== "string" ||
    typeof body.path !== "string"
  ) {
    throw new Error("Asset server returned an invalid response.");
  }

  const url = new URL(
    body.path,
    window.location.origin
  ).toString();

  // Verify the file before creating a project.
  const verification = await fetch(url, {
    method: "HEAD",
    cache: "no-store"
  });

  if (!verification.ok) {
    throw new Error(
      `Audio upload verification failed (${verification.status}).`
    );
  }

  return {
    id: body.id,
    url,
    size: Number(body.size ?? file.size)
  };
}
