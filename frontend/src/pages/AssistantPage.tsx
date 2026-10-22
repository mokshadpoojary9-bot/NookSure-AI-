import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { CHAT_LIMITS, type AnalysisMode, type ChatMessage } from "@nooksure/shared";
import { ChatRequestError, sendChat } from "../chat/api";
import { useSpeechRecognition } from "../speech/useSpeechRecognition";
import { useSpeechSynthesis } from "../speech/useSpeechSynthesis";

interface Turn extends ChatMessage {
  id: string;
  mode?: AnalysisMode;
  urgent?: boolean;
}

const STARTERS = [
  "My mum uses a walker and is visiting next week. Where do I start?",
  "How can I make the bathroom easier for a wheelchair user?",
  "What can I do about a step at the front door?",
];

let nextId = 0;
const newId = () => `t${++nextId}`;

export function AssistantPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [autoRead, setAutoRead] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const tts = useSpeechSynthesis();
  const mic = useSpeechRecognition((text) => {
    if (!text) return;
    setDraft((d) => (d.trim() ? `${d.trimEnd()} ${text}` : text).slice(0, CHAT_LIMITS.maxChars));
  });

  useEffect(() => () => abortRef.current?.abort(), []);
  // Block body on purpose: newer Chrome returns a Promise from scrollIntoView, and
  // React would treat that return value as a cleanup function and crash.
  useEffect(() => {
    endRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [turns, pending]);

  const sampleMode = turns.some((t) => t.mode === "fixture");

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    if (mic.status === "listening") mic.stop();
    const userTurn: Turn = { id: newId(), role: "user", content };
    const history = [...turns, userTurn];
    setTurns(history);
    setDraft("");
    setError(null);
    setPending(true);

    abortRef.current = new AbortController();
    try {
      const res = await sendChat(
        history.map(({ role, content }) => ({ role, content })),
        abortRef.current.signal,
      );
      const reply: Turn = { id: newId(), role: "assistant", content: res.reply, mode: res.analysisMode, urgent: res.urgent };
      setTurns((t) => [...t, reply]);
      if (autoRead) tts.speak(reply.id, reply.content);
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      setError(err instanceof ChatRequestError ? err.message : "Something went wrong. Please try again.");
      // Put the text back so the user doesn't lose it.
      setTurns((t) => t.filter((x) => x.id !== userTurn.id));
      setDraft(content);
    } finally {
      setPending(false);
      inputRef.current?.focus();
    }
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(draft);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      void send(draft);
    }
  };

  return (
    <div className="assistant">
      <h1>NookSure assistant</h1>
      <p className="lead">
        Ask about preparing a home for a guest or family member with mobility needs. The assistant can’t see your home
        and hasn’t inspected it — its answers are planning guidance based on what you describe, not a safety
        certification.
      </p>

      {sampleMode && (
        <p className="source-label" role="note">
          <strong>Sample mode — not AI analysis.</strong> Gemini isn’t configured on the server (
          <code>GEMINI_API_KEY</code>), so replies are canned examples.
        </p>
      )}

      <section className="card chat" aria-label="Conversation">
        <ol className="chat-log" aria-live="polite" aria-busy={pending}>
          {turns.length === 0 && (
            <li className="chat-empty">
              <p>Try one of these, or ask your own question:</p>
              <div className="chips">
                {STARTERS.map((s) => (
                  <button key={s} type="button" className="chip" onClick={() => void send(s)} disabled={pending}>
                    {s}
                  </button>
                ))}
              </div>
            </li>
          )}
          {turns.map((t) => (
            <li key={t.id} className={`bubble ${t.role}`}>
              <span className="visually-hidden">{t.role === "user" ? "You said:" : "Assistant replied:"}</span>
              {t.urgent && (
                <p className="urgent" role="alert">
                  <strong>If there is immediate danger,</strong> move away from it and contact emergency services or a
                  qualified professional now.
                </p>
              )}
              <p className="bubble-text">{t.content}</p>
              {t.role === "assistant" && (
                <div className="bubble-meta">
                  <span className="badge">{t.mode === "fixture" ? "Sample reply" : "Gemini AI · guidance only"}</span>
                  {tts.supported && (
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => (tts.speakingId === t.id ? tts.stop() : tts.speak(t.id, t.content))}
                    >
                      {tts.speakingId === t.id ? "Stop reading" : "Read aloud"}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
          {pending && (
            <li className="bubble assistant pending">
              <span>Thinking…</span>
            </li>
          )}
        </ol>
        <div ref={endRef} />

        {error && (
          <p className="chat-error" role="alert">
            {error}
          </p>
        )}

        <form className="composer" onSubmit={onSubmit}>
          <label htmlFor="chat-input" className="visually-hidden">
            Your question
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            rows={3}
            value={mic.interim ? `${draft}${draft ? " " : ""}${mic.interim}` : draft}
            readOnly={Boolean(mic.interim)}
            maxLength={CHAT_LIMITS.maxChars}
            placeholder="Type your question, or use the microphone"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
          />
          <div className="composer-bar">
            <button
              type="button"
              className={`button mic${mic.status === "listening" ? " live" : ""}`}
              onClick={mic.status === "listening" ? mic.stop : mic.start}
              disabled={!mic.supported || pending}
              aria-pressed={mic.status === "listening"}
              aria-describedby="mic-status"
            >
              <span aria-hidden="true">🎤</span>
              {mic.status === "listening" ? "Stop listening" : "Speak"}
            </button>
            <span className="count" aria-live="off">
              {draft.length}/{CHAT_LIMITS.maxChars}
            </span>
            <button type="submit" className="button primary" disabled={pending || !draft.trim()}>
              {pending ? "Sending…" : "Send"}
            </button>
          </div>
          <p id="mic-status" className="hint mic-status" role="status">
            {micStatusText(mic.status, mic.message)}
          </p>
        </form>

        <div className="tts-bar">
          {tts.supported ? (
            <>
              <label className="check">
                <input type="checkbox" checked={autoRead} onChange={(e) => setAutoRead(e.target.checked)} />
                Read replies aloud automatically
              </label>
              {tts.speakingId && (
                <button type="button" className="button small" onClick={tts.stop}>
                  Stop speaking
                </button>
              )}
            </>
          ) : (
            <p className="hint">Read-aloud isn’t available in this browser.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function micStatusText(status: ReturnType<typeof useSpeechRecognition>["status"], message: string | null): string {
  if (message) return message;
  switch (status) {
    case "unsupported":
      return "Voice input isn’t available in this browser. You can type your question instead.";
    case "listening":
      return "Listening… speak your question, then review it before sending.";
    case "stopped":
      return "Stopped listening. Check or edit the text, then press Send.";
    default:
      return "Voice input uses your browser’s speech recognition (some browsers process audio on their own servers) and needs microphone permission.";
  }
}
