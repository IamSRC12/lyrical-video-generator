export interface SecureStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface DesktopStorageAdapter extends SecureStorage {
  /**
   * A future Tauri implementation should call Rust commands backed by:
   * - the macOS Keychain,
   * - Windows Credential Manager,
   * - Linux Secret Service,
   * or an encrypted local database.
   */
}
