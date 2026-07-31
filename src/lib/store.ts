import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
  key: string; // unique per config
  pizzaId: string;
  name: string;
  image: string;
  size: string;
  sizeLabel: string;
  crust: string;
  crustLabel: string;
  toppings: string[];
  unitPrice: number;
  qty: number;
};

export type Order = {
  id: string;
  items: CartItem[];
  subtotal: number;
  delivery: number;
  total: number;
  paymentMethod: "click" | "payme" | "cash";
  address: string;
  createdAt: number;
  status: "placed" | "cooking" | "on_the_way" | "delivered";
};

// Transient confirmation shown after an item lands in the cart. Never persisted.
export type LastAdded = {
  id: number;
  name: string;
  image: string;
  qty: number;
  lineTotal: number;
};

type State = {
  cart: CartItem[];
  favorites: string[];
  orders: Order[];
  lastAdded: LastAdded | null;
  addToCart: (item: CartItem) => void;
  dismissLastAdded: () => void;
  removeFromCart: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clearCart: () => void;
  toggleFavorite: (id: string) => void;
  placeOrder: (o: Omit<Order, "id" | "createdAt" | "status">) => Order;
  advanceOrder: (id: string, status: Order["status"]) => void;
};

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      cart: [],
      favorites: [],
      orders: [],
      lastAdded: null,
      addToCart: (item) =>
        set((s) => {
          const lastAdded: LastAdded = {
            id: Date.now(),
            name: item.name,
            image: item.image,
            qty: item.qty,
            lineTotal: item.unitPrice * item.qty,
          };
          const existing = s.cart.find((c) => c.key === item.key);
          if (existing) {
            return {
              lastAdded,
              cart: s.cart.map((c) => (c.key === item.key ? { ...c, qty: c.qty + item.qty } : c)),
            };
          }
          return { lastAdded, cart: [...s.cart, item] };
        }),
      dismissLastAdded: () => set({ lastAdded: null }),
      removeFromCart: (key) => set((s) => ({ cart: s.cart.filter((c) => c.key !== key) })),
      setQty: (key, qty) =>
        set((s) => ({
          cart: qty <= 0 ? s.cart.filter((c) => c.key !== key) : s.cart.map((c) => (c.key === key ? { ...c, qty } : c)),
        })),
      clearCart: () => set({ cart: [] }),
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id) ? s.favorites.filter((f) => f !== id) : [...s.favorites, id],
        })),
      placeOrder: (o) => {
        const id = Math.random().toString(36).slice(2, 8).toUpperCase();
        const order: Order = { ...o, id, createdAt: Date.now(), status: "placed" };
        set((s) => ({ orders: [order, ...s.orders] }));
        return order;
      },
      advanceOrder: (id, status) =>
        set((s) => ({ orders: s.orders.map((o) => (o.id === id ? { ...o, status } : o)) })),
    }),
    {
      name: "pizza-uz-store",
      partialize: (s) => ({ cart: s.cart, favorites: s.favorites, orders: s.orders }),
    },
  ),
);

export const cartTotal = (cart: CartItem[]) => cart.reduce((sum, i) => sum + i.unitPrice * i.qty, 0);
export const cartCount = (cart: CartItem[]) => cart.reduce((sum, i) => sum + i.qty, 0);
