import { describe, expect, it } from "vitest";
import { RoomTypeSchema, generatePlan, type HomeProfile } from "@nooksure/shared";
import { CONCERN_PRIORITY, ROOM_D, ROOM_W, STATUS_COLORS, WALL_H, buildRoomScene } from "./sceneModel";

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
