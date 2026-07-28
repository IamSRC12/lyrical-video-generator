import { secureStorage } from "./encrypted-web-storage";

const GROQ_KEY_NAME = "groq_api_key";
const OPENCODE_KEY_NAME = "opencode_api_key";

export async function getStoredGroqKey(): Promise<string | null> {
  return secureStorage.get<string>(GROQ_KEY_NAME);
}

export async function setStoredGroqKey(key: string): Promise<void> {
  if (!key.trim()) {
    await secureStorage.remove(GROQ_KEY_NAME);
    return;
  }
  await secureStorage.set(GROQ_KEY_NAME, key.trim());
}

export async function clearStoredGroqKey(): Promise<void> {
  await secureStorage.remove(GROQ_KEY_NAME);
}

export async function getStoredOpencodeKey(): Promise<string | null> {
  return secureStorage.get<string>(OPENCODE_KEY_NAME);
}

export async function setStoredOpencodeKey(key: string): Promise<void> {
  if (!key.trim()) {
    await secureStorage.remove(OPENCODE_KEY_NAME);
    return;
  }
  await secureStorage.set(OPENCODE_KEY_NAME, key.trim());
}

export async function clearStoredOpencodeKey(): Promise<void> {
  await secureStorage.remove(OPENCODE_KEY_NAME);
}
