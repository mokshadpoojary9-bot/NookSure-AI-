import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
createApp(config).listen(config.PORT, () => {
  console.log(`NookSure backend listening on http://localhost:${config.PORT}`);
  if (config.analysisMode === "fixture") {
    console.log("GEMINI_API_KEY not set — running in FIXTURE mode (sample replies, no real AI analysis).");
  }
});
