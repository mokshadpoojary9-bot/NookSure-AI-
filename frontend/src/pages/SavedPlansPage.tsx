import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { PlanStoreError, deletePlan, getPlan, listPlans, type PlanSummary } from "../lib/plans";
import { href } from "../router";
import { PLAN_STEP, saveState, withLayout } from "../storage";

const formatDate = (d: Date | null) =>
  d ? d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "Just now";

const messageOf = (err: unknown) => (err instanceof PlanStoreError ? err.message : "Something went wrong. Please try again.");

export function SavedPlansPage() {
  const { status, user } = useAuth();
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    setError(null);
    setPlans(null);
    try {
      setPlans(await listPlans());
    } catch (err) {
      setError(messageOf(err));
      setPlans([]);
    }
  }, []);

  const uid = user?.uid;
  useEffect(() => {
    if (status === "signed-in" && uid) void load();
  }, [status, uid, load]);

  useEffect(() => confirmRef.current?.focus(), [confirmId]);

  if (status !== "signed-in" || !user) {
    return (
      <div className="saved-plans">
        <h1>My saved plans</h1>
        <p className="lead">
          {status === "loading" ? "Checking sign-in…" : "Sign in with Google to see and save your plans."}
        </p>
        <a className="button" href={href("/plan")}>
          Go to the planner
        </a>
      </div>
    );
  }

  async function open(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const plan = await getPlan(id);
      if (!plan) {
        setError("That plan couldn't be opened. It may have been deleted.");
        return;
      }
      // Load it into the existing planner view, linked to this saved copy.
      // Older saved plans have no home layout: withLayout() gives them their own rooms as a Custom home.
      saveState({ step: PLAN_STEP, profile: withLayout(plan.profile), done: plan.done, title: plan.title, saved: { id, uid: user!.uid } });
      window.location.hash = href("/plan");
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: string) {
    setBusyId(id);
    setError(null);
    try {
      await deletePlan(id);
      setPlans((p) => p?.filter((x) => x.id !== id) ?? null);
      setConfirmId(null);
    } catch (err) {
      setError(messageOf(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="saved-plans">
      <h1>My saved plans</h1>

      {error && (
        <div className="chat-error" role="alert">
          <p>{error}</p>
          <button type="button" className="button small" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {plans === null ? (
        <p className="hint" role="status">
          Loading your plans…
        </p>
      ) : plans.length === 0 && !error ? (
        <div className="card empty">
          <p>No saved plans yet</p>
          <a className="button primary" href={href("/plan")}>
            Start a plan
          </a>
        </div>
      ) : (
        <ul className="saved-list">
          {plans.map((p) => (
            <li key={p.id} className="card saved-item">
              <div>
                <h2 className="saved-title">{p.title}</h2>
                <p className="hint">
                  {formatDate(p.updatedAt)} · {p.itemCount} {p.itemCount === 1 ? "step" : "steps"}
                </p>
              </div>
              {confirmId === p.id ? (
                <div className="saved-actions" role="group" aria-label={`Confirm deleting ${p.title}`}>
                  <span>Delete “{p.title}”? This can’t be undone.</span>
                  <button
                    ref={confirmRef}
                    type="button"
                    className="button danger"
                    disabled={busyId === p.id}
                    onClick={() => void remove(p.id)}
                  >
                    {busyId === p.id ? "Deleting…" : "Yes, delete"}
                  </button>
                  <button type="button" className="button" onClick={() => setConfirmId(null)}>
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="saved-actions">
                  <button
                    type="button"
                    className="button primary"
                    disabled={busyId !== null}
                    onClick={() => void open(p.id)}
                    aria-label={`Open ${p.title}`}
                  >
                    {busyId === p.id ? "Opening…" : "Open"}
                  </button>
                  <button
                    type="button"
                    className="button danger"
                    disabled={busyId !== null}
                    onClick={() => setConfirmId(p.id)}
                    aria-label={`Delete ${p.title}`}
                  >
                    Delete
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
