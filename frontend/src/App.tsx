import { Suspense, lazy } from "react";
import { AuthProvider } from "./auth/AuthContext";
import type { AuthService } from "./auth/authService";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { AssistantPage } from "./pages/AssistantPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PlannerPage } from "./pages/PlannerPage";
import { SavedPlansPage } from "./pages/SavedPlansPage";
import { SafetyPage } from "./pages/SafetyPage";
import { useRoute } from "./router";

// The landing page carries its own animation code (framer-motion); loading it as its own
// chunk keeps that out of every other page.
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));

export function App({ authService }: { authService?: AuthService } = {}) {
  const route = useRoute();
  return (
    <AuthProvider service={authService}>
      <Layout route={route}>
        {/* Keyed by route so navigating away from a crashed page clears the error. */}
        <ErrorBoundary key={route}>
          {route === "/" && (
            <Suspense fallback={<p className="hint page-loading">Loading…</p>}>
              <HomePage />
            </Suspense>
          )}
          {route === "/plan" && <PlannerPage />}
          {route === "/saved" && <SavedPlansPage />}
          {route === "/assistant" && <AssistantPage />}
          {route === "/safety" && <SafetyPage />}
          {route === "/credits" && <CreditsPage />}
        </ErrorBoundary>
      </Layout>
    </AuthProvider>
  );
}
