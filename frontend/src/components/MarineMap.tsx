import L from "leaflet";
import React, { useEffect, useRef, useState } from "react";
import * as api from "../api";
import type {
  EmergencyRoute,
  FishingArea,
  GeofenceAlert,
  Language,
  Location,
  MarineAlert,
  PFZZone,
  PositionCheck,
  RouteOption,
  ZoneFeature,
} from "../types";
import { RATING_COLOR } from "./FishingPanel";

export type BasemapMode = "dark" | "ocean" | "osm";

const BASEMAP_TILES: Record<BasemapMode, { url: string; options: L.TileLayerOptions; name: string; icon: string }> = {
  dark: {
    name: "Dark Radar",
    icon: "🌙",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    options: {
      subdomains: "abcd",
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    },
  },
  ocean: {
    name: "Ocean Nautical",
    icon: "🌊",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 13,
      attribution: "Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS, National Geographic",
    },
  },
  osm: {
    name: "Standard OSM",
    icon: "🗺️",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    },
  },
};

const HINT: Record<Language, string> = {
  en: "Drag boat to check any position",
  hi: "जाँच के लिए नाव खींचें",
  kn: "ಪರಿಶೀಲಿಸಲು ದೋಣಿಯನ್ನು ಎಳೆಯಿರಿ",
};

const LEGEND: Record<Language, Record<string, string>> = {
  en: {
    layers: "Map Layers & Zones",
    pfzZones: "PFZ Fishing Grounds",
    restricted: "Naval & Restricted",
    channels: "Port Channels",
    boundary: "IMBL Boundary",
    weather: "Storm Warnings",
    routes: "Plotted Routes",
    veryGood: "Very Good (Prime)",
    good: "Good Chance",
    moderate: "Moderate",
    marginL: "Indian Coastal Waters · Scale Varies",
    marginR: "Illustrative Boundaries — Not For Navigation",
  },
  hi: {
    layers: "नक्शा परतें और क्षेत्र",
    pfzZones: "मत्स्य क्षेत्र (PFZ)",
    restricted: "प्रतिबंधित / नौसेना",
    channels: "बंदरगाह मार्ग",
    boundary: "अंतर्राष्ट्रीय सीमा",
    weather: "तूफान चेतावनी",
    routes: "तय मार्ग",
    veryGood: "सर्वोत्तम (प्राइम)",
    good: "अच्छी संभावना",
    moderate: "मध्यम",
    marginL: "भारतीय तटीय जल · पैमाना बदलता है",
    marginR: "सांकेतिक सीमाएँ — नौवहन के लिए नहीं",
  },
  kn: {
    layers: "ನಕ್ಷೆ ಪದರಗಳು ಮತ್ತು ವಲಯಗಳು",
    pfzZones: "ಮೀನುಗಾರಿಕೆ ಪ್ರದೇಶಗಳು (PFZ)",
    restricted: "ನಿರ್ಬಂಧಿತ / ನೌಕಾಪಡೆ",
    channels: "ಬಂದರು ಚಾನೆಲ್ಗಳು",
    boundary: "ಅಂತರರಾಷ್ಟ್ರೀಯ ಗಡಿ",
    weather: "ಚಂಡಮಾರುತ ಎಚ್ಚರಿಕೆ",
    routes: "ಗುರುತಿಸಿದ ಮಾರ್ಗಗಳು",
    veryGood: "ಅತ್ಯುತ್ತಮ",
    good: "ಉತ್ತಮ",
    moderate: "ಸಾಧಾರಣ",
    marginL: "ಭಾರತೀಯ ಕರಾವಳಿ ನೀರು",
    marginR: "ಸೂಚಕ ಗಡಿಗಳು",
  },
};

const STATUS_STYLE: Record<PositionCheck["status"], string> = {
  clear: "bg-risk-low",
  warning: "bg-risk-high",
  critical: "bg-risk-extreme",
};

const SERIF = `'Fraunces Variable',Georgia,serif`;
const MONO = `'Spline Sans Mono Variable',Consolas,monospace`;

const EMPTY_AREAS: FishingArea[] = [];
const EMPTY_ALERTS: MarineAlert[] = [];
const EMPTY_PFZ: PFZZone[] = [];
const EMPTY_ROUTES: RouteOption[] = [];
const EMPTY_GEOFENCE: GeofenceAlert[] = [];

export default function MarineMap({
  origin,
  emergencyRoute,
  zones,
  pfz = EMPTY_PFZ,
  areas = EMPTY_AREAS,
  radiusKm,
  routes = EMPTY_ROUTES,
  geofence = EMPTY_GEOFENCE,
  alerts = EMPTY_ALERTS,
  language = "en",
  onPickLocation,
  focusRank,
  height,
  fill = false,
}: {
  origin: Location | null;
  emergencyRoute?: EmergencyRoute | null;
  zones: ZoneFeature[];
  pfz: PFZZone[];
  areas?: FishingArea[];
  radiusKm?: number;
  routes: RouteOption[];
  geofence: GeofenceAlert[];
  alerts?: MarineAlert[];
  language?: Language;
  onPickLocation?: (lat: number, lon: number) => void;
  focusRank?: number | null;
  height?: number | string;
  fill?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);
  const boatRef = useRef<L.Marker | null>(null);
  const coordBadgeRef = useRef<HTMLDivElement>(null);
  const initialFitDoneRef = useRef(false);
  const prevOriginKeyRef = useRef<string | null>(null);
  const isBoatDragRef = useRef(false);
  const [probe, setProbe] = useState<PositionCheck | null>(null);
  const [dragging, setDragging] = useState(false);

  // Basemap mode state (auto-matches dark/light theme, switchable on-demand)
  const [basemap, setBasemap] = useState<BasemapMode>(() => {
    try {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      return isLight ? "ocean" : "dark";
    } catch {
      return "dark";
    }
  });

  // Layer visibility controls
  const [layerVis, setLayerVis] = useState({
    pfz: true,
    restricted: true,
    channels: true,
    weather: true,
    routes: true,
  });
  const [layersOpen, setLayersOpen] = useState(false);

  const mapHeight = height ?? (areas.length ? 540 : 440);

  // Auto-adapt basemap when root theme toggles
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const isLight = document.documentElement.getAttribute("data-theme") === "light";
      setBasemap(isLight ? "ocean" : "dark");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  // Sync leaflet size
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const id = window.setTimeout(() => map.invalidateSize(), 60);
    return () => window.clearTimeout(id);
  }, [mapHeight]);

  useEffect(() => {
    const el = containerRef.current;
    const map = mapRef.current;
    if (!el || !map || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Initialize Map
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: true,
    }).setView([18.92, 72.6], 10);

    L.control.zoom({ position: "topleft" }).addTo(map);

    // Initial tileLayer
    const cfg = BASEMAP_TILES[basemap] || BASEMAP_TILES.dark;
    const tl = L.tileLayer(cfg.url, cfg.options).addTo(map);
    tileLayerRef.current = tl;

    mapRef.current = map;
    layerRef.current = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 120);

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, []);

  // Update Basemap Tiles whenever mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = BASEMAP_TILES[basemap] || BASEMAP_TILES.dark;
    const newTl = L.tileLayer(cfg.url, cfg.options).addTo(map);
    newTl.bringToBack();
    tileLayerRef.current = newTl;
  }, [basemap]);

  // Click-to-pick
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !onPickLocation) return;
    const handler = (e: L.LeafletMouseEvent) =>
      onPickLocation(+e.latlng.lat.toFixed(4), +e.latlng.lng.toFixed(4));
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [onPickLocation]);

  // Mousemove coordinate tracker
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const badge = coordBadgeRef.current;
    const onMove = (e: L.LeafletMouseEvent) => {
      if (!badge) return;
      const lat = e.latlng.lat;
      const lon = e.latlng.lng;
      const latStr = lat >= 0 ? `${lat.toFixed(4)}°N` : `${Math.abs(lat).toFixed(4)}°S`;
      const lonStr = lon >= 0 ? `${lon.toFixed(4)}°E` : `${Math.abs(lon).toFixed(4)}°W`;
      badge.textContent = `${latStr}  ${lonStr}`;
      badge.classList.add("visible");
    };
    const onOut = () => {
      if (badge) badge.classList.remove("visible");
    };
    map.on("mousemove", onMove);
    map.on("mouseout", onOut);
    return () => {
      map.off("mousemove", onMove);
      map.off("mouseout", onOut);
    };
  }, []);

  // Redraw All Dynamic Colored Layers
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;
    group.clearLayers();
    boatRef.current = null;
    setProbe(null);

    const bounds: L.LatLngExpression[] = [];

    // Animated ocean current streamlines
    if (origin) {
      const oLat = origin.latitude;
      const oLon = origin.longitude;
      const streams = [
        [[oLat + 0.16, oLon - 0.18], [oLat + 0.06, oLon - 0.14], [oLat - 0.05, oLon - 0.11], [oLat - 0.18, oLon - 0.07]],
        [[oLat + 0.22, oLon - 0.08], [oLat + 0.10, oLon - 0.04], [oLat - 0.02, oLon - 0.02], [oLat - 0.15, oLon + 0.01]],
        [[oLat + 0.18, oLon + 0.06], [oLat + 0.04, oLon + 0.09], [oLat - 0.08, oLon + 0.12], [oLat - 0.22, oLon + 0.15]],
        [[oLat + 0.28, oLon - 0.25], [oLat + 0.13, oLon - 0.22], [oLat - 0.04, oLon - 0.18], [oLat - 0.19, oLon - 0.14]],
      ];

      streams.forEach((pts, i) => {
        L.polyline(pts as [number, number][], {
          color: i % 2 === 0 ? "#00E5FF" : "#38BDF8",
          weight: 2,
          opacity: 0.6,
          dashArray: "12 28",
          className: i % 2 === 0 ? "water-stream-flow-1" : "water-stream-flow-2",
          interactive: false,
        }).addTo(group);
      });
    }

    // Search radius radar circle
    if (origin && radiusKm) {
      L.circle([origin.latitude, origin.longitude], {
        radius: radiusKm * 1000,
        color: "#00A8CC",
        weight: 1.5,
        opacity: 0.7,
        dashArray: "4 8",
        fillColor: "#00A8CC",
        fillOpacity: 0.04,
        interactive: false,
        className: "radius-drift",
      })
        .bindTooltip(`${radiusKm} km operational radius`, { permanent: false, direction: "top" })
        .addTo(group);
    }

    // ========================================================================
    // 1. RESTRICTED, DEFENCE, CHANNEL & SANCTUARY ZONES (COLORED LAYERS)
    // ========================================================================
    zones.forEach((z) => {
      const ring = z.geometry.coordinates[0].map(([lon, lat]) => [lat, lon] as [number, number]);
      const type = z.properties.zone_type || "";
      const isChannel = type === "port_limit";

      if (isChannel && !layerVis.channels) return;
      if (!isChannel && !layerVis.restricted) return;

      let strokeCol = "#EF4444";
      let fillCol = "#EF4444";
      let fillOp = 0.25;
      let dash = "8 5";
      let tagLabel = "RESTRICTED AREA";
      let glowClass = "zone-glow-critical";

      if (type === "defence") {
        strokeCol = "#DC2626";
        fillCol = "#EF4444";
        fillOp = 0.28;
        dash = "8 4";
        tagLabel = "⚓ NAVAL DEFENCE AREA";
        glowClass = "zone-glow-critical";
      } else if (type === "port_limit") {
        strokeCol = "#D97706";
        fillCol = "#F59E0B";
        fillOp = 0.22;
        dash = "6 4";
        tagLabel = "⚠️ PORT CHANNEL";
        glowClass = "zone-glow-warning";
      } else if (type === "international_boundary") {
        strokeCol = "#DC2626";
        fillCol = "#7F1D1D";
        fillOp = 0.32;
        dash = "12 6";
        tagLabel = "🚨 IMBL BUFFER";
        glowClass = "zone-glow-boundary";
      } else if (type === "marine_protected_area") {
        strokeCol = "#0F766E";
        fillCol = "#0D9488";
        fillOp = 0.24;
        dash = "5 5";
        tagLabel = "🌿 MARINE SANCTUARY";
        glowClass = "";
      } else if (z.properties.severity === "warning") {
        strokeCol = "#F59E0B";
        fillCol = "#F59E0B";
        fillOp = 0.20;
        tagLabel = "⚠️ WARNING ZONE";
        glowClass = "zone-glow-warning";
      }

      // Draw Colored Polygon
      L.polygon(ring, {
        color: strokeCol,
        weight: 2.5,
        opacity: 0.95,
        fillColor: fillCol,
        fillOpacity: fillOp,
        dashArray: dash,
        className: glowClass,
      })
        .bindPopup(`
          <div style="font-family: Inter, sans-serif; min-width: 170px;">
            <b style="color:${strokeCol};font-size:13px;">${z.properties.name}</b><br/>
            <span style="font-size:10px;font-weight:700;color:var(--text-dim);text-transform:uppercase;letter-spacing:0.08em;">${z.properties.zone_type.replace(/_/g, " ")} · ${z.properties.severity}</span><br/>
            <div style="margin-top:5px;font-size:11.5px;line-height:1.5;color:var(--text-bright);">${z.properties.note}</div>
          </div>
        `)
        .addTo(group);

      // Centroid Floating Tag Badge
      const cLat = ring.reduce((acc, p) => acc + p[0], 0) / ring.length;
      const cLon = ring.reduce((acc, p) => acc + p[1], 0) / ring.length;
      L.marker([cLat, cLon], {
        icon: L.divIcon({
          className: "",
          iconSize: [140, 22],
          iconAnchor: [70, 11],
          html: `<div class="zone-floating-tag" style="border:1px solid ${strokeCol};color:${strokeCol}">
                   ${tagLabel}
                 </div>`,
        }),
        interactive: false,
      }).addTo(group);
    });

    // ========================================================================
    // 2. SEVERE WEATHER & CYCLONE HAZARD ZONES (COLORED LAYERS)
    // ========================================================================
    if (layerVis.weather) {
      alerts.forEach((al) => {
        const s = al.storm;
        if (!s) return;
        const isCyclone = al.type === "cyclone_warning";

        // Outer Storm Gale Radius
        L.circle([s.latitude, s.longitude], {
          radius: s.radius_km * 1000,
          color: "#EF4444",
          weight: 3,
          opacity: 0.95,
          fillColor: "#DC2626",
          fillOpacity: 0.24,
          dashArray: "10 6",
          className: "zone-glow-critical",
        })
          .bindPopup(`<b>${al.headline}</b><br/>${al.detail}<br/><span style="font-size:10px;opacity:.7">${al.source}</span>`)
          .addTo(group);

        // Core Eye Danger Zone
        L.circle([s.latitude, s.longitude], {
          radius: (s.radius_km * 1000) * 0.35,
          color: "#7F1D1D",
          weight: 2,
          fillColor: "#991B1B",
          fillOpacity: 0.45,
          interactive: false,
        }).addTo(group);

        // Forecast Track
        const track = s.track ?? [];
        if (track.length > 1) {
          const line = track.map((p) => [p.latitude, p.longitude] as [number, number]);
          L.polyline(line, {
            color: "#EF4444",
            weight: 3,
            opacity: 0.85,
            dashArray: "4 8",
            className: "route-live",
          }).addTo(group);

          track.forEach((p) => {
            L.marker([p.latitude, p.longitude], {
              icon: L.divIcon({
                className: "",
                iconSize: [11, 11],
                iconAnchor: [5.5, 5.5],
                html: `<div style="width:11px;height:11px;border-radius:50%;background:#EF4444;border:2px solid #FFFFFF;box-shadow:0 0 8px #EF4444"></div>`,
              }),
            })
              .bindTooltip(p.label, { direction: "top", offset: [0, -6] })
              .addTo(group);
            bounds.push([p.latitude, p.longitude]);
          });
        }

        // Turning Cyclone Eye Symbol
        if (isCyclone) {
          L.marker([s.latitude, s.longitude], {
            zIndexOffset: 800,
            icon: L.divIcon({
              className: "",
              iconSize: [56, 56],
              iconAnchor: [28, 28],
              html: `<div class="storm-spin" style="width:56px;height:56px;filter:drop-shadow(0 0 8px rgba(239,68,68,0.8))">
                       <svg viewBox="0 0 56 56" width="56" height="56" fill="none">
                         <path d="M28 5 A 23 23 0 0 1 51 28" stroke="#EF4444" stroke-width="6" stroke-linecap="round"/>
                         <path d="M28 51 A 23 23 0 0 1 5 28" stroke="#EF4444" stroke-width="6" stroke-linecap="round"/>
                         <circle cx="28" cy="28" r="10.5" fill="#EF4444"/>
                         <circle cx="28" cy="28" r="4" fill="#FFFFFF"/>
                       </svg>
                     </div>`,
            }),
          })
            .bindTooltip(al.headline, { permanent: true, direction: "top", offset: [0, -32], className: "storm-label" })
            .addTo(group);
        }
        bounds.push([s.latitude, s.longitude]);
      });
    }

    // ========================================================================
    // 3. PLOTTED COURSES & EMERGENCY EVACUATION ROUTES
    // ========================================================================
    if (layerVis.routes) {
      routes.forEach((r) => {
        const line = r.legs.map((l) => [l.latitude, l.longitude] as [number, number]);
        line.forEach((p) => bounds.push(p));
        const rec = r.recommended;
        L.polyline(line, {
          color: rec ? "#10B981" : "#00A8CC",
          weight: rec ? 4 : 2.5,
          opacity: rec ? 0.95 : 0.65,
          dashArray: rec ? "12 12" : "3 8",
          className: rec ? "route-live" : "",
        })
          .bindPopup(`<b>${r.name}</b><br/>${r.distance_km} km · ${Math.round(r.eta_minutes)} min<br/><span style="font-size:11px;opacity:.8">${r.notes}</span>`)
          .addTo(group);
      });

      if (emergencyRoute?.available && emergencyRoute.waypoints.length > 1) {
        const line = emergencyRoute.waypoints.map((p) => [p.latitude, p.longitude] as [number, number]);
        line.forEach((p) => bounds.push(p));
        L.polyline(line, {
          color: "#EF4444",
          weight: 5,
          opacity: 0.95,
          dashArray: "16 8",
          className: "route-emergency",
        })
          .bindPopup(`<b>Emergency Safe Route</b><br/>${emergencyRoute.destination?.name ?? "Safe Shore"}<br/>${emergencyRoute.distance_km} km · ${emergencyRoute.eta_minutes} min`)
          .addTo(group);
      }
    }

    // ========================================================================
    // 4. POTENTIAL FISHING GROUNDS (PFZ) — COMPLETE COLORED OCEAN LAYERS
    // ========================================================================
    if (layerVis.pfz) {
      if (areas.length) {
        areas.forEach((a) => {
          const best = a.rank === 1;
          const isGood = a.rank <= 3;
          const zoneRadius = Math.max(3800, Math.min(6800, (a.probability || 70) * 75));

          const zoneColor = best ? "#10B981" : isGood ? "#00A8CC" : "#3B82F6";
          const strokeColor = best ? "#059669" : isGood ? "#007A96" : "#2563EB";
          const zoneFillOpacity = best ? 0.28 : isGood ? 0.22 : 0.16;

          // Outer Concentric Thermal Front Ring
          L.circle([a.latitude, a.longitude], {
            radius: zoneRadius * 1.32,
            color: best ? "#34D399" : isGood ? "#38BDF8" : "#60A5FA",
            weight: 1.5,
            opacity: 0.6,
            dashArray: "6 6",
            fill: false,
            interactive: false,
          }).addTo(group);

          // Main Colored Thermal/Chlorophyll Core Zone Layer
          const zoneLayer = L.circle([a.latitude, a.longitude], {
            radius: zoneRadius,
            color: strokeColor,
            weight: best ? 2.5 : 2,
            opacity: 0.9,
            fillColor: zoneColor,
            fillOpacity: zoneFillOpacity,
            className: best ? "zone-glow-pfz-1" : isGood ? "zone-glow-pfz-2" : "",
          }).addTo(group);

          // Zone Floating Tag Badge at Edge
          L.marker([a.latitude + 0.038, a.longitude], {
            icon: L.divIcon({
              className: "",
              iconSize: [120, 20],
              iconAnchor: [60, 10],
              html: `<div class="zone-floating-tag" style="border:1px solid ${zoneColor};color:${zoneColor}">
                       ${best ? "★ PRIME PFZ #" + a.rank : "PFZ GROUND #" + a.rank} (${a.probability}%)
                     </div>`,
            }),
            interactive: false,
          }).addTo(group);

          const popupContent = `
            <div style="font-family: Inter, sans-serif; min-width: 195px;">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:4px;">
                <b style="color:${zoneColor};font-size:14px;">Area #${a.rank} (${a.rating.replace(/_/g, " ")})</b>
                <span style="font-size:10px;padding:2px 6px;border-radius:2px;background:${zoneColor}22;color:${zoneColor};font-weight:700;">${a.probability}% FISH</span>
              </div>
              <div style="font-size:11.5px;line-height:1.6;color:var(--text-bright);">
                <div>📍 <b>${Math.round(a.distance_km)} km</b> ${a.bearing} from harbour</div>
                <div>🌊 SST: <b>${a.sst_c ?? "—"} °C</b> · Chlorophyll: <b>${a.chlorophyll_mg_m3 ?? "—"} mg/m³</b></div>
                ${a.likely_species?.length ? `<div>🐟 Species: <b>${a.likely_species.join(", ")}</b></div>` : ""}
                ${a.species_suitability ? `<div>🎯 ${a.species_suitability.species_name}: <b>${Math.round(a.species_suitability.suitability * 100)}%</b> match</div>` : ""}
              </div>
              <div style="margin-top:6px;font-size:9.5px;color:var(--text-dim);border-top:1px solid var(--border);padding-top:4px;">
                Thermal upwelling zone · INCOIS Advisory
              </div>
            </div>
          `;
          zoneLayer.bindPopup(popupContent);

          // Central Buoy Pin Marker
          const size = best ? 46 : 38;
          const focused = focusRank === a.rank;
          L.marker([a.latitude, a.longitude], {
            zIndexOffset: best ? 500 : 0,
            icon: L.divIcon({
              className: "",
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              html: `<div class="bob" style="position:relative;width:${size}px;height:${size}px;animation-delay:${((a.rank * 7) % 10) / 3}s">
                       ${focused ? `<div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid ${zoneColor};animation:ping2 1.6s cubic-bezier(0,0,.2,1) infinite"></div>` : ""}
                       <div class="buoy" style="position:absolute;inset:0;border-radius:50%;background:${best ? "#064E3B" : "#0A2540"};border:${best ? 3.5 : 2.5}px solid ${zoneColor};display:flex;flex-direction:column;align-items:center;justify-content:center;line-height:1;gap:1px;box-shadow:0 3px 12px rgba(0,0,0,0.6);color:#FFFFFF">
                         <span style="font:800 ${best ? "16px" : "14px"} ${SERIF}">${a.rank}</span>
                         <span style="font:700 ${best ? "8.5px" : "8px"} ${MONO};color:${best ? "#A7F3D0" : "#7DD3FC"}">${a.probability}%</span>
                       </div>
                     </div>`,
            }),
          })
            .bindPopup(popupContent)
            .addTo(group);

          bounds.push([a.latitude, a.longitude]);
        });
      } else {
        pfz.forEach((z) => {
          const best = z.rank === 1;
          const zoneColor = best ? "#10B981" : "#00A8CC";

          // Colored zone circle
          L.circle([z.latitude, z.longitude], {
            radius: 4500,
            color: zoneColor,
            weight: 2,
            fillColor: zoneColor,
            fillOpacity: best ? 0.25 : 0.18,
          })
            .bindPopup(`<b>Zone #${z.rank}</b><br/>Confidence ${Math.round(z.confidence * 100)}%<br/>SST ${z.sst_c ?? "—"} °C`)
            .addTo(group);

          const size = best ? 40 : 32;
          L.marker([z.latitude, z.longitude], {
            icon: L.divIcon({
              className: "",
              iconSize: [size, size],
              iconAnchor: [size / 2, size / 2],
              html: `<div class="bob" style="width:${size}px;height:${size}px;">
                       <div class="buoy" style="width:100%;height:100%;border-radius:50%;background:#0A2540;border:3px solid ${zoneColor};display:grid;place-items:center;color:#FFFFFF;font:800 14px ${SERIF};box-shadow:0 3px 10px rgba(0,0,0,0.5)">${z.rank}</div>
                     </div>`,
            }),
          }).addTo(group);
          bounds.push([z.latitude, z.longitude]);
        });
      }
    }

    // ========================================================================
    // 5. DRAGGABLE VESSEL (INSPECTION BOAT)
    // ========================================================================
    if (origin) {
      const boat = L.marker([origin.latitude, origin.longitude], {
        draggable: true,
        autoPan: true,
        icon: L.divIcon({
          className: "",
          iconSize: [36, 36],
          iconAnchor: [18, 18],
          html: `<div class="roll" style="position:relative;width:36px;height:36px;cursor:grab">
                   <div style="position:absolute;inset:-8px;border-radius:50%;border:2px solid var(--ocean);animation:ping2 2s cubic-bezier(0,0,.2,1) infinite"></div>
                   <div class="buoy" style="position:absolute;inset:0;border-radius:50%;background:#061424;border:2.5px solid var(--ocean-bright);box-shadow:0 4px 14px rgba(0,194,232,0.4);display:grid;place-items:center">
                     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#00E5FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                       <path d="M12 3v10"/><path d="M12 5l7 8H5l7-8z" fill="#00E5FF" stroke="none"/>
                       <path d="M3 17c2 1.6 4 1.6 6 0s4-1.6 6 0 4 1.6 6 0"/>
                     </svg>
                   </div>
                 </div>`,
        }),
      })
        .bindPopup(`<b>${origin.name}</b><br/>Drag anywhere to inspect ocean conditions`)
        .addTo(group);

      boat.on("click", (event) => {
        if (event.originalEvent) L.DomEvent.stopPropagation(event.originalEvent);
      });
      boat.on("dragstart", () => {
        isBoatDragRef.current = true;
        setDragging(true);
      });
      boat.on("dragend", async () => {
        setDragging(false);
        const { lat, lng } = boat.getLatLng();
        const nextLatitude = +lat.toFixed(4);
        const nextLongitude = +lng.toFixed(4);
        onPickLocation?.(nextLatitude, nextLongitude);
        try {
          setProbe(await api.checkPosition(nextLatitude, nextLongitude));
        } catch {
          setProbe(null);
        }
      });

      boatRef.current = boat;
      bounds.push([origin.latitude, origin.longitude]);
    }

    const originKey = origin ? `${origin.latitude.toFixed(4)},${origin.longitude.toFixed(4)}` : null;
    const wasDrag = isBoatDragRef.current;
    isBoatDragRef.current = false;

    // Viewport bounds calculation
    if (!initialFitDoneRef.current) {
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.22), { animate: false });
        initialFitDoneRef.current = true;
      } else if (origin) {
        map.setView([origin.latitude, origin.longitude], 10, { animate: false });
        initialFitDoneRef.current = true;
      }
    } else if (!wasDrag && originKey && prevOriginKeyRef.current && originKey !== prevOriginKeyRef.current) {
      if (bounds.length > 1) {
        map.fitBounds(L.latLngBounds(bounds).pad(0.22), { animate: true });
      } else if (origin) {
        map.setView([origin.latitude, origin.longitude], map.getZoom(), { animate: true });
      }
    }
    prevOriginKeyRef.current = originKey;
  }, [origin, emergencyRoute, zones, pfz, areas, routes, radiusKm, focusRank, alerts, onPickLocation, layerVis]);

  // Fly to ground on focus
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !focusRank) return;
    const target = areas.find((a) => a.rank === focusRank);
    if (target) map.flyTo([target.latitude, target.longitude], 11, { duration: 0.8 });
  }, [focusRank, areas]);

  const critical = geofence.filter((g) => g.severity === "critical");
  const banner =
    probe != null
      ? { style: STATUS_STYLE[probe.status], text: probe.headline, sub: probeSub(probe) }
      : critical.length
        ? { style: STATUS_STYLE.critical, text: critical[0].message, sub: null }
        : null;

  const lg = LEGEND[language] ?? LEGEND.en;

  const pfzCount = areas.length || pfz.length;
  const restrictedCount = zones.filter((z) => z.properties.zone_type !== "port_limit").length;
  const channelCount = zones.filter((z) => z.properties.zone_type === "port_limit").length;
  const stormCount = alerts.filter((a) => a.storm).length;

  return (
    <div
      className="chart-sheet"
      style={fill ? { height: "100%", display: "flex", flexDirection: "column", flex: 1, minHeight: 0 } : undefined}
    >
      {/* Admiralty Chart Header Bar */}
      <div className="chart-header-bar">
        <span className="chart-header-label chart-header-label--accent">
          ◉ {lg.marginL}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span className="chart-header-label" style={{ color: "var(--ocean)" }}>
            BASEMAP: {BASEMAP_TILES[basemap]?.name.toUpperCase()}
          </span>
          <span className="chart-header-label">
            {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}
          </span>
        </div>
      </div>

      <div
        className="chart-frame"
        style={fill ? { flex: 1, minHeight: 0, display: "flex", flexDirection: "column", position: "relative" } : undefined}
      >
        <div
          ref={containerRef}
          className="w-full"
          style={
            fill
              ? { flex: 1, minHeight: 380, height: "100%", width: "100%" }
              : { height: mapHeight, minHeight: typeof mapHeight === "number" ? mapHeight : 440 }
          }
        />

        {/* Animated ocean hydrodynamic ripples */}
        <div className="ocean-water-anim" aria-hidden="true">
          <div className="ocean-swell-layer ocean-swell-layer--1" />
          <div className="ocean-swell-layer ocean-swell-layer--2" />
        </div>

        {/* Compass rose overlay */}
        <div className="chart-compass">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none" aria-hidden>
            <circle cx="28" cy="28" r="26" stroke="rgba(0,168,204,0.4)" strokeWidth="0.8" />
            {[0, 90, 180, 270].map((deg) => (
              <line
                key={deg}
                x1="28" y1="4" x2="28" y2="8"
                stroke="rgba(0,168,204,0.7)" strokeWidth="1.2"
                transform={`rotate(${deg} 28 28)`}
              />
            ))}
            {[45, 135, 225, 315].map((deg) => (
              <line
                key={deg}
                x1="28" y1="4" x2="28" y2="6"
                stroke="rgba(0,168,204,0.35)" strokeWidth="0.8"
                transform={`rotate(${deg} 28 28)`}
              />
            ))}
            <polygon points="28,6 31,28 28,24 25,28" fill="rgba(0,229,255,0.9)" />
            <polygon points="28,50 31,28 28,32 25,28" fill="rgba(0,168,204,0.3)" />
            <circle cx="28" cy="28" r="2.5" fill="rgba(0,168,204,0.8)" />
            <text x="28" y="3" textAnchor="middle" fontSize="5" fontWeight="800"
              fontFamily="Spline Sans Mono Variable, Consolas, monospace"
              fill="rgba(0,229,255,0.8)" letterSpacing="0.08em">N</text>
          </svg>
        </div>

        {/* Live coordinate readout */}
        <div ref={coordBadgeRef} className="chart-coordinate-badge" />

        {/* ================================================================
            INTERACTIVE MAP LAYER CONTROLLER & LEGEND (FLOATING GLASS BAR)
            ================================================================ */}
        <div
          className="absolute bottom-3 left-3 z-[500] select-none transition-all duration-200"
          style={{
            background: "var(--hud-bg)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--hud-border)",
            borderRadius: 8,
            boxShadow: "var(--hud-shadow)",
            padding: "8px 12px",
            maxWidth: "calc(100% - 24px)",
          }}
        >
          {/* Header & Toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, color: "var(--ocean-bright)" }}>◈</span>
              <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--text-bright)" }}>
                {lg.layers}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Basemap Switcher */}
              <div style={{ display: "flex", gap: 3, background: "var(--hud-header-bg)", padding: 2, borderRadius: 4, border: "1px solid var(--hud-card-border)" }}>
                {(["dark", "ocean", "osm"] as BasemapMode[]).map((b) => (
                  <button
                    key={b}
                    onClick={() => setBasemap(b)}
                    title={`Switch to ${BASEMAP_TILES[b].name}`}
                    style={{
                      fontFamily: "Spline Sans Mono Variable, Consolas, monospace",
                      fontSize: 8.5,
                      fontWeight: 700,
                      padding: "2px 5px",
                      borderRadius: 3,
                      border: "none",
                      background: basemap === b ? "var(--ocean)" : "transparent",
                      color: basemap === b ? "#FFFFFF" : "var(--text-dim)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    {BASEMAP_TILES[b].icon}
                  </button>
                ))}
              </div>
              {/* Expand / Collapse */}
              <button
                onClick={() => setLayersOpen((v) => !v)}
                title={layersOpen ? "Collapse layers" : "Expand layers"}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontSize: 10,
                  padding: "0 2px",
                }}
              >
                {layersOpen ? "▼" : "▲"}
              </button>
            </div>
          </div>

          {/* Expanded Layer Toggles & Color Legend */}
          {layersOpen && (
            <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--hud-border-dim)", display: "flex", flexDirection: "column", gap: 5 }}>
              {/* PFZ Grounds */}
              <button
                onClick={() => setLayerVis((v) => ({ ...v, pfz: !v.pfz }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: layerVis.pfz ? "rgba(16,185,129,0.12)" : "transparent",
                  border: `1px solid ${layerVis.pfz ? "rgba(16,185,129,0.35)" : "transparent"}`,
                  borderRadius: 4,
                  padding: "3px 7px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981", boxShadow: "0 0 6px #10B981", display: "inline-block" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: layerVis.pfz ? "var(--text-bright)" : "var(--text-dim)" }}>
                    {lg.pfzZones}
                  </span>
                </div>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 700, color: "#10B981" }}>
                  {pfzCount} {layerVis.pfz ? "ON" : "OFF"}
                </span>
              </button>

              {/* Naval & Restricted */}
              <button
                onClick={() => setLayerVis((v) => ({ ...v, restricted: !v.restricted }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: layerVis.restricted ? "rgba(239,68,68,0.12)" : "transparent",
                  border: `1px solid ${layerVis.restricted ? "rgba(239,68,68,0.35)" : "transparent"}`,
                  borderRadius: 4,
                  padding: "3px 7px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444", boxShadow: "0 0 6px #EF4444", display: "inline-block" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: layerVis.restricted ? "var(--text-bright)" : "var(--text-dim)" }}>
                    {lg.restricted}
                  </span>
                </div>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 700, color: "#EF4444" }}>
                  {restrictedCount} {layerVis.restricted ? "ON" : "OFF"}
                </span>
              </button>

              {/* Port Channels */}
              <button
                onClick={() => setLayerVis((v) => ({ ...v, channels: !v.channels }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  background: layerVis.channels ? "rgba(245,158,11,0.12)" : "transparent",
                  border: `1px solid ${layerVis.channels ? "rgba(245,158,11,0.35)" : "transparent"}`,
                  borderRadius: 4,
                  padding: "3px 7px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#F59E0B", boxShadow: "0 0 6px #F59E0B", display: "inline-block" }} />
                  <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: layerVis.channels ? "var(--text-bright)" : "var(--text-dim)" }}>
                    {lg.channels}
                  </span>
                </div>
                <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 700, color: "#F59E0B" }}>
                  {channelCount} {layerVis.channels ? "ON" : "OFF"}
                </span>
              </button>

              {/* Weather Alerts / Storms (if active) */}
              {stormCount > 0 && (
                <button
                  onClick={() => setLayerVis((v) => ({ ...v, weather: !v.weather }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    background: layerVis.weather ? "rgba(220,38,38,0.15)" : "transparent",
                    border: `1px solid ${layerVis.weather ? "rgba(220,38,38,0.4)" : "transparent"}`,
                    borderRadius: 4,
                    padding: "3px 7px",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "#EF4444" }}>🌀</span>
                    <span style={{ fontFamily: "Inter, sans-serif", fontSize: 11, fontWeight: 600, color: layerVis.weather ? "#EF4444" : "var(--text-dim)" }}>
                      {lg.weather}
                    </span>
                  </div>
                  <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 700, color: "#EF4444" }}>
                    {stormCount} {layerVis.weather ? "ON" : "OFF"}
                  </span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Drag Hint */}
        {origin && !probe && !dragging && (
          <div
            className="pointer-events-none absolute bottom-3 right-3 z-[500] shadow-md"
            style={{
              background: "var(--hud-bg)",
              backdropFilter: "blur(12px)",
              border: "1px solid var(--hud-border)",
              borderRadius: 6,
              padding: "5px 10px",
            }}
          >
            <span style={{ fontFamily: "Spline Sans Mono Variable, Consolas, monospace", fontSize: 9, fontWeight: 600, letterSpacing: "0.08em", color: "var(--text-mid)" }}>
              {HINT[language] ?? HINT.en}
            </span>
          </div>
        )}

        {/* Live Geofence Banner */}
        {banner && (
          <div
            className={`absolute left-1/2 top-3 z-[500] max-w-[78%] -translate-x-1/2 animate-rise rounded-[2px] px-3.5 py-2 text-[12px] font-semibold text-paper-50 shadow-lg ${banner.style}`}
          >
            <div>{banner.text}</div>
            {banner.sub && (
              <div className="mt-0.5 font-mono text-[10px] font-normal opacity-85">{banner.sub}</div>
            )}
          </div>
        )}
      </div>

      {/* Sheet Margin Note */}
      <div className="mt-[7px] flex items-baseline justify-between shrink-0">
        <span className="font-mono text-[8.5px] font-semibold uppercase tracking-[0.18em] text-ink-400">
          {lg.marginR}
        </span>
        <span className="chart-header-label" style={{ fontSize: 7, letterSpacing: "0.14em" }}>
          WGS 84 · SOUNDINGS IN METRES
        </span>
      </div>
    </div>
  );
}

function probeSub(p: PositionCheck): string {
  const bits: string[] = [];
  if (p.distance_from_shore_km != null) bits.push(`${p.distance_from_shore_km} km offshore`);
  if (p.nearest_zone_name && p.nearest_zone_km != null && !p.inside_restricted_zone)
    bits.push(`${p.nearest_zone_name}: ${p.nearest_zone_km} km`);
  return bits.join(" · ");
}
