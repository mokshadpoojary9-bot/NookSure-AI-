import { useAuth } from "./AuthContext";

/** Header sign-in control. Sign-in is optional — every page works as a guest. */
export function AccountMenu() {
  const { status, user, error, signIn, signOut } = useAuth();

  return (
    <div className="account">
      {status === "disabled" && (
        <span className="account-note" title="Add the VITE_FIREBASE_* values to .env to enable Google sign-in.">
          Guest mode
        </span>
      )}
      {status === "loading" && <span className="account-note">Checking sign-in…</span>}
      {(status === "signed-out" || status === "signing-in") && (
        <button type="button" className="button small" onClick={signIn} disabled={status === "signing-in"}>
          {status === "signing-in" ? "Signing in…" : "Sign in with Google"}
        </button>
      )}
      {status === "signed-in" && user && (
        <>
          {user.photoURL && <img className="avatar" src={user.photoURL} alt="" referrerPolicy="no-referrer" />}
          <span className="account-name">Signed in as {user.displayName ?? user.email ?? "you"}</span>
          <button type="button" className="button small" onClick={signOut}>
            Sign out
          </button>
        </>
      )}
      {error && (
        <p className="account-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
