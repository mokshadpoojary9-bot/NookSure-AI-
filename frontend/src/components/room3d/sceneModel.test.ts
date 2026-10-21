import { describe, expect, it } from "vitest";
import { RoomTypeSchema, generatePlan, type HomeProfile } from "@nooksure/shared";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import manifest from "./models.manifest.json";
import { CONCERN_PRIORITY, MODELS, ROOM_D, ROOM_W, STATUS_COLORS, WALL_H, buildRoomScene, fitModel } from "./sceneModel";

const profile = (p: Partial<HomeProfile>): HomeProfile => ({ aids: [], rooms: [], concerns: {}, notes: "", ...p });

describe("buildRoomScene", () => {
  it("shows only the selected room's applicable issues, coloured by priority", () => {
    const p = profile({
      rooms: ["bathroom", "kitchen"],
      concerns: { bathroom: ["no_support_rail", "clutter", "trailing_cables"], kitchen: ["poor_lighting"] },
    });
    const scene = buildRoomScene("bathroom", p, []);
    // trailing_cables doesn't apply to bathrooms; kitchen issues aren't in this room.
    expect(scene.issues.map((i) => [i.concern, i.status])).toEqual([
      ["no_support_rail", "high"],
      ["clutter", "medium"],
    ]);
    expect(scene.issues[0]!.boxes.every((b) => b.color === STATUS_COLORS.high)).toBe(true);
    expect(scene.issues[1]!.boxes.every((b) => b.color === STATUS_COLORS.medium)).toBe(true);
  });

  it("marks an issue done (green) only when all its checklist items are done", () => {
    const p = profile({ rooms: ["living_room"], concerns: { living_room: ["clutter"] } });
    const ids = generatePlan(p).map((i) => i.id);
    expect(ids.length).toBeGreaterThan(1);
    expect(buildRoomScene("living_room", p, ids.slice(0, 1)).issues[0]!.status).toBe("medium");
    const done = buildRoomScene("living_room", p, ids).issues[0]!;
    expect(done.status).toBe("done");
    expect(done.boxes.every((b) => b.color === STATUS_COLORS.done)).toBe(true);
  });

  it("labels missing support as a zone, never as a rail or handle to grab", () => {
    const issue = buildRoomScene("bathroom", profile({ rooms: ["bathroom"], concerns: { bathroom: ["no_support_rail"] } }), [])
      .issues[0]!;
    expect(issue.label).toBe("Support needed");
    expect(issue.boxes.map((b) => b.key)).toEqual(["support-zone"]);
  });

  it("keeps every object inside the room and on or above the floor, for every room and issue", () => {
    for (const room of RoomTypeSchema.options) {
      const allConcerns = Object.keys(CONCERN_PRIORITY) as (keyof typeof CONCERN_PRIORITY)[];
      const scene = buildRoomScene(room, profile({ rooms: [room], concerns: { [room]: allConcerns } }), []);
      expect(scene.furniture.length).toBeGreaterThan(0);
      for (const b of [...scene.furniture, ...scene.issues.flatMap((i) => i.boxes)]) {
        const [x, y, z] = b.position;
        const [w, h, d] = b.size;
        expect(y - h / 2, `${room}/${b.key} below floor`).toBeGreaterThanOrEqual(-1e-9);
        expect(y + h / 2, `${room}/${b.key} above walls`).toBeLessThanOrEqual(WALL_H);
        expect(Math.abs(x) + w / 2, `${room}/${b.key} outside x`).toBeLessThanOrEqual(ROOM_W / 2 + 1e-9);
        expect(Math.abs(z) + d / 2, `${room}/${b.key} outside z`).toBeLessThanOrEqual(ROOM_D / 2 + 1e-9);
      }
    }
  });
});

describe("real furniture models", () => {
  const empty = (room: (typeof RoomTypeSchema.options)[number]) => profile({ rooms: [room] });
  const slots = RoomTypeSchema.options.flatMap((room) =>
    buildRoomScene(room, empty(room), []).furniture.filter((b) => b.model).map((b) => ({ room, b })),
  );

  it("every model a room uses is a verified manifest model", () => {
    for (const { b } of slots) expect(MODELS[b.model!], b.model).toBeDefined();
  });

  it("every manifest model file ships in public/models", () => {
    for (const { file } of Object.values(MODELS)) {
      // Tests run from frontend/ (npm workspaces); also allow running from the repo root.
      const candidates = [resolve("public", file), resolve("frontend/public", file)];
      expect(candidates.some(existsSync), `missing ${file}`).toBe(true);
    }
  });

  it("every model has an allowed licence, with an author for attribution", () => {
    for (const m of manifest.models) {
      expect(["CC0", "CC-BY-4.0"], m.id).toContain(m.license);
      expect(m.author.length, m.id).toBeGreaterThan(0);
      expect(m.bytes, `${m.id} over 5 MB`).toBeLessThan(5 * 1024 * 1024);
    }
  });

  it("fits each model inside its slot and the room, on the floor, at a sensible scale", () => {
    for (const { room, b } of slots) {
      const fit = fitModel(b, b.model!);
      const where = `${room}/${b.key}`;
      expect(fit.scale, `${where} scale`).toBeGreaterThan(0.5);
      expect(fit.scale, `${where} scale`).toBeLessThan(1.3);
      fit.size.forEach((v, i) => expect(v, `${where} size[${i}]`).toBeLessThanOrEqual(b.size[i]! + 1e-9));
      expect(fit.position[1], `${where} floor`).toBe(0);
      expect(Math.abs(fit.position[0]) + fit.size[0] / 2, `${where} x`).toBeLessThanOrEqual(ROOM_W / 2);
      expect(Math.abs(fit.position[2]) + fit.size[2] / 2, `${where} z`).toBeLessThanOrEqual(ROOM_D / 2);
    }
  });

  it("keeps the coffee table at its original scale and orientation", () => {
    const table = slots.find((s) => s.b.model === "coffee-table")!.b;
    const fit = fitModel(table, "coffee-table");
    expect(fit.scale).toBeCloseTo(1, 2);
    expect(fit.rotationY).toBeCloseTo(Math.PI / 2);
  });
});

describe("merged spaces", () => {
  const studio = profile({
    layout: { homeType: "studio", doorIntoLiving: true, openKitchen: true, bathrooms: 1, attachedBathroom: false, balcony: false, customRooms: [] },
    rooms: ["living_room"],
    concerns: { living_room: ["entry_step", "slippery_floor", "poor_lighting", "no_support_rail"] },
  });

  it("render as one room with a clear label and the merged rooms' furniture", () => {
    const scene = buildRoomScene("living_room", studio, []);
    expect(scene.label).toBe("Main room (living + sleeping + entrance + kitchenette)");
    const keys = scene.furniture.map((b) => b.key);
    expect(keys).toEqual(expect.arrayContaining(["sofa", "studio-bed", "kitchenette", "entry-shoe-rack"]));
    // Issues from the merged entrance and kitchen show up in the same room.
    expect(scene.issues.map((i) => i.concern)).toEqual(["entry_step", "slippery_floor", "poor_lighting", "no_support_rail"]);
  });

  it("keep merged furniture and markers inside the room and above the floor", () => {
    const scene = buildRoomScene("living_room", studio, []);
    for (const b of [...scene.furniture, ...scene.issues.flatMap((i) => i.boxes)]) {
      const [x, y, z] = b.position;
      const [w, h, d] = b.size;
      expect(y - h / 2, `${b.key} below floor`).toBeGreaterThanOrEqual(-1e-9);
      expect(Math.abs(x) + w / 2, `${b.key} outside x`).toBeLessThanOrEqual(ROOM_W / 2 + 1e-9);
      expect(Math.abs(z) + d / 2, `${b.key} outside z`).toBeLessThanOrEqual(ROOM_D / 2 + 1e-9);
    }
  });

  it("numbered rooms reuse their base layout with their own label", () => {
    const p = profile({
      layout: { homeType: "2bhk", doorIntoLiving: false, openKitchen: false, bathrooms: 1, attachedBathroom: false, balcony: true, customRooms: [] },
      rooms: ["bedroom_2", "balcony"],
    });
    expect(buildRoomScene("bedroom_2", p, [])).toMatchObject({ type: "bedroom", label: "Bedroom 2" });
    expect(buildRoomScene("balcony", p, [])).toMatchObject({ type: "balcony", label: "Balcony" });
  });
});

describe("furniture-driven scenes and labels", () => {
  const living = (furniture: HomeProfile["furniture"], concerns: HomeProfile["concerns"] = {}) =>
    profile({ rooms: ["living_room"], concerns, furniture });

  it("shows only the furniture the user has, using real models where available", () => {
    const scene = buildRoomScene("living_room", living({ living_room: { items: ["sofa", "rug"], other: "", skipped: false } }), []);
    expect(scene.fromAnswers).toBe(true);
    expect(new Set(scene.furniture.map((b) => b.item))).toEqual(new Set(["sofa", "rug"]));
    expect(scene.furniture.find((b) => b.item === "sofa")?.model).toBe("sofa");
  });

  it("falls back to the default layout when there are no answers or the room was skipped", () => {
    expect(buildRoomScene("living_room", living(undefined), []).fromAnswers).toBe(false);
    const skipped = buildRoomScene("living_room", living({ living_room: { items: ["sofa"], other: "", skipped: true } }), []);
    expect(skipped.fromAnswers).toBe(false);
    expect(skipped.furniture.map((b) => b.key)).toContain("coffee-table"); // default living room
  });

  it("labels issues at the spot and the user's furniture with its advice", () => {
    const scene = buildRoomScene(
      "living_room",
      living({ living_room: { items: ["sofa", "floor_lamp"], other: "", skipped: false } }, { living_room: ["narrow_path", "poor_lighting"] }),
      [],
    );
    const texts = scene.labels.map((l) => l.text);
    expect(texts).toContain("Narrow path: keep this path clear");
    expect(texts).toContain("Dim lighting: add a night light here");
    expect(texts).toContain("Your sofa: move it back to widen the path");
    expect(texts).toContain("Move your floor lamp to light the route");
    const sofaLabel = scene.labels.find((l) => l.id === "furniture:sofa")!;
    const sofa = scene.furniture.find((b) => b.item === "sofa")!;
    expect(sofaLabel.at[0]).toBeCloseTo(sofa.position[0]);
    expect(sofaLabel.at[1]).toBeGreaterThan(sofa.position[1] + sofa.size[1] / 2);
    expect(sofaLabel.concern).toBe("narrow_path");
  });

  it("marks labels done when their checklist items are done", () => {
    const p = living({ living_room: { items: ["sofa"], other: "", skipped: false } }, { living_room: ["narrow_path"] });
    const done = ["living_room:narrow_path:f-sofa"];
    expect(buildRoomScene("living_room", p, done).labels.find((l) => l.id === "furniture:sofa")?.text).toMatch(/^✓ Done — /);
  });

  it("merged rooms combine their furniture without overlaps", () => {
    const p = profile({
      layout: { homeType: "studio", doorIntoLiving: true, openKitchen: true, bathrooms: 1, attachedBathroom: false, balcony: false, customRooms: [] },
      rooms: ["living_room"],
      furniture: { living_room: { items: ["sofa", "bed", "fridge", "counter_stove", "shoe_rack", "dining_table", "chairs"], other: "", skipped: false } },
    });
    const floor = buildRoomScene("living_room", p, []).furniture.filter((b) => b.support === "floor");
    expect(new Set(floor.map((b) => b.item))).toEqual(new Set(["sofa", "bed", "fridge", "counter_stove", "shoe_rack", "dining_table", "chairs"]));
    for (let i = 0; i < floor.length; i++)
      for (let j = i + 1; j < floor.length; j++) {
        const [a, b] = [floor[i]!, floor[j]!];
        const apart = [0, 2].some((k) => Math.abs(a.position[k]! - b.position[k]!) >= (a.size[k]! + b.size[k]!) / 2 - 0.005);
        expect(apart, `${a.key} overlaps ${b.key}`).toBe(true);
      }
  });
});
