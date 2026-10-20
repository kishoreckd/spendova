import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import type { Analytics } from "firebase/analytics";

function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Missing Firebase configuration: ${name}`);
  return value;
}

const app = initializeApp({
  apiKey: required(
    "VITE_FIREBASE_API_KEY",
    import.meta.env.VITE_FIREBASE_API_KEY,
  ),
  authDomain: required(
    "VITE_FIREBASE_AUTH_DOMAIN",
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  ),
  projectId: required(
    "VITE_FIREBASE_PROJECT_ID",
    import.meta.env.VITE_FIREBASE_PROJECT_ID,
  ),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: required("VITE_FIREBASE_APP_ID", import.meta.env.VITE_FIREBASE_APP_ID),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
});

export const auth = getAuth(app);

let analyticsPromise: Promise<Analytics | null> | undefined;

async function analytics() {
  if (!import.meta.env.PROD || !import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) {
    return null;
  }
  analyticsPromise ??= import("firebase/analytics").then(
    async ({ getAnalytics, isSupported }) =>
      (await isSupported()) ? getAnalytics(app) : null,
  );
  return analyticsPromise;
}

export async function trackEvent(
  name: string,
  parameters?: Record<string, string | number | boolean>,
) {
  const instance = await analytics();
  if (!instance) return;
  const { logEvent } = await import("firebase/analytics");
  logEvent(instance, name, parameters);
}
