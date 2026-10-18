import { useCallback, useEffect, useState } from "react";

const synth = (): SpeechSynthesis | undefined =>
  typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined"
    ? window.speechSynthesis
    : undefined;

/** Browser text-to-speech for reading replies aloud. */
export function useSpeechSynthesis() {
  const supported = Boolean(synth());
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  useEffect(() => () => synth()?.cancel(), []);

  const stop = useCallback(() => {
    synth()?.cancel();
    setSpeakingId(null);
  }, []);

  const speak = useCallback((id: string, text: string) => {
    const s = synth();
    if (!s) return;
    s.cancel();
    // Strip simple markdown bullets so they aren't read out as symbols.
    const u = new SpeechSynthesisUtterance(text.replace(/^\s*[-*]\s+/gm, ""));
    u.lang = navigator.language || "en-US";
    u.onend = u.onerror = () => setSpeakingId((cur) => (cur === id ? null : cur));
    setSpeakingId(id);
    s.speak(u);
  }, []);

  return { supported, speakingId, speak, stop };
}
