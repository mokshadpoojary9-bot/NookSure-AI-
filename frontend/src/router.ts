import { useEffect, useState } from "react";

export type Route = "/" | "/plan" | "/assistant" | "/safety";

const ROUTES: readonly Route[] = ["/", "/plan", "/assistant", "/safety"];

function readRoute(): Route {
  const path = window.location.hash.replace(/^#/, "") || "/";
  return (ROUTES as readonly string[]).includes(path) ? (path as Route) : "/";
}

/** Minimal hash router — enough for a few static pages without a dependency. */
export function useRoute(): Route {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

export const href = (route: Route) => `#${route}`;
