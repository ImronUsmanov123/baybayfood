import burger from "@/assets/food-burger.jpg";
import chickenburger from "@/assets/food-chickenburger.jpg";
import fries from "@/assets/food-fries.jpg";
import hotdog from "@/assets/food-hotdog.jpg";
import wings from "@/assets/food-wings.jpg";
import shawarma from "@/assets/food-shawarma.jpg";
import cola from "@/assets/food-cola.jpg";
import milkshake from "@/assets/food-milkshake.jpg";

export type Pizza = {
  id: string;
  /** Uzbek name (default) */
  name: string;
  nameRu: string;
  /** Uzbek description (default) */
  description: string;
  descriptionRu: string;
  image: string;
  basePrice: number; // UZS
  category: string;
  spicy?: boolean;
  popular?: boolean;
  /** Only combo-style items expose size / extras. */
  customizable?: boolean;
};

export const CATEGORIES = [
  { id: "all", emoji: "🍔" },
  { id: "burgers", emoji: "🍔" },
  { id: "hotdogs", emoji: "🌭" },
  { id: "chicken", emoji: "🍗" },
  { id: "snacks", emoji: "🍟" },
  { id: "wraps", emoji: "🌯" },
  { id: "drinks", emoji: "🥤" },
];

export const PIZZAS: Pizza[] = [
  {
    id: "double-burger",
    name: "Bay Bay Double Burger",
    nameRu: "Bay Bay Дабл Бургер",
    description: "Ikki qat mol go'shti, cheddar, salat va pomidor.",
    descriptionRu: "Двойная говяжья котлета, чеддер, салат и помидор.",
    image: burger,
    basePrice: 49000,
    category: "burgers",
    popular: true,
    customizable: true,
  },
  {
    id: "crispy-chicken",
    name: "Crispy Chicken Burger",
    nameRu: "Криспи Чикен Бургер",
    description: "Xrustalli tovuq filesi, achchiq sous, bodring.",
    descriptionRu: "Хрустящее куриное филе, острый соус, огурчики.",
    image: chickenburger,
    basePrice: 42000,
    category: "burgers",
    spicy: true,
    popular: true,
    customizable: true,
  },
  {
    id: "fries",
    name: "Fri kartoshka",
    nameRu: "Картофель фри",
    description: "Tilla rang, tuzli, issiq va xrustalli.",
    descriptionRu: "Золотистый, солёный, горячий и хрустящий.",
    image: fries,
    basePrice: 18000,
    category: "snacks",
    popular: true,
  },
  {
    id: "hotdog",
    name: "Klassik Hot Dog",
    nameRu: "Классический хот-дог",
    description: "Sosiska, gorchitsa, ketchup va qovurilgan piyoz.",
    descriptionRu: "Сосиска, горчица, кетчуп и жареный лук.",
    image: hotdog,
    basePrice: 25000,
    category: "hotdogs",
  },
  {
    id: "wings",
    name: "Achchiq tovuq qanotchalari",
    nameRu: "Острые куриные крылышки",
    description: "8 dona qanotcha, achchiq sous bilan.",
    descriptionRu: "8 крылышек с фирменным острым соусом.",
    image: wings,
    basePrice: 39000,
    category: "chicken",
    spicy: true,
  },
  {
    id: "shawarma",
    name: "Go'shtli lavash",
    nameRu: "Шаурма с говядиной",
    description: "Yumshoq lavash, go'sht, sabzavot va sous.",
    descriptionRu: "Мягкий лаваш, мясо, овощи и соус.",
    image: shawarma,
    basePrice: 35000,
    category: "wraps",
    popular: true,
  },
  {
    id: "cola",
    name: "Muzli Cola 0.5 l",
    nameRu: "Кола со льдом 0,5 л",
    description: "Muzdek gazlangan ichimlik.",
    descriptionRu: "Ледяной газированный напиток.",
    image: cola,
    basePrice: 12000,
    category: "drinks",
  },
  {
    id: "milkshake",
    name: "Vanilli milkshake",
    nameRu: "Ванильный милкшейк",
    description: "Quyuq sut kokteyli va qaymoq.",
    descriptionRu: "Густой молочный коктейль со сливками.",
    image: milkshake,
    basePrice: 22000,
    category: "drinks",
  },
];

/** Portion sizes for combo-style items. */
export const SIZES = [
  { id: "s", multiplier: 1 },
  { id: "m", multiplier: 1.3 },
  { id: "l", multiplier: 1.6 },
] as const;

/** Combo options (side + drink). */
export const CRUSTS = [
  { id: "classic", extra: 0 },
  { id: "thin", extra: 0 },
  { id: "cheesy", extra: 12000 },
] as const;

export const TOPPINGS = [
  { id: "extra-cheese", price: 8000 },
  { id: "mushrooms", price: 6000 },
  { id: "olives", price: 5000 },
  { id: "jalapeno", price: 5000 },
  { id: "onion", price: 4000 },
  { id: "bacon", price: 10000 },
];

export function getPizza(id: string) {
  return PIZZAS.find((p) => p.id === id);
}

export function productName(p: Pizza, lang: string) {
  return lang === "ru" ? p.nameRu : p.name;
}

export function productDescription(p: Pizza, lang: string) {
  return lang === "ru" ? p.descriptionRu : p.description;
}
