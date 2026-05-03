import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { LayoutDashboard, Wrench, ShoppingCart, LogOut, Bell, TrendingUp, Briefcase, BookOpen } from "lucide-react";
import { useDGAuth } from "@/contexts/DGAuthContext";
import { supabaseDG } from "@/lib/supabase";
import { useLang } from "@/i18n/I18nProvider";
import vematLogo from "@/assets/vemat-logo.png";
import type { Notification } from "@/lib/database.types";

const getNav = (t: (k: string) => string, lang: string) => [
  { href: "/direction/dashboard", icon: LayoutDashboard, label: t("portal.dg.nav.dashboard"), exact: true },
  { href: "/direction/commandes", icon: ShoppingCart, label: t("portal.dg.nav.orders"), exact: false },
  { href: "/direction/reparations", icon: Wrench, label: t("portal.dg.nav.repairs"), exact: false },
  { href: "/direction/commercial", icon: Briefcase, label: t("portal.dg.nav.commercial"), exact: false },
  { href: "/direction/catalogues", icon: BookOpen, label: lang === "fr" ? "Catalogues" : "Catalogs", exact: false },
];

export function DGLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { profile, signOut } = useDGAuth();
  const { lang, setLang, t } = useLang();
  const nav = getNav(t, lang);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    supabaseDG
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => setNotifications(data ?? []));

    const channel = supabaseDG
      .channel("dg-notifications")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications" }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => { supabaseDG.removeChannel(channel); };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const ids = notifications.filter((n) => !n.read).map((n) => n.id);
    if (!ids.length) return;
    await supabaseDG.from("notifications").update({ read: true }).in("id", ids);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const markOneRead = async (n: Notification) => {
    if (n.read) return;
    await supabaseDG.from("notifications").update({ read: true }).eq("id", n.id);
    setNotifications((prev) => prev.map((notif) => notif.id === n.id ? { ...notif, read: true } : notif));
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex">
      <aside className="w-60 bg-zinc-900 border-r border-zinc-800 flex flex-col fixed left-0 top-0 h-full z-40">
        <div className="px-5 py-5 border-b border-zinc-800">
          <img src={vematLogo} alt="Vemat" className="h-12 w-auto brightness-0 invert mb-4" />
          <div className="flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-purple-400" />
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-purple-400">{t("portal.dg.title")}</p>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {nav.map(({ href, icon: Icon, label, exact }) => {
            const active = exact ? location === href : location.startsWith(href);
            return (
              <Link key={href} href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                  active ? "bg-purple-600 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
                }`}>
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-zinc-800 p-4 space-y-3">
          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => { setShowNotifs((v) => !v); if (showNotifs) markAllRead(); }}
              className="w-full flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors py-1.5 px-2 rounded-lg hover:bg-zinc-800"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{t("portal.common.notifications")}</span>
              {unreadCount > 0 && (
                <span className="ml-auto bg-purple-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden shadow-2xl">
                <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
                  <span className="text-xs font-bold text-zinc-300">{t("portal.common.notifications")}</span>
                  {unreadCount > 0 && (
                    <button onClick={markAllRead} className="text-[10px] text-zinc-500 hover:text-white transition-colors">
                      {t("portal.common.markAllRead")}
                    </button>
                  )}
                </div>
                <div className="max-h-64 overflow-y-auto divide-y divide-zinc-800">
                  {notifications.length === 0 ? (
                    <div className="px-3 py-6 text-center text-xs text-zinc-500">{t("portal.common.noNotification")}</div>
                  ) : notifications.slice(0, 10).map((n) => (
                    <Link
                      key={n.id}
                      href={n.link ?? "#"}
                      onClick={() => { markOneRead(n); setShowNotifs(false); }}
                      className={`block px-3 py-2.5 hover:bg-zinc-700/50 transition-colors cursor-pointer ${n.read ? "opacity-50" : "bg-zinc-800/50"}`}
                    >
                      {!n.read && <span className="inline-block w-1.5 h-1.5 rounded-full bg-purple-400 mb-1" />}
                      <p className="text-xs font-semibold text-zinc-200 leading-tight">{n.title}</p>
                      {n.message && <p className="text-[10px] text-zinc-400 mt-0.5 line-clamp-2">{n.message}</p>}
                      <p className="text-[9px] text-zinc-600 mt-1">
                        {new Date(n.created_at).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Profile */}
          {profile && (
            <div className="flex items-center gap-2.5 px-2">
              <div className="w-7 h-7 rounded-full bg-purple-600 flex items-center justify-center text-white text-xs font-black shrink-0">
                {[profile.first_name?.[0], profile.last_name?.[0]].filter(Boolean).join("") || "DG"}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white truncate">{profile.first_name} {profile.last_name}</p>
                <p className="text-[10px] text-purple-400">{t("portal.dg.role")}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => setLang(lang === "fr" ? "en" : "fr")}
            className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-white transition-colors px-2 py-1"
          >
            <span className="text-sm">🌐</span>
            <span>{lang === "fr" ? "English" : "Français"}</span>
          </button>

          <button onClick={signOut}
            className="w-full flex items-center gap-2 text-xs text-zinc-500 hover:text-red-400 transition-colors px-2 py-1">
            <LogOut className="w-3.5 h-3.5" /> {t("portal.common.logout")}
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-60 bg-zinc-50 min-h-screen">{children}</main>
    </div>
  );
}
