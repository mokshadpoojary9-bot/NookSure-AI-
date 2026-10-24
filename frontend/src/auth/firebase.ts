import type { FirebaseApp, FirebaseOptions } from "firebase/app";
import type { Auth } from "firebase/auth";
import type { Firestore } from "firebase/firestore";

/**
 * Firebase web config for project `nooksure-ai`, read from local Vite env vars
 * (see .env.example). These identify the project to the browser; they are not
 * secrets, but they still live only in local env files, never in source.
 */
const env = import.meta.env;

/** Trims stray spaces/line breaks (easy to paste into a hosting dashboard), which break sign-in. */
const clean = (value: string | undefined) => value?.trim() || undefined;

const measurementId = clean(env.VITE_FIREBASE_MEASUREMENT_ID);

export const firebaseConfig: FirebaseOptions = {
  apiKey: clean(env.VITE_FIREBASE_API_KEY),
  authDomain: clean(env.VITE_FIREBASE_AUTH_DOMAIN),
  projectId: clean(env.VITE_FIREBASE_PROJECT_ID),
  storageBucket: clean(env.VITE_FIREBASE_STORAGE_BUCKET),
  messagingSenderId: clean(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
  appId: clean(env.VITE_FIREBASE_APP_ID),
  ...(measurementId ? { measurementId } : {}),
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

let appPromise: Promise<FirebaseApp> | undefined;
let authPromise: Promise<Auth> | undefined;
let dbPromise: Promise<Firestore> | undefined;

/** Lazily loads and initializes the Firebase app exactly once (safe under StrictMode/HMR). */
function getFirebaseApp(): Promise<FirebaseApp> {
  appPromise ??= import("firebase/app").then(({ getApp, getApps, initializeApp }) =>
    getApps().length ? getApp() : initializeApp(firebaseConfig),
  );
  return appPromise;
}

export function getFirebaseAuth(): Promise<Auth> {
  authPromise ??= Promise.all([getFirebaseApp(), import("firebase/auth")]).then(([app, { getAuth }]) => getAuth(app));
  return authPromise;
}

/** Firestore on the same app instance as Auth, so security rules see the signed-in user. */
export function getFirebaseDb(): Promise<Firestore> {
  dbPromise ??= Promise.all([getFirebaseApp(), import("firebase/firestore")]).then(([app, { getFirestore }]) =>
    getFirestore(app),
  );
  return dbPromise;
}
