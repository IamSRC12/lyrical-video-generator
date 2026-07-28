export type UploadedAsset = {
  id: string;
  url: string;
};

export async function uploadAsset(file: File): Promise<UploadedAsset> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch("/api/assets", {
    method: "POST",
    body: form
  });

  const body = await response.json();

  if (!response.ok) {
    throw new Error(body.message ?? "Asset upload failed.");
  }

  if (!body.id || !body.path) {
    throw new Error("Asset server returned an invalid response.");
  }

  return {
    id: body.id,
    url: new URL(body.path, window.location.origin).toString()
  };
}
