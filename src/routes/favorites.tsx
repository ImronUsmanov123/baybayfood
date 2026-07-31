import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useStore } from "@/lib/store";
import { PIZZAS } from "@/lib/pizzas";
import { PizzaCard } from "@/components/PizzaCard";
import { useT } from "@/lib/i18n";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Sevimlilar / Избранное — Bay Bay Food" },
      { name: "description", content: "Saqlangan taomlaringiz. Ваши сохранённые блюда." },
      { property: "og:title", content: "Sevimlilar / Избранное — Bay Bay Food" },
      { property: "og:description", content: "Saqlangan taomlaringiz." },
    ],
  }),
  component: Favorites,
});

function Favorites() {
  const { t } = useT();
  const favIds = useStore((s) => s.favorites);
  const items = PIZZAS.filter((p) => favIds.includes(p.id));

  return (
    <div className="mx-auto max-w-md">
      <header className="px-5 pt-6 pb-4">
        <h1 className="text-3xl font-black text-foreground">{t("favorites_title")}</h1>
        <p className="text-sm text-muted-foreground">{t("favorites_count", { n: items.length })}</p>
      </header>

      {items.length === 0 ? (
        <div className="px-5 py-20 text-center">
          <div className="mx-auto h-24 w-24 rounded-full bg-muted flex items-center justify-center">
            <Heart className="h-10 w-10 text-foreground/40" strokeWidth={2} />
          </div>
          <h2 className="mt-5 text-xl font-black text-foreground">{t("no_favorites")}</h2>
          <p className="text-sm text-muted-foreground mt-1">{t("no_favorites_sub")}</p>
          <Link to="/" className="inline-block mt-6 rounded-full bg-primary text-primary-foreground px-6 py-3 font-bold text-sm press">
            {t("explore_menu")}
          </Link>
        </div>
      ) : (
        <div className="px-5 grid grid-cols-2 gap-4 pt-8">
          {items.map((p, i) => <PizzaCard key={p.id} pizza={p} index={i} />)}
        </div>
      )}
    </div>
  );
}
