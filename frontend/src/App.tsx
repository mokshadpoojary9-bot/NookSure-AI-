import { Suspense, lazy } from "react";
import { AuthProvider } from "./auth/AuthContext";
import type { AuthService } from "./auth/authService";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { AssistantPage } from "./pages/AssistantPage";
import { CreditsPage } from "./pages/CreditsPage";
import { PlannerPage } from "./pages/PlannerPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { SavedPlansPage } from "./pages/SavedPlansPage";
import { TermsPage } from "./pages/TermsPage";
import { useRoute } from "./router";

// The landing and safety pages carry animation code (framer-motion); loading them as their
// own chunks keeps that out of every other page.
const HomePage = lazy(() => import("./pages/HomePage").then((m) => ({ default: m.HomePage })));
const SafetyPage = lazy(() => import("./pages/SafetyPage").then((m) => ({ default: m.SafetyPage })));

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
          {route === "/safety" && (
            <Suspense fallback={<p className="hint page-loading">Loading…</p>}>
              <SafetyPage />
            </Suspense>
          )}
          {route === "/credits" && <CreditsPage />}
          {route === "/privacy" && <PrivacyPage />}
          {route === "/terms" && <TermsPage />}
        </ErrorBoundary>
      </Layout>
    </AuthProvider>
  );
}
