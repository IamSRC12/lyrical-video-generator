import {mkdir, rename, stat, unlink, writeFile} from "node:fs/promises";
import path from "node:path";

const ASSET_ID_PATTERN =
  /^[a-f0-9-]{36}(?:[.][a-z0-9]{1,10})?$/i;

export function getAssetDirectory(): string {
  return path.resolve(
    process.env.ASSET_DIRECTORY ??
      path.join(process.cwd(), "data", "assets")
  );
}

export function isValidAssetId(id: string): boolean {
  return ASSET_ID_PATTERN.test(id);
}

export function getAssetPath(id: string): string | null {
  if (!isValidAssetId(id)) return null;

  const directory = getAssetDirectory();
  const filePath = path.resolve(directory, id);

  if (
    filePath !== directory &&
    !filePath.startsWith(directory + path.sep)
  ) {
    return null;
  }

  return filePath;
}

export async function ensureAssetDirectory(): Promise<string> {
  const directory = getAssetDirectory();
  await mkdir(directory, {recursive: true});
  return directory;
}

export async function saveAssetAtomically(
  id: string,
  data: Buffer
): Promise<string> {
  const finalPath = getAssetPath(id);

  if (!finalPath) {
    throw new Error("Invalid asset ID.");
  }

  await ensureAssetDirectory();

  const temporaryPath =
    finalPath + `.upload-${crypto.randomUUID()}.tmp`;

  try {
    await writeFile(temporaryPath, data, {flag: "wx"});
    await rename(temporaryPath, finalPath);

    const fileStats = await stat(finalPath);

    if (!fileStats.isFile() || fileStats.size !== data.length) {
      throw new Error("Uploaded asset failed integrity validation.");
    }

    return finalPath;
  } catch (error) {
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function assetExists(
  id: string
): Promise<boolean> {
  const filePath = getAssetPath(id);

  if (!filePath) return false;

  try {
    const fileStats = await stat(filePath);
    return fileStats.isFile() && fileStats.size > 0;
  } catch {
    return false;
  }
}
