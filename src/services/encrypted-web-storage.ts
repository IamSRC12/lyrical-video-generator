import type {SecureStorage} from "./storage";

const DB_NAME = "lyrical-studio-secure";
const STORE_NAME = "crypto";
const MASTER_KEY_ID = "master-key";
const PREFIX = "lyrical.encrypted.";

type CipherRecord = {
  iv: string;
  payload: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMasterKey(): Promise<CryptoKey> {
  const database = await openDatabase();

  const existing = await new Promise<CryptoKey | undefined>(
    (resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, "readonly");
      const request = transaction.objectStore(STORE_NAME).get(MASTER_KEY_ID);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    }
  );

  if (existing) return existing;

  const key = await crypto.subtle.generateKey(
    {name: "AES-GCM", length: 256},
    false,
    ["encrypt", "decrypt"]
  );

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(key, MASTER_KEY_ID);

    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });

  return key;
}

export class EncryptedWebStorage implements SecureStorage {
  async set<T>(key: string, value: T): Promise<void> {
    const masterKey = await getMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const plaintext = new TextEncoder().encode(JSON.stringify(value));

    const encrypted = await crypto.subtle.encrypt(
      {name: "AES-GCM", iv},
      masterKey,
      plaintext
    );

    const record: CipherRecord = {
      iv: bytesToBase64(iv),
      payload: bytesToBase64(new Uint8Array(encrypted))
    };

    localStorage.setItem(PREFIX + key, JSON.stringify(record));
  }

  async get<T>(key: string): Promise<T | null> {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;

    try {
      const record = JSON.parse(raw) as CipherRecord;
      const masterKey = await getMasterKey();

      const decrypted = await crypto.subtle.decrypt(
        {
          name: "AES-GCM",
          iv: base64ToBytes(record.iv)
        },
        masterKey,
        base64ToBytes(record.payload)
      );

      return JSON.parse(new TextDecoder().decode(decrypted)) as T;
    } catch {
      localStorage.removeItem(PREFIX + key);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    localStorage.removeItem(PREFIX + key);
  }
}

export const secureStorage = new EncryptedWebStorage();
