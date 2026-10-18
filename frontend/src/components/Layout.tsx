import type { ReactNode } from "react";
import { href, type Route } from "../router";

const NAV: { route: Route; label: string }[] = [
  { route: "/", label: "Home" },
  { route: "/plan", label: "Planner" },
  { route: "/safety", label: "Safety" },
];

export function Layout({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
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
          {NAV.map((n) => (
            <a key={n.route} href={href(n.route)} aria-current={route === n.route ? "page" : undefined}>
              {n.label}
            </a>
          ))}
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <p>
          NookSure offers planning guidance only. It never certifies a home as safe and does not replace an
          occupational therapist or qualified installer.
        </p>
      </footer>
    </div>
  );
}
