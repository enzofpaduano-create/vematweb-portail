import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import vematLogo from "@/assets/vemat-logo.png";

const HOLD_MS = 1400; // total time on screen before exit animation

/**
 * Full-screen splash shown on every page load.
 * Big white Vemat logo on black, red accent bar, fades out into the home page.
 */
export function SplashScreen() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!visible) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => setVisible(false), HOLD_MS);
    return () => {
      window.clearTimeout(t);
      document.body.style.overflow = prev;
    };
  }, [visible]);

  function dismiss() {
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.55, ease: [0.4, 0, 0.2, 1] as [number, number, number, number] } }}
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-zinc-950"
          onClick={dismiss}
          role="dialog"
          aria-label="Vemat"
        >
          {/* Subtle red glow centered on logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 0.35, scale: 1 }}
            transition={{ duration: 1.2, ease: "easeOut" }}
            className="absolute w-[60vmin] h-[60vmin] rounded-full bg-accent/40 blur-[120px] pointer-events-none"
          />

          {/* Logo */}
          <motion.img
            src={vematLogo}
            alt="Vemat"
            initial={{ opacity: 0, scale: 0.8, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
            className="relative z-10 h-32 md:h-44 lg:h-52 w-auto brightness-0 invert select-none"
            draggable={false}
          />

          {/* Underline + tagline */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.7, delay: 0.5, ease: "easeOut" }}
            className="relative z-10 mt-6 h-[3px] w-32 bg-accent origin-left"
          />
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: "easeOut" }}
            className="relative z-10 mt-5 text-[11px] md:text-xs uppercase tracking-[0.4em] text-zinc-400 font-bold"
          >
            Vemat Group · Depuis 2008
          </motion.p>

          {/* Skip hint */}
          <motion.span
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            transition={{ duration: 0.4, delay: 1.0 }}
            className="absolute bottom-6 text-[10px] uppercase tracking-[0.3em] text-zinc-500"
          >
            Cliquez pour passer
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
