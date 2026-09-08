import AsyncStorage from '@react-native-async-storage/async-storage';

export const BACKEND_TOKEN_KEY = 'ecoloop_backend_token';

let cachedAccessToken = '';

export function setCachedMobileAccessToken(token: string) {
  cachedAccessToken = token;
}

export async function getMobileAccessToken() {
  if (cachedAccessToken) return cachedAccessToken;

  try {
    cachedAccessToken = (await AsyncStorage.getItem(BACKEND_TOKEN_KEY)) ?? '';
  } catch {
    // AsyncStorage is unavailable in Node-based unit tests. On device it is
    // hydrated by the authenticated store before a prediction can be sent.
  }

  return cachedAccessToken;
}
