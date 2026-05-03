import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { CalendarDays, ClipboardList, LogOut, Wrench, BookOpen } from "lucide-react";
import { useTechnicienAuth } from "@/contexts/TechnicienAuthContext";
import { useLang } from "@/i18n/I18nProvider";
import vematLogo from "@/assets/vemat-logo.png";

const NAV = [
  { href: "/espace-technicien/missions", icon: CalendarDays, label: "Mes missions" },
  { href: "/espace-technicien/historique", icon: ClipboardList, label: "Historique" },
  { href: "/espace-technicien/catalogues", icon: BookOpen, label: "Catalogues" },
];

export function TechnicienLayout({ children }: { children: React.ReactNode }) {
  const [location, navigate] = useLocation();
  const { technician, signOut, loading, user } = useTechnicienAuth();
  const { lang, setLang } = useLang();

  useEffect(() => {
    if (!loading && !user) navigate("/espace-technicien/connexion");
  }, [loading, user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;

  const initials = technician?.name
    ? technician.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "?";

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col fixed left-0 top-0 h-full z-40">
        <div className="px-5 py-5 border-b border-zinc-800">
          <img src={vematLogo} alt="Vemat" className="h-12 w-auto brightness-0 invert mb-4" />
          <div className="flex items-center gap-2">
            <Wrench className="w-3 h-3 text-orange-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">Espace Technicien</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ href, icon: Icon, label }) => {
            const active = location.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  active
                    ? "bg-orange-500 text-white"
                    : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-black shrink-0"
              style={{ backgroundColor: technician?.color ?? "#f97316" }}
            >
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-white truncate">{technician?.name ?? "—"}</p>
              <p className="text-[10px] text-zinc-500">Technicien</p>
            </div>
          </div>
          <button
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors px-0 py-1"
            aria-label="Toggle language"
          >
            <span className="text-sm">🌐</span>
            <span>{lang === "fr" ? "English" : "Français"}</span>
          </button>
          <button
            onClick={async () => { await signOut(); navigate("/espace-technicien/connexion"); }}
            className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors py-1"
          >
            <LogOut className="w-3.5 h-3.5" /> {lang === "en" ? "Sign out" : "Déconnexion"}
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-60 bg-zinc-950 min-h-screen">{children}</main>
    </div>
  );
}
