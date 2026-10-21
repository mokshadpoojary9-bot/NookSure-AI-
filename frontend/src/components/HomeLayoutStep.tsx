import { useId } from "react";
import {
  CUSTOM_ROOM_CHOICES,
  HOME_TYPE_HINTS,
  HOME_TYPE_LABELS,
  HomeLayoutSchema,
  HomeTypeSchema,
  choiceLabel,
  generateRooms,
  type HomeLayout,
  type HomeType,
} from "@nooksure/shared";

interface Props {
  layout?: HomeLayout;
  onChange(layout: HomeLayout): void;
}

function YesNo({ legend, value, onChange }: { legend: string; value: boolean; onChange(v: boolean): void }) {
  const name = useId();
  return (
    <fieldset className="question">
      <legend>{legend}</legend>
      <div className="chips">
        {[true, false].map((v) => (
          <label key={String(v)} className="chip">
            <input type="radio" name={name} checked={value === v} onChange={() => onChange(v)} />
            {v ? "Yes" : "No"}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** "Your home": home type + a few layout questions → the rooms this home has. */
export function HomeLayoutStep({ layout, onChange }: Props) {
  const typeName = useId();
  const bathName = useId();
  const set = (patch: Partial<HomeLayout>) => layout && onChange(HomeLayoutSchema.parse({ ...layout, ...patch }));

  const pickType = (homeType: HomeType) => {
    const base = layout ?? HomeLayoutSchema.parse({ homeType });
    // Switching to Custom starts from the rooms you have now (merged parts included).
    const customRooms =
      homeType === "custom" && base.homeType !== "custom" && layout
        ? generateRooms(layout).flatMap((s) => [s.id, ...s.merged])
        : base.customRooms;
    onChange(HomeLayoutSchema.parse({ ...base, homeType, customRooms }));
  };

  const studio = layout?.homeType === "studio";
  const custom = layout?.homeType === "custom";
  const main = studio ? "main room" : "living room";
  const rooms = layout ? generateRooms(layout) : [];

  return (
    <>
      <h2 id="step-heading">Tell us about your home</h2>
      <p className="hint">This sets up the rooms for your plan. You can change it any time.</p>

      <fieldset>
        <legend>What kind of home is it?</legend>
        <div className="home-cards">
          {HomeTypeSchema.options.map((t) => (
            <label key={t} className="home-card">
              <input type="radio" name={typeName} checked={layout?.homeType === t} onChange={() => pickType(t)} />
              <span className="home-card-title">{HOME_TYPE_LABELS[t]}</span>
              <span className="home-card-hint">{HOME_TYPE_HINTS[t]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {layout && (
        <div className="home-questions">
          {custom && (
            <fieldset className="question">
              <legend>Which rooms does your home have?</legend>
              <div className="chips">
                {CUSTOM_ROOM_CHOICES.map((id) => (
                  <label key={id} className="chip">
                    <input
                      type="checkbox"
                      checked={layout.customRooms.includes(id)}
                      onChange={() =>
                        set({
                          customRooms: layout.customRooms.includes(id)
                            ? layout.customRooms.filter((r) => r !== id)
                            : [...layout.customRooms, id],
                        })
                      }
                    />
                    {choiceLabel(id)}
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <YesNo
            legend={`Does your main door open straight into the ${main}?`}
            value={layout.doorIntoLiving}
            onChange={(doorIntoLiving) => set({ doorIntoLiving })}
          />
          <YesNo
            legend={studio ? "Is the kitchen part of the main room (a kitchenette)?" : "Is your kitchen open to the living room?"}
            value={layout.openKitchen}
            onChange={(openKitchen) => set({ openKitchen })}
          />

          {!custom && (
            <>
              <fieldset className="question">
                <legend>How many bathrooms?</legend>
                <div className="chips">
                  {[1, 2, 3].map((n) => (
                    <label key={n} className="chip">
                      <input type="radio" name={bathName} checked={layout.bathrooms === n} onChange={() => set({ bathrooms: n })} />
                      {n}
                    </label>
                  ))}
                </div>
              </fieldset>
              {!studio && (
                <YesNo
                  legend="Is a bathroom attached to a bedroom?"
                  value={layout.attachedBathroom}
                  onChange={(attachedBathroom) => set({ attachedBathroom })}
                />
              )}
              <YesNo legend="Is there a balcony?" value={layout.balcony} onChange={(balcony) => set({ balcony })} />
            </>
          )}

          <div className="home-summary" aria-live="polite">
            <strong>Your rooms:</strong>{" "}
            {rooms.length ? rooms.map((r) => r.label).join(", ") : "none yet — pick at least one room above."}
          </div>
        </div>
      )}
    </>
  );
}
