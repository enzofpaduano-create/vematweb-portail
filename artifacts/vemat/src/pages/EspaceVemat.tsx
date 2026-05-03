import { Link } from "wouter";
import { Settings, Wrench, ArrowRight, Lock, TrendingUp, Briefcase } from "lucide-react";
import vematLogo from "@/assets/vemat-logo.png";

const PORTALS = [
  {
    href: "/espace-manager/connexion",
    icon: Settings,
    label: "Espace Manager",
    color: "from-accent/20 to-accent/5",
    border: "border-accent/30 hover:border-accent/60",
    iconBg: "bg-accent/20 text-accent",
    badge: "Personnel Vemat",
  },
  {
    href: "/espace-technicien/connexion",
    icon: Wrench,
    label: "Espace Technicien",
    color: "from-orange-500/20 to-orange-600/5",
    border: "border-orange-500/30 hover:border-orange-400/60",
    iconBg: "bg-orange-500/20 text-orange-400",
    badge: "Personnel Vemat",
  },
  {
    href: "/direction/connexion",
    icon: TrendingUp,
    label: "Espace Direction",
    color: "from-purple-500/20 to-purple-600/5",
    border: "border-purple-500/30 hover:border-purple-400/60",
    iconBg: "bg-purple-500/20 text-purple-400",
    badge: "Direction",
  },
  {
    href: "/espace-commercial/connexion",
    icon: Briefcase,
    label: "Espace Commercial",
    color: "from-sky-500/20 to-sky-600/5",
    border: "border-sky-500/30 hover:border-sky-400/60",
    iconBg: "bg-sky-500/20 text-sky-400",
    badge: "Personnel Vemat",
  },
];

export default function EspaceVemat() {
  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center px-4 py-16">
      {/* Logo */}
      <div className="text-center mb-14">
        <img src={vematLogo} alt="Vemat Group" className="h-20 w-auto brightness-0 invert mx-auto mb-6" />
        <h1 className="text-3xl font-black text-white">Portail Vemat</h1>
        <p className="text-zinc-500 mt-2">Choisissez votre espace de connexion</p>
      </div>

      {/* Portal cards */}
      <div className="grid grid-cols-1 gap-5 w-full max-w-5xl sm:grid-cols-2 xl:grid-cols-4">
        {PORTALS.map(({ href, icon: Icon, label, color, border, iconBg, badge }) => (
          <div
            key={label}
            className={`relative bg-gradient-to-br ${color} border ${border} rounded-2xl p-6 flex flex-col transition-all duration-200`}
          >
            <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-4">
              <Lock className="w-3 h-3" />{badge}
            </div>

            <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${iconBg}`}>
              <Icon className="w-6 h-6" />
            </div>

            <h2 className="text-lg font-black text-white mb-6">{label}</h2>

            <div className="mt-auto">
              <Link href={href}>
                <div className="flex items-center justify-between bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-colors cursor-pointer">
                  Se connecter
                  <ArrowRight className="w-4 h-4" />
                </div>
              </Link>
              <p className="text-center text-[11px] text-zinc-700 py-2">
                Accès sur invitation uniquement
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-zinc-700 text-xs mt-12">© {new Date().getFullYear()} Vemat Group · Tous droits réservés</p>
    </div>
  );
}
