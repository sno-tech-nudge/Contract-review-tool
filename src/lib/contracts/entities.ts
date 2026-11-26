// The organisations a contract can belong to. Each contract sits in one
// bucket; it is detected from the contract's wording and can be changed.

export const ENTITIES = {
  nudge: {
    label: "The/Nudge",
    signals: ["nudge lifeskills", "nudge life skills", "the nudge institute", "the/nudge", "nudge institute", "nudge technologies", "nudge foundation"],
  },
  delta: {
    label: "the*delta",
    signals: ["the*delta", "the^delta", "the delta prize", "delta prize", "thedelta.org", "the*delta prize"],
  },
  spark: {
    label: "the*spark",
    signals: ["the*spark", "the^spark", "thespark.org", "the spark programme", "the spark program", "the spark prize"],
  },
} as const;

export type Entity = keyof typeof ENTITIES;
export const ENTITY_KEYS = Object.keys(ENTITIES) as Entity[];
export const isEntity = (v: unknown): v is Entity => typeof v === "string" && (ENTITY_KEYS as string[]).includes(v);
export const entityLabel = (key: string) => (isEntity(key) ? ENTITIES[key].label : "Not set");

// the*delta and the*spark are programmes of The/Nudge, so their own names win:
// a delta prize agreement is usually signed by The Nudge Institute.
export function detectEntity(text: string): Entity | "" {
  const flat = text.replace(/\s+/g, " ").toLowerCase();
  for (const key of ["delta", "spark", "nudge"] as const) {
    if (ENTITIES[key].signals.some((s) => flat.includes(s))) return key;
  }
  return "";
}
