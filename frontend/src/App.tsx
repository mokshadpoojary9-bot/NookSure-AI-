import { Layout } from "./components/Layout";
import { HomePage } from "./pages/HomePage";
import { PlannerPage } from "./pages/PlannerPage";
import { SafetyPage } from "./pages/SafetyPage";
import { useRoute } from "./router";

export function App() {
  const route = useRoute();
  return (
    <Layout route={route}>
      {route === "/" && <HomePage />}
      {route === "/plan" && <PlannerPage />}
      {route === "/safety" && <SafetyPage />}
    </Layout>
  );
}
