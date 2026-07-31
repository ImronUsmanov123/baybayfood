import type { Pizza } from "@/lib/pizzas";

/**
 * Dynamic product customization config.
 *
 * Every menu item is customizable — the available groups (size / combo / extras)
 * and their prices depend on the product category (and optionally the product id).
 */

export type SizeOption = { id: string; multiplier: number };
export type ComboOption = { id: string; extra: number };
export type ExtraOption = { id: string; price: number };

export type ProductConfig = {
  sizes: SizeOption[];
  combos: ComboOption[];
  extras: ExtraOption[];
};

/** Master extras catalog (labels come from i18n keys `top_<id>`). */
const EXTRA_PRICES: Record<string, number> = {
  "extra-cheese": 8000,
  mushrooms: 6000,
  olives: 5000,
  jalapeno: 5000,
  onion: 4000,
  bacon: 10000,
};

const extras = (...ids: string[]): ExtraOption[] =>
  ids.map((id) => ({ id, price: EXTRA_PRICES[id] ?? 0 }));

const SIZES_STANDARD: SizeOption[] = [
  { id: "s", multiplier: 0.85 },
  { id: "m", multiplier: 1 },
  { id: "l", multiplier: 1.25 },
];

const SIZES_WIDE: SizeOption[] = [
  { id: "s", multiplier: 0.8 },
  { id: "m", multiplier: 1 },
  { id: "l", multiplier: 1.4 },
];

const COMBOS_FULL: ComboOption[] = [
  { id: "classic", extra: 0 },
  { id: "thin", extra: 12000 },
  { id: "cheesy", extra: 22000 },
];

const COMBOS_LIGHT: ComboOption[] = [
  { id: "classic", extra: 0 },
  { id: "cheesy", extra: 15000 },
];

const BY_CATEGORY: Record<string, ProductConfig> = {
  burgers: {
    sizes: SIZES_STANDARD,
    combos: COMBOS_FULL,
    extras: extras("extra-cheese", "mushrooms", "jalapeno", "onion", "bacon"),
  },
  hotdogs: {
    sizes: SIZES_STANDARD,
    combos: COMBOS_FULL,
    extras: extras("extra-cheese", "jalapeno", "onion", "bacon"),
  },
  chicken: {
    sizes: SIZES_WIDE,
    combos: COMBOS_FULL,
    extras: extras("extra-cheese", "jalapeno", "onion"),
  },
  wraps: {
    sizes: SIZES_STANDARD,
    combos: COMBOS_LIGHT,
    extras: extras("extra-cheese", "mushrooms", "olives", "jalapeno", "onion", "bacon"),
  },
  snacks: {
    sizes: SIZES_WIDE,
    combos: [],
    extras: extras("extra-cheese", "jalapeno"),
  },
  drinks: {
    sizes: SIZES_WIDE,
    combos: [],
    extras: [],
  },
  pizza: {
    sizes: SIZES_WIDE,
    combos: COMBOS_FULL,
    extras: extras("extra-cheese", "mushrooms", "olives", "jalapeno", "onion", "bacon"),
  },
};

const FALLBACK: ProductConfig = {
  sizes: SIZES_STANDARD,
  combos: [],
  extras: extras("extra-cheese", "jalapeno"),
};

export function getProductConfig(product: Pizza): ProductConfig {
  return BY_CATEGORY[product.category] ?? FALLBACK;
}

export type Selection = {
  sizeId: string;
  comboId: string;
  extraIds: string[];
};

export function defaultSelection(config: ProductConfig): Selection {
  return {
    sizeId: config.sizes.find((s) => s.id === "m")?.id ?? config.sizes[0]?.id ?? "",
    comboId: config.combos[0]?.id ?? "",
    extraIds: [],
  };
}

/** Live unit price for the current selection. */
export function computeUnitPrice(
  product: Pizza,
  config: ProductConfig,
  selection: Selection,
): number {
  const size = config.sizes.find((s) => s.id === selection.sizeId);
  const combo = config.combos.find((c) => c.id === selection.comboId);
  const extrasSum = config.extras
    .filter((e) => selection.extraIds.includes(e.id))
    .reduce((sum, e) => sum + e.price, 0);

  const base = product.basePrice * (size?.multiplier ?? 1);
  return Math.round(base + (combo?.extra ?? 0) + extrasSum);
}

export function selectionKey(productId: string, selection: Selection) {
  return `${productId}|${selection.sizeId}|${selection.comboId}|${[...selection.extraIds].sort().join(",")}`;
}
