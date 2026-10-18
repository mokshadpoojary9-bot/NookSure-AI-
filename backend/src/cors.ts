import type { CorsOptions } from "cors";
import type { AppConfig } from "./config";

const LOCALHOST = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

/** "https://a.app, https://b.app/" → ["https://a.app", "https://b.app"]. Wildcards are dropped. */
export function parseOrigins(list: string | undefined): string[] {
  return (list ?? "")
    .split(",")
    .map((o) => o.trim().replace(/\/+$/, ""))
    .filter((o) => o && o !== "*");
}

/**
 * Development: any localhost origin plus CORS_ORIGIN.
 * Production: only the origins in FRONTEND_ORIGIN — never "*", never localhost.
 */
export function createOriginCheck(config: Pick<AppConfig, "NODE_ENV" | "CORS_ORIGIN" | "FRONTEND_ORIGIN">) {
  const production = config.NODE_ENV === "production";
  const allowed = new Set(
    production ? parseOrigins(config.FRONTEND_ORIGIN) : [...parseOrigins(config.CORS_ORIGIN), ...parseOrigins(config.FRONTEND_ORIGIN)],
  );
  return (origin: string) => allowed.has(origin) || (!production && LOCALHOST.test(origin));
}

export function corsOptions(config: AppConfig): CorsOptions {
  const isAllowed = createOriginCheck(config);
  return {
    // No Origin header = not a cross-origin browser request (curl, Render health check).
    // Disallowed origins get no CORS headers, so the browser blocks the response.
    origin: (origin, cb) => cb(null, !origin || isAllowed(origin)),
  };
}
