import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";

/**
 * Firebase web config for project `nooksure-ai`, read from local Vite env vars
 * (see .env.example). These identify the project to the browser; they are not
 * secrets, but they still live only in local env files, never in source.
 */
const env = import.meta.env;

export const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
  ...(env.VITE_FIREBASE_MEASUREMENT_ID ? { measurementId: env.VITE_FIREBASE_MEASUREMENT_ID } : {}),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let authPromise: Promise<Auth> | undefined;

/** Lazily loads and initializes Firebase exactly once (safe under StrictMode/HMR). */
export function getFirebaseAuth(): Promise<Auth> {
  authPromise ??= (async () => {
    const [{ getApp, getApps, initializeApp }, { getAuth }] = await Promise.all([
      import("firebase/app"),
      import("firebase/auth"),
    ]);
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    return getAuth(app);
  })();
  return authPromise;
}
