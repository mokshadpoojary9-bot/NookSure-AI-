import { AuthProvider } from "./auth/AuthContext";
import type { AuthService } from "./auth/authService";
import { Layout } from "./components/Layout";
import { AssistantPage } from "./pages/AssistantPage";
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
        {route === "/" && <HomePage />}
        {route === "/plan" && <PlannerPage />}
        {route === "/saved" && <SavedPlansPage />}
        {route === "/assistant" && <AssistantPage />}
        {route === "/safety" && <SafetyPage />}
      </Layout>
    </AuthProvider>
  );
}
