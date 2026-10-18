import { useRef, useState } from "react";
import type { HomeProfile } from "@nooksure/shared";
import { useAuth } from "../auth/AuthContext";
import { PLAN_TITLE_MAX, PlanStoreError, savePlan } from "../lib/plans";

interface Props {
  title: string;
  profile: HomeProfile;
  done: string[];
  saved?: { id: string; uid: string };
  onTitleChange(title: string): void;
  onSaved(saved: { id: string; uid: string }): void;
}

const signature = (p: Pick<Props, "title" | "profile" | "done">) => JSON.stringify([p.title.trim(), p.profile, p.done]);

/** "Save plan" for signed-in users. Guests see a sign-in hint and nothing touches Firestore. */
export function SavePlanPanel({ title, profile, done, saved, onTitleChange, onSaved }: Props) {
  const { status, user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedSig, setSavedSig] = useState<string | null>(null);
  const inFlight = useRef(false);

  if (status === "disabled") return null; // Firebase not configured: guest mode exactly as before.
  if (status !== "signed-in" || !user) {
    return <p className="save-hint">Sign in with Google to save plans.</p>;
  }

  // Only update a plan this user owns; otherwise save as a new one.
  const existingId = saved && saved.uid === user.uid ? saved.id : undefined;
  const isSaved = savedSig === signature({ title, profile, done });

  async function save() {
    if (inFlight.current) return; // guard against double clicks
    inFlight.current = true;
    setSaving(true);
    setError(null);
    const sig = signature({ title, profile, done });
    try {
      let id: string;
      try {
        id = await savePlan({ title, profile, done }, existingId);
      } catch (err) {
        // The saved copy was deleted elsewhere: save it as a new plan instead.
        if (existingId && err instanceof PlanStoreError && err.code === "not-found") {
          id = await savePlan({ title, profile, done });
        } else throw err;
      }
      onSaved({ id, uid: user!.uid });
      setSavedSig(sig);
    } catch (err) {
      setError(err instanceof PlanStoreError ? err.message : "Couldn't save the plan. Please try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return (
    <div className="save-panel">
      <label className="field">
        Plan name
        <input
          type="text"
          value={title}
          maxLength={PLAN_TITLE_MAX}
          placeholder="e.g. Mum's visit in November"
          onChange={(e) => onTitleChange(e.target.value)}
        />
      </label>
      <div className="save-row">
        <button
          type="button"
          className="button primary"
          onClick={save}
          disabled={saving || !title.trim()}
          aria-describedby="save-status"
        >
          {saving ? "Saving…" : existingId ? "Save changes" : "Save plan"}
        </button>
        <span id="save-status" className="save-status" role="status">
          {isSaved && !saving ? "Saved to your account ✓" : ""}
        </span>
      </div>
      {error && (
        <p className="chat-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
