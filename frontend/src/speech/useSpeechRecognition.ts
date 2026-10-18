import { useCallback, useEffect, useRef, useState } from "react";

// Minimal Web Speech API types — not yet in TypeScript's DOM lib.
interface RecognitionResultList {
  readonly length: number;
  [index: number]: { readonly isFinal: boolean; readonly 0: { readonly transcript: string } };
}
export interface RecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: { resultIndex: number; results: RecognitionResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => RecognitionLike;

function getRecognitionCtor(): RecognitionCtor | undefined {
  if (typeof window === "undefined") return undefined;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

export type RecognitionStatus = "idle" | "listening" | "stopped" | "denied" | "unsupported" | "error";

const ERROR_MESSAGES: Record<string, { status: RecognitionStatus; message: string }> = {
  "not-allowed": { status: "denied", message: "Microphone access was blocked. Allow it in your browser's site settings, or type instead." },
  "service-not-allowed": { status: "denied", message: "Speech recognition isn't allowed in this browser. You can type instead." },
  "audio-capture": { status: "error", message: "No microphone was found. Check it's connected, or type instead." },
  "no-speech": { status: "stopped", message: "Didn't catch anything. Try again, or type your question." },
  network: { status: "error", message: "Speech recognition needs a network connection in this browser. Try again or type instead." },
};

/**
 * Browser speech-to-text. Recognized text is handed to `onFinal` for the user
 * to review and edit — this hook never sends anything itself.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const Ctor = getRecognitionCtor();
  const [status, setStatus] = useState<RecognitionStatus>(Ctor ? "idle" : "unsupported");
  const [interim, setInterim] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const recRef = useRef<RecognitionLike | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => () => recRef.current?.abort(), []);

  const start = useCallback(() => {
    if (!Ctor) return;
    recRef.current?.abort();
    const rec = new Ctor();
    rec.lang = navigator.language || "en-US";
    rec.interimResults = true;
    rec.continuous = false;
    let failed = false;

    rec.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]!;
        if (r.isFinal) onFinalRef.current(r[0].transcript.trim());
        else interimText += r[0].transcript;
      }
      setInterim(interimText);
    };
    rec.onerror = (e) => {
      if (e.error === "aborted") return;
      failed = true;
      const mapped = ERROR_MESSAGES[e.error] ?? { status: "error" as const, message: "Speech recognition stopped unexpectedly. You can type instead." };
      setStatus(mapped.status);
      setMessage(mapped.message);
    };
    rec.onend = () => {
      setInterim("");
      if (!failed) setStatus("stopped");
      if (recRef.current === rec) recRef.current = null;
    };

    recRef.current = rec;
    setMessage(null);
    setInterim("");
    try {
      rec.start();
      setStatus("listening");
    } catch {
      setStatus("error");
      setMessage("Couldn't start the microphone. You can type instead.");
    }
  }, [Ctor]);

  const stop = useCallback(() => recRef.current?.stop(), []);

  return { supported: Boolean(Ctor), status, interim, message, start, stop };
}
