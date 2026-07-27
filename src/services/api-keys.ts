import {secureStorage} from "./encrypted-web-storage";

export type ApiCredentials = {
  groq: string;
  nvidia: string;
  nvidiaModel: string;
};

const CREDENTIAL_KEY = "api-credentials";

export const apiKeyStorage = {
  get: () => secureStorage.get<ApiCredentials>(CREDENTIAL_KEY),
  set: (credentials: ApiCredentials) =>
    secureStorage.set(CREDENTIAL_KEY, credentials),
  clear: () => secureStorage.remove(CREDENTIAL_KEY)
};
