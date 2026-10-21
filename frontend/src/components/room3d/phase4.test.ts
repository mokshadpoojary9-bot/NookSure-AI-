import { describe, expect, it } from "vitest";
import { HomeLayoutSchema, type HomeProfile, type RoomType } from "@nooksure/shared";
import { decorFor } from "./decor";
import { furnitureBoxes } from "./furnitureLayout";
import { TURNING_DIAMETER, computeOverlays } from "./overlays";
import { ATTACHED_DOOR, ROOM_D, ROOM_W, WALL_H, buildRoomScene, type Box } from "./sceneModel";

const profile = (p: Partial<HomeProfile>): HomeProfile => ({ aids: [], rooms: [], concerns: {}, notes: "", ...p });
const overlap = (a: Box, b: Box) => [0, 1, 2].every((i) => Math.abs(a.position[i]! - b.position[i]!) < (a.size[i]! + b.size[i]!) / 2 - 0.002);
const footprintDist = (x: number, z: number, b: Box) =>
  Math.hypot(Math.max(Math.abs(x - b.position[0]) - b.size[0] / 2, 0), Math.max(Math.abs(z - b.position[2]) - b.size[2] / 2, 0));

describe("decor", () => {
  it("only sits on furniture the user has", () => {
    const withSofa = decorFor("living_room", furnitureBoxes("living_room", ["sofa"])!).map((d) => d.key);
    expect(withSofa).toContain("decor-pillows");
    expect(withSofa).not.toContain("decor-vase"); // no coffee table → no vase
    const kitchenNoCounter = decorFor("kitchen", furnitureBoxes("kitchen", ["fridge"])!).map((d) => d.key);
    expect(kitchenNoCounter).not.toContain("decor-kettle");
    expect(decorFor("kitchen", furnitureBoxes("kitchen", ["counter_stove"])!).map((d) => d.key)).toContain("decor-kettle");
  });

  it("never collides with furniture or wall units, and stays inside the room", () => {
    for (const type of ["living_room", "bedroom", "kitchen", "bathroom", "entrance"] as RoomType[]) {
      const scene = buildRoomScene(
        type,
        profile({ rooms: [type], furniture: { [type]: { items: ["sofa", "coffee_table", "storage_cabinets", "counter_stove", "side_tables", "toilet_western", "shower", "mirror", "towel_rail", "fridge", "bed", "wardrobe"], other: "", skipped: false } } }),
        [],
      );
      const decor = scene.furniture.filter((b) => b.key.startsWith("decor-"));
      const furniture = scene.furniture.filter((b) => !b.key.startsWith("decor-"));
      for (const d of decor) {
        const anchors = furniture.filter((f) => overlap(d, f));
        // Anything decor touches must be what it sits on (directly below it).
        for (const f of anchors) expect(Math.abs(d.position[1] - d.size[1] / 2 - (f.position[1] + f.size[1] / 2)) < 0.25 || d.key === "decor-pillows", `${type}: ${d.key} hits ${f.key}`).toBe(true);
        expect(Math.abs(d.position[0]) + d.size[0] / 2, `${d.key} x`).toBeLessThanOrEqual(ROOM_W / 2);
        expect(Math.abs(d.position[2]) + d.size[2] / 2, `${d.key} z`).toBeLessThanOrEqual(ROOM_D / 2);
        expect(d.position[1] + d.size[1] / 2, `${d.key} ceiling`).toBeLessThanOrEqual(WALL_H);
      }
    }
  });

  it("drops curtains that would collide with open-kitchen wall cabinets", () => {
    const keys = decorFor("living_room", furnitureBoxes("living_room", ["storage_cabinets"])!).map((d) => d.key);
    expect(keys).toContain("decor-curtain-l");
    expect(keys).not.toContain("decor-curtain-r");
  });
});

describe("accessibility overlays", () => {
  it("finds a 1.5 m turning circle clear of floor furniture, inside the room", () => {
    const scene = buildRoomScene("living_room", profile({ rooms: ["living_room"], furniture: { living_room: { items: ["sofa", "armchair", "coffee_table"], other: "", skipped: false } } }), []);
    const tc = computeOverlays(scene).turningCircle!;
    expect(tc.radius * 2).toBe(TURNING_DIAMETER);
    expect(Math.abs(tc.center[0]) + tc.radius).toBeLessThanOrEqual(ROOM_W / 2);
    expect(Math.abs(tc.center[1]) + tc.radius).toBeLessThanOrEqual(ROOM_D / 2);
    for (const b of scene.furniture.filter((f) => f.support === "floor")) expect(footprintDist(tc.center[0], tc.center[1], b), b.key).toBeGreaterThanOrEqual(tc.radius);
  });

  it("reports when no turning space fits", () => {
    const full = { living_room: { items: ["sofa", "armchair", "coffee_table", "tv_unit", "floor_lamp", "plants", "shelves", "counter_stove", "fridge", "dining_table", "chairs", "bed", "side_tables", "wardrobe", "chair", "shoe_rack", "cabinet"] as never[], other: "", skipped: false } };
    const scene = buildRoomScene("living_room", profile({ rooms: ["living_room"], furniture: full }), []);
    expect(computeOverlays(scene).turningCircle).toBeNull();
  });

  it("lists furniture that blocks the walking route from the door, and reports a clear route", () => {
    const empty = buildRoomScene("living_room", profile({ rooms: ["living_room"], furniture: { living_room: { items: ["rug"], other: "", skipped: false } } }), []);
    const clear = computeOverlays(empty).walkingPath;
    expect(clear.from[0]).toBeLessThan(-2.5); // starts at the door (left wall)
    expect(clear.blockedBy).toEqual([]);
    // Put one box right across the route from the door towards the middle of the room.
    const blockedScene = {
      ...empty,
      furniture: [...empty.furniture, { key: "box-in-the-way", position: [-1.5, 0.3, 0.65], size: [0.6, 0.6, 0.6], color: "#000", support: "floor" } as Box],
    };
    expect(computeOverlays(blockedScene).walkingPath.blockedBy).toEqual(["box-in-the-way"]);
  });

  it("grab bar zones are wall areas (never bars) by the toilet and shower; non-slip zones on the floor", () => {
    const scene = buildRoomScene("bathroom", profile({ rooms: ["bathroom"], furniture: { bathroom: { items: ["toilet_western", "shower", "bathtub"], other: "", skipped: false } } }), []);
    const o = computeOverlays(scene);
    expect(o.grabZones.map((z) => z.key)).toEqual(["grab-toilet", "grab-shower", "grab-bath"]);
    for (const z of o.grabZones) {
      const thin = Math.min(...z.size);
      expect(thin, z.key).toBeLessThanOrEqual(0.05); // flat panel on a wall
      expect(z.size[1] * Math.max(z.size[0], z.size[2]), `${z.key} area`).toBeGreaterThanOrEqual(0.2); // an area, not a bar
      expect(z.label).toMatch(/install by a professional/);
    }
    expect(o.nonSlipZones.map((z) => z.key)).toEqual(["non-slip-shower", "non-slip-bath", "non-slip-basin"]);
    for (const z of o.nonSlipZones) expect(z.size[1]).toBeLessThanOrEqual(0.02);
  });

  it("night-light path runs from the bed to the door, or to the attached bathroom", () => {
    const plain = buildRoomScene("bedroom", profile({ rooms: ["bedroom"] }), []);
    const lights = computeOverlays(plain).nightLights;
    expect(lights.length).toBeGreaterThan(2);
    expect(lights.at(-1)![0]).toBeLessThan(-2.5); // ends at the main door (left wall)

    const attached = buildRoomScene(
      "bedroom",
      profile({ layout: HomeLayoutSchema.parse({ homeType: "1bhk", attachedBathroom: true }), rooms: ["bedroom"] }),
      [],
    );
    expect(attached.attachedDoor).toEqual(ATTACHED_DOOR);
    expect(attached.labels.map((l) => l.text)).toContain("Door to attached bathroom");
    expect(computeOverlays(attached).nightLights.at(-1)![0]).toBeGreaterThan(2.4); // ends at the attached-bathroom door
  });

  it("keeps the attached-bathroom doorway clear of bedroom furniture", () => {
    const scene = buildRoomScene(
      "bedroom",
      profile({
        layout: HomeLayoutSchema.parse({ homeType: "1bhk", attachedBathroom: true }),
        rooms: ["bedroom"],
        furniture: { bedroom: { items: ["bed", "side_tables", "wardrobe", "chair", "rug", "bedside_lamp"], other: "", skipped: false } },
      }),
      [],
    );
    const door = { key: "door", position: [ROOM_W / 2 - 0.4, 1, ATTACHED_DOOR.z], size: [0.8, 2, ATTACHED_DOOR.width], color: "" } as Box;
    for (const b of scene.furniture.filter((f) => f.support === "floor")) expect(overlap(b, door), b.key).toBe(false);
  });

  it("no attached doorway for other bedrooms or when there is no attached bathroom", () => {
    expect(buildRoomScene("bedroom", profile({ layout: HomeLayoutSchema.parse({ homeType: "1bhk" }), rooms: ["bedroom"] }), []).attachedDoor).toBeUndefined();
    expect(
      buildRoomScene("bedroom_2", profile({ layout: HomeLayoutSchema.parse({ homeType: "2bhk", attachedBathroom: true }), rooms: ["bedroom_2"] }), []).attachedDoor,
    ).toBeUndefined();
  });
});
