import { motion } from "framer-motion";

interface StatBlockProps {
  value: string;
  label: string;
  delay?: number;
}

export function StatBlock({ value, label, delay = 0 }: StatBlockProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.8, delay, ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col items-center md:items-start text-center md:text-left p-6 rounded-2xl transition-all duration-500 hover:bg-zinc-50"
    >
      <div className="relative mb-3">
        <span className="text-4xl md:text-6xl font-heading font-extrabold text-zinc-950 tracking-tighter">
          {value}
        </span>
        <div className="absolute -bottom-1 left-0 right-0 h-1 bg-accent scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left" />
      </div>
      <span className="text-zinc-600 font-bold uppercase tracking-[0.2em] text-[10px] md:text-xs">
        {label}
      </span>
    </motion.div>
  );
}
