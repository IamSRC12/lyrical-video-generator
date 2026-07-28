import { secureStorage } from "./encrypted-web-storage";

const GROQ_KEY_NAME = "groq_api_key";
const NVIDIA_KEY_NAME = "nvidia_api_key";

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

export async function getStoredNvidiaKey(): Promise<string | null> {
  return secureStorage.get<string>(NVIDIA_KEY_NAME);
}

export async function setStoredNvidiaKey(key: string): Promise<void> {
  if (!key.trim()) {
    await secureStorage.remove(NVIDIA_KEY_NAME);
    return;
  }
  await secureStorage.set(NVIDIA_KEY_NAME, key.trim());
}

export async function clearStoredNvidiaKey(): Promise<void> {
  await secureStorage.remove(NVIDIA_KEY_NAME);
}
