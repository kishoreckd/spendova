import {
  Bike,
  Camera,
  Car,
  Headphones,
  Laptop,
  Package,
  Smartphone,
  Sofa,
  Tablet,
  Tag,
  Tv,
  WashingMachine,
  Watch,
} from "lucide-react";
import type { Tile } from "@/components/common/tile-picker";

export const presetAssetTypes: Tile[] = [
  { value: "phone", label: "Phone", icon: Smartphone, color: "#0891b2" },
  { value: "computer", label: "Laptop", icon: Laptop, color: "#7c3aed" },
  { value: "tablet", label: "Tablet", icon: Tablet, color: "#0284c7" },
  { value: "watch", label: "Watch", icon: Watch, color: "#db2777" },
  { value: "audio", label: "Audio", icon: Headphones, color: "#d97706" },
  { value: "camera", label: "Camera", icon: Camera, color: "#475569" },
  { value: "tv", label: "TV", icon: Tv, color: "#2563eb" },
  { value: "vehicle", label: "Car", icon: Car, color: "#059669" },
  { value: "two-wheeler", label: "Two-wheeler", icon: Bike, color: "#65a30d" },
  {
    value: "appliance",
    label: "Appliance",
    icon: WashingMachine,
    color: "#0f766e",
  },
  { value: "furniture", label: "Furniture", icon: Sofa, color: "#b45309" },
  { value: "other", label: "Other", icon: Package, color: "#64748b" },
];

const presetsByValue = new Map(
  presetAssetTypes.map((tile) => [tile.value, tile]),
);

/** A preset, or a tile for a type the user typed themselves. */
export function assetTypeTile(value: string): Tile {
  return (
    presetsByValue.get(value) ?? {
      value,
      label: value,
      icon: Tag,
      color: "#0d9488",
    }
  );
}

/** Presets first, then the user's own types in the order first used. */
export function assetTypeTiles(usedTypes: string[]): Tile[] {
  const custom = [...new Set(usedTypes)].filter(
    (value) => value && !presetsByValue.has(value),
  );
  return [...presetAssetTypes, ...custom.map(assetTypeTile)];
}
