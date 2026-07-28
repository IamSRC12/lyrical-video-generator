
export async function uploadAsset(file: File): Promise<string> {
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

  return body.url;
}


