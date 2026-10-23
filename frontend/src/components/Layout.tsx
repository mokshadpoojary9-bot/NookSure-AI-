import type { ReactNode } from "react";
import { AccountMenu } from "../auth/AccountMenu";
import { useAuth } from "../auth/AuthContext";
import { href, type Route } from "../router";

const NAV: { route: Route; label: string; signedInOnly?: boolean }[] = [
  { route: "/", label: "Home" },
  { route: "/plan", label: "Planner" },
  { route: "/saved", label: "My saved plans", signedInOnly: true },
  { route: "/assistant", label: "Assistant" },
  { route: "/safety", label: "Safety" },
];

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  const signedIn = useAuth().status === "signed-in";
  return (
    <div className="shell">
      {/* Hash routing owns location.hash, so move focus instead of linking to #main. */}
      <a
        className="skip-link"
        href="#main"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main")?.focus();
        }}
      >
        Skip to content
      </a>
      <header className="site-header">
        <a className="brand" href={href("/")}>
          <span className="brand-mark" aria-hidden="true">
            N
          </span>
          NookSure&nbsp;AI
        </a>
        <nav aria-label="Main">
          {NAV.filter((n) => signedIn || !n.signedInOnly).map((n) => (
            <a key={n.route} href={href(n.route)} aria-current={route === n.route ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
        <AccountMenu />
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <p>
          NookSure offers planning guidance only. It never certifies a home as safe and does not replace an
          occupational therapist or qualified installer.
        </p>
        <p className="footer-links">
          <a href={href("/safety")}>Safety principles</a> · <a href={href("/privacy")}>Privacy</a> ·{" "}
          <a href={href("/terms")}>Terms</a> · <a href={href("/credits")}>Credits</a>
        </p>
      </footer>
    </div>
  );
}
