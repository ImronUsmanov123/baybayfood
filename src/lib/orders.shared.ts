import { z } from "zod";

export const cartItemSchema = z.object({
  key: z.string(),
  pizzaId: z.string(),
  name: z.string(),
  image: z.string(),
  size: z.string(),
  sizeLabel: z.string(),
  crust: z.string(),
  crustLabel: z.string(),
  toppings: z.array(z.string()),
  unitPrice: z.number().nonnegative(),
  qty: z.number().int().positive(),
});

export const STATUS_COPY: Record<string, { title: string; body: string; emoji: string }> = {
  placed: {
    emoji: "🧾",
    title: "Buyurtma qabul qilindi · Заказ принят",
    body: "Buyurtmangiz oshxonaga yuborildi. · Ваш заказ передан на кухню.",
  },
  cooking: {
    emoji: "👨‍🍳",
    title: "Tayyorlanmoqda · Готовим",
    body: "Oshpazlarimiz buyurtmangizni tayyorlamoqda. · Повара уже готовят ваш заказ.",
  },
  on_the_way: {
    emoji: "🛵",
    title: "Kuryer yo'lda · Курьер в пути",
    body: "Kuryer yo'lga chiqdi — telefoningizni yoningizda saqlang. · Курьер выехал — держите телефон под рукой.",
  },
  arriving_soon: {
    emoji: "📍",
    title: "Tez orada yetib keladi · Скоро прибудет",
    body: "Kuryer deyarli eshigingizda. · Курьер почти у вашей двери.",
  },
  delivered: {
    emoji: "✅",
    title: "Yetkazildi · Доставлено",
    body: "Afiyat bo'lsin! Bay Bay Food'ni tanlaganingiz uchun rahmat. · Приятного аппетита! Спасибо за заказ в Bay Bay Food.",
  },
  cancelled: {
    emoji: "❌",
    title: "Buyurtma bekor qilindi · Заказ отменён",
    body: "Buyurtmangiz bekor qilindi. Savol bo'lsa, biz bilan bog'laning. · Ваш заказ отменён. Свяжитесь с нами, если это ошибка.",
  },
};

export const createOrderSchema = z.object({
  items: z.array(cartItemSchema).min(1),
  subtotal: z.number().nonnegative(),
  delivery: z.number().nonnegative(),
  discount: z.number().nonnegative().default(0),
  total: z.number().nonnegative(),
  paymentMethod: z.enum(["cash", "card"]),
  address: z.string().trim().min(3).max(280),
  phone: z.string().trim().max(24).optional().nullable(),
  comment: z.string().trim().max(500).optional().nullable(),
  promoCode: z.string().trim().max(40).optional().nullable(),
});

export const orderIdSchema = z.object({ id: z.string().uuid() });

export const advanceOrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["placed", "cooking", "on_the_way", "arriving_soon", "delivered"]),
});

export const promoSchema = z.object({
  code: z.string().trim().min(1).max(40),
  subtotal: z.number().nonnegative(),
  delivery: z.number().nonnegative().default(0),
});

/** Forward-only delivery pipeline — an order can never move back a step. */
export const STATUS_RANK: Record<string, number> = {
  placed: 0,
  cooking: 1,
  on_the_way: 2,
  arriving_soon: 3,
  delivered: 4,
};
