/**
 * The step library (UX §4 "Routine runner"): a picture for each routine step, chosen when the
 * routine is made, so a child who can't read yet can follow along. Keys are stored; the labels
 * are what a parent sees when choosing.
 */
import {
  Apple,
  Backpack,
  Bath,
  BedDouble,
  BookOpen,
  Dog,
  Footprints,
  GlassWater,
  Glasses,
  Hand,
  Moon,
  Music,
  PencilLine,
  Pill,
  Shirt,
  ShowerHead,
  Smile,
  Sparkles,
  Sun,
  Toothbrush,
  Trash2,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

export const STEP_ICONS: Record<string, { label: string; Icon: LucideIcon }> = {
  toothbrush: { label: "Teeth", Icon: Toothbrush },
  bed: { label: "Bed", Icon: BedDouble },
  book: { label: "Book", Icon: BookOpen },
  shirt: { label: "Clothes", Icon: Shirt },
  backpack: { label: "Backpack", Icon: Backpack },
  sun: { label: "Morning", Icon: Sun },
  moon: { label: "Night", Icon: Moon },
  bath: { label: "Bath", Icon: Bath },
  shower: { label: "Shower", Icon: ShowerHead },
  plate: { label: "Meal", Icon: UtensilsCrossed },
  dog: { label: "Pet", Icon: Dog },
  water: { label: "Water", Icon: GlassWater },
  snack: { label: "Snack", Icon: Apple },
  shoes: { label: "Shoes", Icon: Footprints },
  hands: { label: "Wash hands", Icon: Hand },
  glasses: { label: "Glasses", Icon: Glasses },
  medicine: { label: "Medicine", Icon: Pill },
  tidy: { label: "Tidy up", Icon: Sparkles },
  trash: { label: "Trash", Icon: Trash2 },
  homework: { label: "Homework", Icon: PencilLine },
  music: { label: "Practice", Icon: Music },
  smile: { label: "Anything else", Icon: Smile },
};

export function stepIcon(key: string | null | undefined): LucideIcon {
  return (key ? STEP_ICONS[key]?.Icon : undefined) ?? Smile;
}
