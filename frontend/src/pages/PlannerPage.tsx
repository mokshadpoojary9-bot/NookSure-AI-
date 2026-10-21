import { useEffect, useMemo, useRef, useState } from "react";
import {
  CONCERNS,
  KIND_LABELS,
  KIND_ORDER,
  MOBILITY_AID_LABELS,
  MobilityAidSchema,
  applyLayout,
  concernsFor,
  generatePlan,
  spaceOf,
  spacesOf,
  type Concern,
  type HomeLayout,
  type HomeProfile,
  type MobilityAid,
  type PlanItem,
  type RoomId,
} from "@nooksure/shared";
import { HomeLayoutStep } from "../components/HomeLayoutStep";
import { SavePlanPanel } from "../components/SavePlanPanel";
import { LazyRoomView3D } from "../components/room3d/LazyRoomView3D";
import { PLAN_STEP, clearState, emptyState, loadState, saveState, type PlannerState } from "../storage";

const STEPS = ["Household", "Your home", "Rooms", "Observations", "Your plan"] as const;
const HOME_STEP = 1;
const ROOMS_STEP = 2;
const OBSERVE_STEP = 3;

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

  // Editing the layout keeps selections that still apply (see applyLayout).
  const setLayout = (layout: HomeLayout) =>
    setState((s) => {
      const next = applyLayout(s.profile, s.done, layout);
      return { ...s, profile: next.profile, done: next.done };
    });

  const homeReady = Boolean(profile.layout) && spacesOf(profile).length > 0;
  const canContinue = step === HOME_STEP ? homeReady : step === ROOMS_STEP ? profile.rooms.length > 0 : true;

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
        {step === HOME_STEP && <HomeLayoutStep layout={profile.layout} onChange={setLayout} />}
        {step === ROOMS_STEP && <RoomsStep profile={profile} setProfile={setProfile} />}
        {step === OBSERVE_STEP && <ObservationsStep profile={profile} setProfile={setProfile} />}
        {step === PLAN_STEP && (
          <PlanStep
            plan={plan}
            profile={profile}
            done={done}
            onToggleDone={(id) => setState((s) => ({ ...s, done: toggle(s.done, id) }))}
          />
        )}
        {step === PLAN_STEP && (
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
          {step < PLAN_STEP && (
            <button type="button" className="button primary" disabled={!canContinue} onClick={() => goTo(step + 1)}>
              {step === OBSERVE_STEP ? "Build my plan" : "Continue"}
            </button>
          )}
          {step === PLAN_STEP && (
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
        {step === HOME_STEP && !canContinue && (
          <p className="hint">{profile.layout ? "Pick at least one room to continue." : "Choose your type of home to continue."}</p>
        )}
        {step === ROOMS_STEP && !canContinue && <p className="hint">Choose at least one room to continue.</p>}
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
        <legend>Rooms in your home</legend>
        <div className="chips">
          {spacesOf(profile).map((space) => (
            <label key={space.id} className="chip">
              <input
                type="checkbox"
                checked={profile.rooms.includes(space.id)}
                onChange={() => setProfile((p) => ({ ...p, rooms: toggle(p.rooms, space.id) }))}
              />
              {space.label}
            </label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

function ObservationsStep({ profile, setProfile }: StepProps) {
  const toggleConcern = (room: RoomId, concern: Concern) =>
    setProfile((p) => ({ ...p, concerns: { ...p.concerns, [room]: toggle(p.concerns[room] ?? [], concern) } }));

  return (
    <>
      <h2 id="step-heading">What do you notice in each room?</h2>
      <p className="hint">Tick anything that applies. Leave a room blank if nothing stands out.</p>
      <div className="room-grid">
        {profile.rooms.map((room) => (
          <fieldset key={room} className="room-card">
            <legend>{spaceOf(profile, room).label}</legend>
            {concernsFor(spaceOf(profile, room)).map((concern) => (
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

interface Selection {
  room: RoomId;
  concern: Concern;
}

const reducedMotion = () =>
  typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function PlanStep({
  plan,
  profile,
  done,
  onToggleDone,
}: {
  plan: PlanItem[];
  profile: HomeProfile;
  done: string[];
  onToggleDone: (id: string) => void;
}) {
  const completed = plan.filter((i) => done.includes(i.id)).length;
  const [show3D, setShow3D] = useState(false);
  const [roomChoice, setRoomChoice] = useState<RoomId | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);

  const rooms = profile.rooms;
  // Default to the first room that has something to show.
  const firstWithItems = rooms.find((r) => plan.some((i) => i.room === r)) ?? rooms[0];
  const room = roomChoice && rooms.includes(roomChoice) ? roomChoice : firstWithItems;

  const isSelected = (item: PlanItem) => selected?.room === item.room && selected.concern === item.concern;
  const selectedCount = plan.filter(isSelected).length;

  // 3D → list: highlight and scroll to the matching checklist items.
  const selectFrom3D = (concern: Concern) => {
    if (!room) return;
    setSelected({ room, concern });
    const first = plan.find((i) => i.room === room && i.concern === concern);
    if (first) {
      document.getElementById(planItemDomId(first.id))?.scrollIntoView?.({
        behavior: reducedMotion() ? "auto" : "smooth",
        block: "center",
      });
    }
  };
  // List → 3D: select the item's issue and show its room.
  const selectFromList = (item: PlanItem) => {
    setSelected({ room: item.room, concern: item.concern });
    setRoomChoice(item.room);
  };

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
          <div className="view-toggle">
            <button
              type="button"
              className="button"
              aria-expanded={show3D}
              aria-controls="room3d-panel"
              onClick={() => setShow3D((v) => !v)}
            >
              {show3D ? "Hide 3D view" : "Show 3D view"}
            </button>
          </div>
          {show3D && room && (
            <div id="room3d-panel" className="room3d-panel">
              {rooms.length > 1 && (
                <div className="chips room-picker" role="group" aria-label="Room to show in 3D">
                  {rooms.map((r) => (
                    <button
                      key={r}
                      type="button"
                      className="chip"
                      aria-pressed={r === room}
                      onClick={() => setRoomChoice(r)}
                    >
                      {spaceOf(profile, r).label}
                    </button>
                  ))}
                </div>
              )}
              <LazyRoomView3D
                room={room}
                profile={profile}
                done={done}
                selected={selected && selected.room === room ? selected.concern : null}
                onSelect={selectFrom3D}
              />
              <p className="visually-hidden" aria-live="polite">
                {selected && selectedCount > 0
                  ? `${CONCERNS[selected.concern].label} in the ${spaceOf(profile, selected.room).label.toLowerCase()}: ${selectedCount} checklist ${selectedCount === 1 ? "item" : "items"} highlighted.`
                  : ""}
              </p>
            </div>
          )}
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
                      roomLabel={spaceOf(profile, item.room).label}
                      done={done.includes(item.id)}
                      selected={isSelected(item)}
                      onSelect={() => selectFromList(item)}
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

const planItemDomId = (id: string) => `plan-item-${id.replace(/[^a-z0-9_-]/gi, "-")}`;

function PlanItemCard({
  item,
  roomLabel,
  done,
  selected,
  onSelect,
  onToggle,
}: {
  item: PlanItem;
  roomLabel: string;
  done: boolean;
  selected: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  return (
    // Clicking anywhere on the card (including the checkbox) also selects its issue in the 3D view.
    <li
      id={planItemDomId(item.id)}
      className={`plan-item${done ? " done" : ""}${selected ? " selected" : ""}`}
      data-selected={selected || undefined}
      onClick={onSelect}
    >
      <label className="plan-check">
        <input type="checkbox" checked={done} onChange={onToggle} />
        <span className="visually-hidden">Mark done: </span>
        <span className="plan-title">{item.title}</span>
      </label>
      <div className="plan-meta">
        <span className="badge">{roomLabel}</span>
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
