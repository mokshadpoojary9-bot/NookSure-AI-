import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONCERNS,
  KIND_LABELS,
  KIND_ORDER,
  MOBILITY_AID_LABELS,
  MobilityAidSchema,
  ROOM_LABELS,
  RoomTypeSchema,
  generatePlan,
  type Concern,
  type HomeProfile,
  type MobilityAid,
  type PlanItem,
  type RoomType,
} from "@nooksure/shared";
import { SavePlanPanel } from "../components/SavePlanPanel";
import { clearState, emptyState, loadState, saveState, type PlannerState } from "../storage";

const STEPS = ["Household", "Rooms", "Observations", "Your plan"] as const;

const KIND_INTROS = {
  reuse: "Start here — use what is already in the home.",
  rearrange: "Move what you have to open routes and bring essentials within reach.",
  remove: "Take hazards out of the way.",
  purchase: "Buy only what can’t be solved above. Weight-bearing items need proper installation.",
} as const;

function toggle<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function PlannerPage() {
  const [state, setState] = useState<PlannerState>(loadState);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => saveState(state), [state]);

  const { step, profile, done } = state;
  const plan = useMemo(() => generatePlan(profile), [profile]);

  const setProfile = (update: (p: HomeProfile) => HomeProfile) =>
    setState((s) => ({ ...s, profile: update(s.profile) }));
  const goTo = (next: number) => {
    setState((s) => ({ ...s, step: next }));
    headingRef.current?.focus();
  };
  const reset = () => {
    clearState();
    setState(emptyState());
    headingRef.current?.focus();
  };

  const canContinue = step === 1 ? profile.rooms.length > 0 : true;

  return (
    <div className="planner">
      <h1 ref={headingRef} tabIndex={-1}>
        Home planner
      </h1>
      <ol className="stepper" aria-label="Planner steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? "step" : undefined} className={i < step ? "complete" : undefined}>
            <span className="step-num" aria-hidden="true">
              {i + 1}
            </span>
            {label}
          </li>
        ))}
      </ol>

      <section className="card step-panel" aria-labelledby="step-heading">
        {step === 0 && <HouseholdStep profile={profile} setProfile={setProfile} />}
        {step === 1 && <RoomsStep profile={profile} setProfile={setProfile} />}
        {step === 2 && <ObservationsStep profile={profile} setProfile={setProfile} />}
        {step === 3 && (
          <PlanStep
            plan={plan}
            done={done}
            onToggleDone={(id) => setState((s) => ({ ...s, done: toggle(s.done, id) }))}
          />
        )}
        {step === 3 && (
          <SavePlanPanel
            title={state.title ?? "My home plan"}
            profile={profile}
            done={done}
            saved={state.saved}
            onTitleChange={(title) => setState((s) => ({ ...s, title }))}
            onSaved={(saved) => setState((s) => ({ ...s, saved }))}
          />
        )}

        <div className="step-actions">
          {step > 0 && (
            <button type="button" className="button" onClick={() => goTo(step - 1)}>
              Back
            </button>
          )}
          {step < 3 && (
            <button type="button" className="button primary" disabled={!canContinue} onClick={() => goTo(step + 1)}>
              {step === 2 ? "Build my plan" : "Continue"}
            </button>
          )}
          {step === 3 && (
            <>
              <button type="button" className="button" onClick={() => window.print()}>
                Print plan
              </button>
              <button type="button" className="button danger" onClick={reset}>
                Start over
              </button>
            </>
          )}
        </div>
        {step === 1 && !canContinue && <p className="hint">Choose at least one room to continue.</p>}
      </section>
    </div>
  );
}

interface StepProps {
  profile: HomeProfile;
  setProfile: (update: (p: HomeProfile) => HomeProfile) => void;
}

function HouseholdStep({ profile, setProfile }: StepProps) {
  return (
    <>
      <h2 id="step-heading">Who are you preparing the home for?</h2>
      <fieldset>
        <legend>Mobility aids and needs (choose any)</legend>
        <div className="chips">
          {MobilityAidSchema.options.map((aid: MobilityAid) => (
            <label key={aid} className="chip">
              <input
                type="checkbox"
                checked={profile.aids.includes(aid)}
                onChange={() => setProfile((p) => ({ ...p, aids: toggle(p.aids, aid) }))}
              />
              {MOBILITY_AID_LABELS[aid]}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="field">
        Notes for yourself (optional)
        <textarea
          rows={3}
          maxLength={1000}
          value={profile.notes}
          placeholder="e.g. Mum is coming home from hospital on the 24th"
          onChange={(e) => setProfile((p) => ({ ...p, notes: e.target.value }))}
        />
      </label>
    </>
  );
}

function RoomsStep({ profile, setProfile }: StepProps) {
  return (
    <>
      <h2 id="step-heading">Which rooms should we plan?</h2>
      <fieldset>
        <legend>Rooms</legend>
        <div className="chips">
          {RoomTypeSchema.options.map((room: RoomType) => (
            <label key={room} className="chip">
              <input
                type="checkbox"
                checked={profile.rooms.includes(room)}
                onChange={() => setProfile((p) => ({ ...p, rooms: toggle(p.rooms, room) }))}
              />
              {ROOM_LABELS[room]}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function ObservationsStep({ profile, setProfile }: StepProps) {
  const toggleConcern = (room: RoomType, concern: Concern) =>
    setProfile((p) => ({ ...p, concerns: { ...p.concerns, [room]: toggle(p.concerns[room] ?? [], concern) } }));

  return (
    <>
      <h2 id="step-heading">What do you notice in each room?</h2>
      <p className="hint">Tick anything that applies. Leave a room blank if nothing stands out.</p>
      <div className="room-grid">
        {profile.rooms.map((room) => (
          <fieldset key={room} className="room-card">
            <legend>{ROOM_LABELS[room]}</legend>
            {(Object.keys(CONCERNS) as Concern[])
              .filter((c) => CONCERNS[c].rooms.includes(room))
              .map((concern) => (
                <label key={concern} className="check">
                  <input
                    type="checkbox"
                    checked={profile.concerns[room]?.includes(concern) ?? false}
                    onChange={() => toggleConcern(room, concern)}
                  />
                  {CONCERNS[concern].label}
                </label>
              ))}
          </fieldset>
        ))}
      </div>
    </>
  );
}

function PlanStep({ plan, done, onToggleDone }: { plan: PlanItem[]; done: string[]; onToggleDone: (id: string) => void }) {
  const completed = plan.filter((i) => done.includes(i.id)).length;

  return (
    <>
      <h2 id="step-heading">Your “Use What You Have” plan</h2>
      <p className="source-label" role="note">
        <strong>Rule-based checklist — not AI analysis.</strong> Suggestions come from NookSure’s reviewed safety
        rules. This is planning guidance, not a safety certification.
      </p>

      {plan.length === 0 ? (
        <p className="empty">
          No concerns were ticked, so there is nothing to plan yet. Go back to add observations for your rooms.
        </p>
      ) : (
        <>
          <div className="progress" aria-live="polite">
            <span>
              {completed} of {plan.length} done
            </span>
            <progress max={plan.length} value={completed} aria-label="Plan progress" />
          </div>
          {KIND_ORDER.map((kind) => {
            const items = plan.filter((i) => i.kind === kind);
            if (items.length === 0) return null;
            return (
              <section key={kind} className={`kind-group kind-${kind}`} aria-labelledby={`group-${kind}`}>
                <h3 id={`group-${kind}`}>
                  {KIND_LABELS[kind]} <span className="count">({items.length})</span>
                </h3>
                <p className="hint">{KIND_INTROS[kind]}</p>
                <ul className="plan-list">
                  {items.map((item) => (
                    <PlanItemCard
                      key={item.id}
                      item={item}
                      done={done.includes(item.id)}
                      onToggle={() => onToggleDone(item.id)}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}

function PlanItemCard({ item, done, onToggle }: { item: PlanItem; done: boolean; onToggle: () => void }) {
  return (
    <li className={`plan-item${done ? " done" : ""}`}>
      <label className="plan-check">
        <input type="checkbox" checked={done} onChange={onToggle} />
        <span className="visually-hidden">Mark done: </span>
        <span className="plan-title">{item.title}</span>
      </label>
      <div className="plan-meta">
        <span className="badge">{ROOM_LABELS[item.room]}</span>
        {item.seekProfessional && <span className="badge pro">Seek professional advice</span>}
      </div>
      <p>{item.detail}</p>
      {item.safetyNote && (
        <p className="safety-note">
          <strong>Safety: </strong>
          {item.safetyNote}
        </p>
      )}
    </li>
  );
}
