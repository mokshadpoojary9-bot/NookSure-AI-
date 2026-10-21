import { describe, expect, it } from "vitest";
import { HomeLayoutSchema } from "./home";
import { changeLayout, type HomeProfile } from "./planner";

const layout = (l: object) => HomeLayoutSchema.parse({ homeType: "1bhk", ...l });

describe("turning a merge off splits observations back", () => {
  const merged: HomeProfile = {
    aids: [],
    notes: "",
    layout: layout({ doorIntoLiving: true, openKitchen: true }),
    rooms: ["living_room", "bedroom"],
    concerns: { living_room: ["entry_step", "slippery_floor", "clutter", "narrow_path"] },
    furniture: { living_room: { items: ["sofa", "shoe_rack", "door_mat", "fridge"], other: "", skipped: false } },
  };
  const done = ["living_room:entry_step:clear-step-area", "living_room:clutter:remove-clutter"];

  it("moves entrance-only issues, furniture and done items back to the entrance", () => {
    const { profile, done: d } = changeLayout(merged, done, layout({ doorIntoLiving: false, openKitchen: true }));
    expect(profile.concerns.entrance).toEqual(["entry_step"]);
    // slippery_floor still applies to the living room (it includes the open kitchen) — it stays.
    expect(profile.concerns.living_room).toEqual(["slippery_floor", "clutter", "narrow_path"]);
    expect(profile.furniture?.entrance?.items).toEqual(["shoe_rack", "door_mat"]);
    expect(profile.furniture?.living_room?.items).toEqual(["sofa", "fridge"]);
    expect(d).toEqual(["entrance:entry_step:clear-step-area", "living_room:clutter:remove-clutter"]);
    // The separated room is planned too, so nothing silently disappears.
    expect(profile.rooms).toEqual(expect.arrayContaining(["living_room", "entrance", "bedroom"]));
  });

  it("moves kitchen-only furniture back when the kitchen stops being open; shared issues stay", () => {
    const { profile } = changeLayout(merged, [], layout({ doorIntoLiving: true, openKitchen: false }));
    // A slippery floor can still be in the living room + entrance, so it stays there.
    expect(profile.concerns.kitchen).toBeUndefined();
    expect(profile.concerns.living_room).toEqual(["entry_step", "slippery_floor", "clutter", "narrow_path"]);
    expect(profile.furniture?.kitchen?.items).toEqual(["fridge"]);
    expect(profile.furniture?.living_room?.items).toEqual(["sofa", "shoe_rack", "door_mat"]);
  });

  it("merging and splitting round-trips", () => {
    const split = changeLayout(merged, done, layout({ doorIntoLiving: false, openKitchen: false }));
    const back = changeLayout(split.profile, split.done, layout({ doorIntoLiving: true, openKitchen: true }));
    expect(new Set(back.profile.concerns.living_room)).toEqual(new Set(merged.concerns.living_room));
    expect(new Set(back.profile.furniture?.living_room?.items)).toEqual(new Set(merged.furniture!.living_room!.items));
  });

  it("changes nothing extra when no merge is turned off", () => {
    const same = changeLayout(merged, done, merged.layout!);
    expect(same.profile.concerns).toEqual(merged.concerns);
    expect(same.done).toEqual(done);
  });
});
