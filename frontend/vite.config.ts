import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  envDir: "..",
  server: { port: 5173 },
  test: {
    environment: "jsdom",
    // Keep tests independent of any developer's local .env.
    env: {
      VITE_API_BASE_URL: "http://api.test",
      VITE_FIREBASE_API_KEY: "",
      VITE_FIREBASE_AUTH_DOMAIN: "",
      VITE_FIREBASE_PROJECT_ID: "",
      VITE_FIREBASE_APP_ID: "",
    },
  },
});
