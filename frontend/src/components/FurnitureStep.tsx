import {
  FURNITURE_LABELS,
  furnitureChoicesFor,
  spaceOf,
  type FurnitureItem,
  type HomeProfile,
  type RoomFurniture,
  type RoomId,
} from "@nooksure/shared";

interface Props {
  profile: HomeProfile;
  setProfile: (update: (p: HomeProfile) => HomeProfile) => void;
}

const EMPTY: RoomFurniture = { items: [], other: "", skipped: false };

/** "What furniture do you have?" — per selected room. Optional; helps the plan reuse what's there. */
export function FurnitureStep({ profile, setProfile }: Props) {
  const update = (room: RoomId, patch: Partial<RoomFurniture>) =>
    setProfile((p) => {
      const current = p.furniture?.[room] ?? EMPTY;
      return { ...p, furniture: { ...p.furniture, [room]: { ...current, ...patch } } };
    });
  const toggle = (room: RoomId, item: FurnitureItem) => {
    const items = profile.furniture?.[room]?.items ?? [];
    update(room, { items: items.includes(item) ? items.filter((i) => i !== item) : [...items, item], skipped: false });
  };

  return (
    <>
      <h2 id="step-heading">What furniture do you already have?</h2>
      <p className="hint">
        Tick what’s in each room so your plan can reuse it, and the 3D view can show it. This step is optional — skip any
        room you like.
      </p>
      <div className="room-grid">
        {profile.rooms.map((room) => {
          const space = spaceOf(profile, room);
          const choices = furnitureChoicesFor(space);
          const state = profile.furniture?.[room] ?? EMPTY;
          return (
            <fieldset key={room} className={`room-card furniture-card${state.skipped ? " skipped" : ""}`}>
              <legend>{space.label}</legend>
              {choices.length === 0 ? (
                <p className="hint">No furniture questions for this room.</p>
              ) : (
                <>
                  <div className="furniture-grid">
                    {choices.map((item) => (
                      <label key={item} className="furniture-chip">
                        <input
                          type="checkbox"
                          checked={state.items.includes(item)}
                          disabled={state.skipped}
                          onChange={() => toggle(room, item)}
                        />
                        <span className="furniture-icon" aria-hidden="true">
                          {FURNITURE_LABELS[item].icon}
                        </span>
                        {FURNITURE_LABELS[item].label}
                      </label>
                    ))}
                  </div>
                  <label className="field furniture-other">
                    Other (optional)
                    <input
                      type="text"
                      maxLength={200}
                      value={state.other}
                      disabled={state.skipped}
                      placeholder="e.g. walking frame, recliner"
                      onChange={(e) => update(room, { other: e.target.value })}
                    />
                  </label>
                </>
              )}
              {choices.length > 0 && (
                <label className="check furniture-skip">
                  <input type="checkbox" checked={state.skipped} onChange={(e) => update(room, { skipped: e.target.checked })} />
                  Skip this room
                </label>
              )}
            </fieldset>
          );
        })}
      </div>
    </>
  );
}
