import * as SecureStore from "expo-secure-store";

import { SECURE_STORE_KEYCHAIN_SERVICE } from "./constants";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: SECURE_STORE_KEYCHAIN_SERVICE,
};

export const secureStorage = {
  get: (key: string) => SecureStore.getItemAsync(key, OPTIONS),
  set: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, OPTIONS),
  remove: (key: string) => SecureStore.deleteItemAsync(key, OPTIONS),
};
