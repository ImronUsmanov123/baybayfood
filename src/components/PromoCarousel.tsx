import { useEffect, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useT } from "@/lib/i18n";
import burger from "@/assets/food-burger.jpg";
import fries from "@/assets/food-fries.jpg";
import milkshake from "@/assets/food-milkshake.jpg";

const SLIDES = [
  { id: "free", image: burger, badge: "promo_badge_free", title: "promo_title_free", sub: "promo_sub_free" },
  { id: "hot", image: fries, badge: "promo_badge_hot", title: "promo_title_hot", sub: "promo_sub_hot" },
  { id: "price", image: milkshake, badge: "promo_badge_price", title: "promo_title_price", sub: "promo_sub_price" },
];

const INTERVAL = 4500;
const SWIPE_CONFIDENCE_THRESHOLD = 6000;
const SWIPE_POWER = (offset: number, velocity: number) => Math.abs(offset) * velocity;

const SPRING = { type: "spring" as const, stiffness: 320, damping: 34, mass: 0.9 };

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "105%" : "-105%",
    opacity: 0,
    scale: 0.94,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? "105%" : "-105%",
    opacity: 0,
    scale: 0.94,
  }),
};

/** Auto-sliding promotional banner shown at the top of the menu. */
export function PromoCarousel() {
  const { t } = useT();
  const [[index, direction], setIndex] = useState([0, 0]);
  const [paused, setPaused] = useState(false);

  const slideIndex = ((index % SLIDES.length) + SLIDES.length) % SLIDES.length;
  const slide = SLIDES[slideIndex];

  useEffect(() => {
    if (paused) return;
    const id = setInterval(
      () => setIndex(([current]) => [(current + 1) % SLIDES.length, 1]),
      INTERVAL,
    );
    return () => clearInterval(id);
  }, [paused]);

  const paginate = (newDirection: number) => {
    setIndex(([current]) => {
      const next = current + newDirection;
      return [((next % SLIDES.length) + SLIDES.length) % SLIDES.length, newDirection];
    });
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setPaused(false);
    const swipe = SWIPE_POWER(info.offset.x, info.velocity.x);
    if (swipe < -SWIPE_CONFIDENCE_THRESHOLD || info.offset.x < -70) {
      paginate(1);
    } else if (swipe > SWIPE_CONFIDENCE_THRESHOLD || info.offset.x > 70) {
      paginate(-1);
    }
  };

  return (
    <div
      className="mt-5 relative overflow-hidden rounded-3xl bg-primary text-primary-foreground min-h-[180px] shadow-chunky touch-pan-y select-none"
      onPointerDown={() => setPaused(true)}
      onPointerUp={() => setPaused(false)}
      onPointerLeave={() => setPaused(false)}
    >
      <AnimatePresence initial={false} custom={direction}>
        <motion.div
          key={slide.id}
          custom={direction}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ x: SPRING, opacity: { duration: 0.25 }, scale: { duration: 0.3 } }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.28}
          dragMomentum={false}
          onDragStart={() => setPaused(true)}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 p-5 pr-32 cursor-grab active:cursor-grabbing"
        >
          <motion.span
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.08 }}
            className="inline-block rounded-full bg-primary-foreground text-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-wide"
          >
            {t(slide.badge)}
          </motion.span>
          <motion.h1
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="mt-2 text-2xl font-black leading-tight line-clamp-2"
          >
            {t(slide.title)}
          </motion.h1>
          <motion.p
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.18 }}
            className="mt-1.5 text-xs font-semibold text-primary-foreground/75 line-clamp-2"
          >
            {t(slide.sub)}
          </motion.p>
          <motion.div
            initial={{ scale: 0.85, rotate: -8, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ ...SPRING, delay: 0.05 }}
            className="absolute -right-4 -bottom-4 h-36 w-36 rounded-full overflow-hidden ring-4 ring-primary-foreground/15 pointer-events-none"
          >
            <img
              src={slide.image}
              alt=""
              width={512}
              height={512}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </motion.div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-3 left-5 flex gap-1.5 z-10">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setIndex(([current]) => (i === current ? [current, 0] : [i, i > current ? 1 : -1]))}
            aria-label={t(s.title)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === slideIndex ? "w-7 bg-primary-foreground" : "w-1.5 bg-primary-foreground/40"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
