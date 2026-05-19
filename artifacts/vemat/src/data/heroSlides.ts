const SLIDE_COUNT = 56;
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/$/, "");

export const heroSlides: string[] = Array.from({ length: SLIDE_COUNT }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return `${BASE}/images/hero-slideshow/slide-${n}.jpg`;
});
