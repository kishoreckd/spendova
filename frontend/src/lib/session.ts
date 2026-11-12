/** Access tokens live in memory. The refresh token stays in an HttpOnly server cookie. */
let accessToken: string | null = null;
let identity: string | null = null;
let epoch = 0;
const listeners = new Set<() => void>();

export function getAccessToken() {
  return accessToken;
}
export function getSessionIdentity() {
  return identity;
}
export function getSessionEpoch() {
  return epoch;
}
export function setAccessToken(token: string) {
  accessToken = token;
}
export function startSession(token: string, userId: string) {
  ++epoch;
  accessToken = token;
  identity = userId;
}
export function clearSession() {
  ++epoch;
  accessToken = null;
  identity = null;
  for (const listener of listeners) listener();
}
export function onSessionCleared(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
