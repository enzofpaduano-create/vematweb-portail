import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { feature } from "topojson-client";
import { geoMercator, geoPath, geoBounds } from "d3-geo";
import type { Topology, GeometryCollection } from "topojson-specification";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import worldAtlas from "world-atlas/countries-110m.json";
import { offices, ACTIVE_COUNTRY_IDS, COUNTRY_NAMES } from "@/data/offices";
import { useLang } from "@/i18n/I18nProvider";

const WIDTH = 880;
const HEIGHT = 760;

type CountryProps = { name: string };
type CountryFeature = Feature<Geometry, CountryProps> & { id?: string | number };

const VIEWPORT_BOX: FeatureCollection = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [[
          [-22, 38],
          [62, 38],
          [62, -36],
          [-22, -36],
          [-22, 38],
        ]],
      },
    },
  ],
};

type Tooltip = { x: number; y: number; name: string; active: boolean };

export function AfricaMap() {
  const { lang, t } = useLang();
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  const { countryPaths, projectedOffices } = useMemo(() => {
    const topo = worldAtlas as unknown as Topology<{ countries: GeometryCollection<CountryProps> }>;
    const fc = feature(topo, topo.objects.countries) as unknown as FeatureCollection<Geometry, CountryProps>;

    const proj = geoMercator().fitExtent(
      [[24, 24], [WIDTH - 24, HEIGHT - 24]],
      VIEWPORT_BOX,
    );
    const path = geoPath(proj);

    const visible = (fc.features as CountryFeature[]).filter((f) => {
      const [[lon0, lat0], [lon1, lat1]] = geoBounds(f);
      return !(lon1 < -25 || lon0 > 65 || lat1 < -40 || lat0 > 42);
    });

    const paths = visible
      .map((f, idx) => {
        const isoId = String(f.id ?? "");
        const fallbackName = f.properties?.name ?? "";
        return {
          key: isoId || `noid-${fallbackName}-${idx}`,
          id: isoId,
          fallbackName,
          d: path(f) ?? "",
          active: ACTIVE_COUNTRY_IDS.has(isoId),
        };
      })
      .filter((c) => c.d.length > 0)
      .sort((a, b) => Number(a.active) - Number(b.active));

    const points = offices.map((o) => {
      const xy = proj(o.coords);
      return xy ? { id: o.id, x: xy[0], y: xy[1], type: o.type, city: o.city } : null;
    }).filter((p): p is NonNullable<typeof p> => p !== null);

    return { countryPaths: paths, projectedOffices: points };
  }, []);

  const localizedName = (id: string, fallback: string) => {
    const m = COUNTRY_NAMES[id];
    return m ? m[lang] : fallback;
  };

  const handleMove = (e: React.MouseEvent, name: string, active: boolean) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      name,
      active,
    });
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        role="img"
        aria-label="Carte de la présence Vemat en Afrique et au Moyen-Orient"
      >
        <defs>
          <radialGradient id="map-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="hsl(355 78% 47%)" stopOpacity="0.10" />
            <stop offset="100%" stopColor="hsl(355 78% 47%)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="active-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(355 78% 55%)" />
            <stop offset="100%" stopColor="hsl(355 78% 42%)" />
          </linearGradient>
        </defs>

        <rect width={WIDTH} height={HEIGHT} fill="url(#map-glow)" />

        <g>
          {countryPaths.map((c) => {
            const name = localizedName(c.id, c.fallbackName);
            return (
              <path
                key={c.key}
                d={c.d}
                fill={c.active ? "url(#active-fill)" : "rgba(24,24,27,0.07)"}
                stroke={c.active ? "rgba(255,255,255,0.55)" : "rgba(24,24,27,0.18)"}
                strokeWidth={c.active ? 0.5 : 0.4}
                style={{
                  cursor: "pointer",
                  transition: "filter 180ms ease, opacity 180ms ease",
                }}
                onMouseEnter={(e) => handleMove(e, name, c.active)}
                onMouseMove={(e) => handleMove(e, name, c.active)}
                onMouseLeave={() => setTooltip(null)}
              />
            );
          })}
        </g>

        <g pointerEvents="none">
          {projectedOffices.map((p, i) => {
            const isHQ = p.type === "hq";
            const baseR = isHQ ? 7 : 5.5;
            return (
              <g key={p.id} transform={`translate(${p.x}, ${p.y})`}>
                <motion.circle
                  r={baseR}
                  fill="hsl(355 78% 47%)"
                  initial={{ opacity: 0.5, scale: 1 }}
                  animate={{ opacity: [0.5, 0], scale: [1, 3] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4, ease: "easeOut" }}
                />
                <motion.circle
                  r={baseR * 1.6}
                  fill="hsl(355 78% 47%)"
                  opacity={0.18}
                  animate={{ opacity: [0.18, 0.32, 0.18] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.4 }}
                />
                <circle
                  r={baseR}
                  fill="hsl(355 78% 47%)"
                  stroke="white"
                  strokeWidth={isHQ ? 2 : 1.5}
                />
                {isHQ && <circle r={2.2} fill="white" />}
              </g>
            );
          })}
        </g>

        <g transform={`translate(${WIDTH - 200}, ${HEIGHT - 80})`} pointerEvents="none">
          <rect width={184} height={64} rx={10} fill="rgba(255,255,255,0.95)" stroke="rgba(24,24,27,0.12)" />
          <g transform="translate(16, 18)">
            <rect width={14} height={14} rx={3} fill="url(#active-fill)" />
            <text x={22} y={11} fill="rgba(24,24,27,0.85)" fontSize={11} fontWeight={600} dominantBaseline="middle">
              {t("offices.legendActive")}
            </text>
          </g>
          <g transform="translate(16, 40)">
            <circle cx={7} cy={7} r={5} fill="hsl(355 78% 47%)" stroke="white" strokeWidth={1.5} />
            <text x={22} y={9} fill="rgba(24,24,27,0.85)" fontSize={11} fontWeight={600} dominantBaseline="middle">
              {t("offices.legendOffice")}
            </text>
          </g>
        </g>
      </svg>

      {tooltip && (
        <div
          className="absolute pointer-events-none z-20"
          style={{
            left: tooltip.x,
            top: tooltip.y,
            transform: "translate(12px, -50%)",
          }}
        >
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm border border-zinc-200 rounded-lg px-3 py-2 shadow-xl whitespace-nowrap">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                tooltip.active ? "bg-accent" : "bg-zinc-400"
              }`}
            />
            <span className="text-zinc-950 text-xs font-bold">{tooltip.name}</span>
            {tooltip.active && (
              <span className="text-accent text-[9px] font-black uppercase tracking-widest">
                {t("offices.legendActiveShort")}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
