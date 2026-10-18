import { createApp } from "./app";
import { loadConfig } from "./config";
import { parseOrigins } from "./cors";

const config = loadConfig();
if (config.NODE_ENV === "production" && parseOrigins(config.FRONTEND_ORIGIN).length === 0) {
  console.warn("FRONTEND_ORIGIN is not set — browsers on other origins will be blocked by CORS.");
}
createApp(config).listen(config.PORT, () => {
  console.log(`NookSure backend listening on http://localhost:${config.PORT}`);
  if (config.analysisMode === "fixture") {
    console.log("GEMINI_API_KEY not set — running in FIXTURE mode (sample replies, no real AI analysis).");
  }
});
