import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { authErrorCode, describeAuthError, firebaseAuthService, type AuthService, type AuthUser } from "./authService";

export type AuthStatus = "disabled" | "loading" | "signed-out" | "signing-in" | "signed-in";

interface AuthValue {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  signIn(): Promise<void>;
  signOut(): Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children, service = firebaseAuthService }: { children: ReactNode; service?: AuthService }) {
  const [status, setStatus] = useState<AuthStatus>(service.configured ? "loading" : "disabled");
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!service.configured) return;
    return service.onChange((u) => {
      setUser(u);
      setStatus(u ? "signed-in" : "signed-out");
    });
  }, [service]);

  const signIn = useCallback(async () => {
    setError(null);
    setStatus("signing-in");
    try {
      await service.signInWithGoogle();
      // onChange moves us to "signed-in"; on redirect the page navigates away.
    } catch (err) {
      // The code and Firebase's own message; neither contains the config values.
      console.error("Google sign-in failed:", authErrorCode(err), (err as { message?: string })?.message ?? "");
      setError(describeAuthError(err));
      setStatus("signed-out");
    }
  }, [service]);

  const signOut = useCallback(async () => {
    setError(null);
    try {
      await service.signOut();
    } catch {
      setError("Sign-out didn't work. Please try again.");
    }
  }, [service]);

  const value = useMemo(() => ({ status, user, error, signIn, signOut }), [status, user, error, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
