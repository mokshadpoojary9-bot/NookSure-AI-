import { getFirebaseAuth, isFirebaseConfigured } from "./firebase";

export interface AuthUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

/** Abstraction over Firebase Auth so the UI can be tested with a fake. */
export interface AuthService {
  readonly configured: boolean;
  /** Subscribes to auth changes; returns an unsubscribe function. */
  onChange(cb: (user: AuthUser | null) => void): () => void;
  signInWithGoogle(): Promise<void>;
  signOut(): Promise<void>;
}

/** Turns a Firebase error code into a message safe and useful to show users. */
export function describeAuthError(err: unknown): string | null {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return null; // the user backed out — not an error worth showing
    case "auth/unauthorized-domain":
      return "This site's domain isn't authorized for sign-in yet. Add it under Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "Google sign-in isn't enabled for this Firebase project yet.";
    case "auth/network-request-failed":
      return "Couldn't reach Google sign-in. Check your connection and try again.";
    default:
      return "Sign-in didn't work. Please try again.";
  }
}

const toUser = (u: { uid: string; displayName: string | null; email: string | null; photoURL: string | null }): AuthUser => ({
  uid: u.uid,
  displayName: u.displayName,
  email: u.email,
  photoURL: u.photoURL,
});

export const firebaseAuthService: AuthService = {
  configured: isFirebaseConfigured,

  onChange(cb) {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    void (async () => {
      const [auth, { onAuthStateChanged }] = await Promise.all([getFirebaseAuth(), import("firebase/auth")]);
      if (cancelled) return;
      unsubscribe = onAuthStateChanged(auth, (u) => cb(u ? toUser(u) : null));
    })().catch(() => cb(null));
    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  },

  async signInWithGoogle() {
    const [auth, { GoogleAuthProvider, signInWithPopup, signInWithRedirect }] = await Promise.all([
      getFirebaseAuth(),
      import("firebase/auth"),
    ]);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      // Popups can be blocked (some mobile browsers); fall back to a redirect.
      if ((err as { code?: string })?.code === "auth/popup-blocked") {
        await signInWithRedirect(auth, provider);
        return;
      }
      throw err;
    }
  },

  async signOut() {
    const [auth, { signOut }] = await Promise.all([getFirebaseAuth(), import("firebase/auth")]);
    await signOut(auth);
  },
};
