import { AuthProvider } from "./auth/AuthContext";
import type { AuthService } from "./auth/authService";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Layout } from "./components/Layout";
import { AssistantPage } from "./pages/AssistantPage";
import { CreditsPage } from "./pages/CreditsPage";
import { HomePage } from "./pages/HomePage";
import { PlannerPage } from "./pages/PlannerPage";
import { SavedPlansPage } from "./pages/SavedPlansPage";
import { SafetyPage } from "./pages/SafetyPage";
import { useRoute } from "./router";

export function App({ authService }: { authService?: AuthService } = {}) {
  const route = useRoute();
  return (
    <AuthProvider service={authService}>
      <Layout route={route}>
        {/* Keyed by route so navigating away from a crashed page clears the error. */}
        <ErrorBoundary key={route}>
          {route === "/" && <HomePage />}
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
