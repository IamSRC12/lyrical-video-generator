const DB_NAME = "lyrical_studio_secure_store";
const STORE_NAME = "crypto_keys";
const MASTER_KEY_ID = "master_aes_gcm_key";
const STORAGE_PREFIX = "lyrical_enc_v1_";

export interface SecureStorage {
  set<T>(key: string, value: T): Promise<void>;
  get<T>(key: string): Promise<T | null>;
  remove(key: string): Promise<void>;
}

type CipherRecord = {
  version: 1;
  iv: string;
  payload: string;
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function openIndexedDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this environment"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getMasterKey(): Promise<CryptoKey> {
  const db = await openIndexedDB();

  const existingKey = await new Promise<CryptoKey | undefined>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(MASTER_KEY_ID);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  if (existingKey) {
    return existingKey;
  }

  const newKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false, // extractable: false for security
    ["encrypt", "decrypt"]
  );

  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.put(newKey, MASTER_KEY_ID);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });

  return newKey;
}

export class EncryptedWebStorage implements SecureStorage {
  async set<T>(key: string, value: T): Promise<void> {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
      throw new Error("EncryptedWebStorage is only available in browser contexts");
    }

    const masterKey = await getMasterKey();
    const iv = crypto.getRandomValues(new Uint8Array(12)); // 96-bit IV
    const encoded = new TextEncoder().encode(JSON.stringify(value));

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      masterKey,
      encoded
    );

    const record: CipherRecord = {
      version: 1,
      iv: bytesToBase64(iv),
      payload: bytesToBase64(new Uint8Array(encryptedBuffer))
    };

    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(record));
  }

  async get<T>(key: string): Promise<T | null> {
    if (typeof window === "undefined" || !window.crypto?.subtle) {
      return null;
    }

    const raw = localStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;

    try {
      const record = JSON.parse(raw) as CipherRecord;
      if (record.version !== 1 || !record.iv || !record.payload) {
        throw new Error("Invalid cipher record format");
      }

      const masterKey = await getMasterKey();
      const iv = base64ToBytes(record.iv);
      const encryptedBytes = base64ToBytes(record.payload);

      const decryptedBuffer = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv.buffer as ArrayBuffer },
        masterKey,
        encryptedBytes.buffer as ArrayBuffer
      );

      const text = new TextDecoder().decode(decryptedBuffer);
      return JSON.parse(text) as T;
    } catch {
      // Clear corrupt or un-decryptable payload
      localStorage.removeItem(STORAGE_PREFIX + key);
      return null;
    }
  }

  async remove(key: string): Promise<void> {
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_PREFIX + key);
    }
  }
}

export const secureStorage = new EncryptedWebStorage();
