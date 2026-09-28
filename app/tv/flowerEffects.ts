export type FlowerEffect = readonly [emoji: string, label: string];

export const SATIVA_EFFECTS: readonly FlowerEffect[] = [
  ["⚡", "Energy"],
  ["🧠", "Cerebral"],
  ["🚀", "Uplift"],
];

export const DEFAULT_EFFECTS: readonly FlowerEffect[] = [
  ["🛋️", "Couch Lock"],
  ["😌", "Relax"],
  ["🌙", "Sleepy"],
];

export function getFlowerEffects(type: string): readonly FlowerEffect[] {
  return type?.toLowerCase() === "sativa"
    ? SATIVA_EFFECTS
    : DEFAULT_EFFECTS;
}
