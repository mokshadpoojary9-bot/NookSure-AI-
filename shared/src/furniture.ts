import { z } from "zod";
import { typesOf, type RoomSpace, type RoomType } from "./home";

/** Furniture and fittings people can tell us they already have, per room. */
export const FurnitureItemSchema = z.enum([
  // living room
  "sofa",
  "armchair",
  "coffee_table",
  "tv_unit",
  "rug",
  "floor_lamp",
  "plants",
  "shelves",
  // bedroom
  "bed",
  "side_tables",
  "wardrobe",
  "bedside_lamp",
  "chair",
  // kitchen
  "dining_table",
  "chairs",
  "fridge",
  "counter_stove",
  "storage_cabinets",
  // bathroom
  "toilet_western",
  "toilet_indian",
  "washbasin",
  "shower",
  "bathtub",
  "bucket_mug",
  "stool",
  "mirror",
  "towel_rail",
  "bath_mat",
  // entrance
  "shoe_rack",
  "door_mat",
  "cabinet",
  // garden / outdoor
  "bench",
  "garden_chairs",
  "garden_table",
  "plant_pots",
  "garden_lights",
  "hose",
]);
export type FurnitureItem = z.infer<typeof FurnitureItemSchema>;

export const FURNITURE_LABELS: Record<FurnitureItem, { label: string; icon: string }> = {
  sofa: { label: "Sofa", icon: "🛋️" },
  armchair: { label: "Armchair", icon: "🪑" },
  coffee_table: { label: "Coffee table", icon: "☕" },
  tv_unit: { label: "TV unit", icon: "📺" },
  rug: { label: "Rug", icon: "🟫" },
  floor_lamp: { label: "Floor lamp", icon: "💡" },
  plants: { label: "Plants", icon: "🪴" },
  shelves: { label: "Shelves", icon: "📚" },
  bed: { label: "Bed", icon: "🛏️" },
  side_tables: { label: "Side tables", icon: "🗄️" },
  wardrobe: { label: "Wardrobe or drawers", icon: "🚪" },
  bedside_lamp: { label: "Bedside lamp", icon: "💡" },
  chair: { label: "Chair", icon: "🪑" },
  dining_table: { label: "Dining table", icon: "🍽️" },
  chairs: { label: "Chairs", icon: "🪑" },
  fridge: { label: "Fridge", icon: "🧊" },
  counter_stove: { label: "Counter and stove", icon: "🍳" },
  storage_cabinets: { label: "Storage cabinets", icon: "🗄️" },
  toilet_western: { label: "Toilet (Western style)", icon: "🚽" },
  toilet_indian: { label: "Toilet (Indian style)", icon: "🚽" },
  washbasin: { label: "Washbasin", icon: "🚰" },
  shower: { label: "Shower", icon: "🚿" },
  bathtub: { label: "Bathtub", icon: "🛁" },
  bucket_mug: { label: "Bucket and mug", icon: "🪣" },
  stool: { label: "Stool", icon: "🪑" },
  mirror: { label: "Mirror", icon: "🪞" },
  towel_rail: { label: "Towel rail", icon: "🧺" },
  bath_mat: { label: "Bath mat", icon: "🟦" },
  shoe_rack: { label: "Shoe rack", icon: "👟" },
  door_mat: { label: "Door mat", icon: "🟫" },
  cabinet: { label: "Cabinet", icon: "🗄️" },
  bench: { label: "Bench", icon: "🪑" },
  garden_chairs: { label: "Chairs", icon: "🪑" },
  garden_table: { label: "Table", icon: "🪵" },
  plant_pots: { label: "Plant pots", icon: "🪴" },
  garden_lights: { label: "Garden lights", icon: "💡" },
  hose: { label: "Hose", icon: "🧵" },
};

export const FURNITURE_BY_ROOM: Partial<Record<RoomType, readonly FurnitureItem[]>> = {
  living_room: ["sofa", "armchair", "coffee_table", "tv_unit", "rug", "floor_lamp", "plants", "shelves"],
  bedroom: ["bed", "side_tables", "wardrobe", "bedside_lamp", "rug", "chair"],
  kitchen: ["dining_table", "chairs", "fridge", "counter_stove", "storage_cabinets"],
  bathroom: ["toilet_western", "toilet_indian", "washbasin", "shower", "bathtub", "bucket_mug", "stool", "mirror", "towel_rail", "bath_mat"],
  entrance: ["shoe_rack", "door_mat", "cabinet"],
};

export const RoomFurnitureSchema = z.object({
  items: z.array(FurnitureItemSchema).default([]),
  /** Anything else, in the user's words. */
  other: z.string().max(200).default(""),
  /** The user chose to skip this room's furniture question. */
  skipped: z.boolean().default(false),
});
export type RoomFurniture = z.infer<typeof RoomFurnitureSchema>;

/** Items to ask about for a space: its own type's list plus merged rooms' lists, without repeats. */
export function furnitureChoicesFor(space: RoomSpace): FurnitureItem[] {
  return [...new Set(typesOf(space).flatMap((t) => FURNITURE_BY_ROOM[t] ?? []))];
}
