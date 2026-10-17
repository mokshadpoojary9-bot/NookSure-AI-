import { createApp } from "./app";
import { loadConfig } from "./config";

const config = loadConfig();
createApp(config).listen(config.PORT, () => {
  console.log(`NookSure backend listening on http://localhost:${config.PORT}`);
  if (config.analysisMode === "fixture") {
    console.log("AI provider key not set — running in FIXTURE mode (no real AI analysis).");
  }
});
