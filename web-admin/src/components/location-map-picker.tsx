"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MapPin,
  ZoomIn,
  ZoomOut,
  Search,
  X,
  Loader2,
  Navigation2,
  Building2,
  ChevronRight,
  Maximize2,
  Minimize2,
  Layers,
  Check,
} from "lucide-react";

interface LocationMapPickerProps {
  latitude: number | null;
  longitude: number | null;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}

interface MapboxFeature {
  id: string;
  place_name: string;
  center: [number, number];
  place_type: string[];
}

type LeafletMap = {
  on: (
    event: string,
    cb: (e: { latlng: { lat: number; lng: number } }) => void,
  ) => void;
  setView: (latlng: [number, number], zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  remove: () => void;
  invalidateSize: () => void;
  getZoom: () => number;
};

type LeafletMarker = {
  addTo: (m: unknown) => LeafletMarker;
  setLatLng: (latlng: [number, number]) => void;
  on: (
    event: string,
    cb: (e: { latlng: { lat: number; lng: number } }) => void,
  ) => void;
};

type LeafletCircle = {
  addTo: (m: unknown) => LeafletCircle;
  setLatLng: (latlng: [number, number]) => void;
  setRadius: (r: number) => void;
};

type LeafletTileLayer = {
  addTo: (m: unknown) => LeafletTileLayer;
  remove: () => void;
};

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const TILE_LAYERS = [
  {
    id: "voyager",
    label: "Streets",
    description: "CARTO Voyager",
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution: "© CARTO",
    preview: "🗺️",
  },
  {
    id: "light",
    label: "Light",
    description: "CARTO Positron",
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
    attribution: "© CARTO",
    preview: "☀️",
  },
  {
    id: "dark",
    label: "Dark",
    description: "CARTO Dark Matter",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution: "© CARTO",
    preview: "🌙",
  },
  {
    id: "satellite",
    label: "Satellite",
    description: "ESRI World Imagery",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "© Esri",
    preview: "🛰️",
  },
  {
    id: "topo",
    label: "Terrain",
    description: "OpenTopoMap",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution: "© OpenTopoMap",
    preview: "⛰️",
  },
];

export function LocationMapPicker({
  latitude,
  longitude,
  radiusMeters,
  onChange,
}: LocationMapPickerProps) {
  const inlineMapRef = useRef<HTMLDivElement>(null);
  const fsMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const circleRef = useRef<LeafletCircle | null>(null);
  const tileLayerRef = useRef<LeafletTileLayer | null>(null);
  const libRef = useRef<any>(null);
  const leafletInitialized = useRef(false);

  const [isLoading, setIsLoading] = useState(true);
  const [address, setAddress] = useState<string>("");
  const [fetchingAddress, setFetchingAddress] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTile, setActiveTile] = useState(TILE_LAYERS[0]);
  const [showLayerPicker, setShowLayerPicker] = useState(false);
  const isDark = activeTile.id === "dark" || activeTile.id === "satellite";

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<MapboxFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const inlineSearchRef = useRef<HTMLDivElement>(null);
  const fsSearchRef = useRef<HTMLDivElement>(null);
  const layerPickerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const defaultLat = latitude || -8.1845;
  const defaultLng = longitude || 113.6681;

  const moveMarker = useCallback((lat: number, lng: number) => {
    if (!mapInstanceRef.current || !markerRef.current || !circleRef.current)
      return;
    markerRef.current.setLatLng([lat, lng]);
    circleRef.current.setLatLng([lat, lng]);
    mapInstanceRef.current.setView(
      [lat, lng],
      mapInstanceRef.current.getZoom(),
    );
  }, []);

  const reverseGeocode = useCallback(async (lat: number, lng: number) => {
    if (!MAPBOX_TOKEN) return;
    setFetchingAddress(true);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&language=id&limit=1`,
      );
      const data = await res.json();
      if (data.features?.length > 0) setAddress(data.features[0].place_name);
    } catch {
      /* ignore */
    } finally {
      setFetchingAddress(false);
    }
  }, []);

  const searchLocations = useCallback(async (query: string) => {
    if (!MAPBOX_TOKEN || query.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    setIsSearching(true);
    try {
      const sessionToken = crypto.randomUUID();
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/suggest?q=${encodeURIComponent(query)}&language=id&country=id&limit=6&session_token=${sessionToken}&access_token=${MAPBOX_TOKEN}`,
      );
      const data = await res.json();
      setSearchResults(
        data.suggestions.map((s: any) => ({
          id: s.mapbox_id,
          place_name: s.name,
          center: [0, 0] as [number, number],
          place_type: [s.feature_type],
        })),
      );
      setShowResults(true);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }
    searchTimeoutRef.current = setTimeout(() => searchLocations(value), 400);
  };

  const handleSelectResult = async (feature: MapboxFeature) => {
    if (!MAPBOX_TOKEN) return;
    try {
      const sessionToken = crypto.randomUUID();
      const res = await fetch(
        `https://api.mapbox.com/search/searchbox/v1/retrieve/${feature.id}?session_token=${sessionToken}&access_token=${MAPBOX_TOKEN}`,
      );
      const data = await res.json();
      const result = data.features?.[0];
      if (!result) return;
      const [lng, lat] = result.geometry.coordinates;
      onChange(lat, lng);
      moveMarker(lat, lng);
      setAddress(result.properties.full_address || result.properties.name);
      setSearchQuery(result.properties.name);
      setShowResults(false);
      setSearchResults([]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleClearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      const inSearch =
        inlineSearchRef.current?.contains(target) ||
        fsSearchRef.current?.contains(target);
      if (!inSearch) {
        setShowResults(false);
        setIsFocused(false);
      }
      if (layerPickerRef.current && !layerPickerRef.current.contains(target))
        setShowLayerPicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ESC to close fullscreen
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", h);
    return () => document.removeEventListener("keydown", h);
  }, []);

  // Reparent map div when toggling fullscreen
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const targetContainer = isFullscreen
      ? fsMapRef.current
      : inlineMapRef.current;
    if (!targetContainer) return;

    // Move the leaflet container into the correct parent
    const leafletEl = targetContainer.querySelector(".leaflet-container");
    if (!leafletEl) {
      // First paint in this container — just invalidate
      setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
      return;
    }
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
  }, [isFullscreen]);

  const switchTileLayer = useCallback((tile: (typeof TILE_LAYERS)[0]) => {
    if (!mapInstanceRef.current || !libRef.current) return;
    tileLayerRef.current?.remove();
    tileLayerRef.current = libRef.current
      .tileLayer(tile.url, {
        attribution: tile.attribution,
        maxZoom: 19,
      })
      .addTo(mapInstanceRef.current);
    setActiveTile(tile);
    setShowLayerPicker(false);
  }, []);

  // Init Leaflet — mount map into inlineMapRef
  useEffect(() => {
    if (leafletInitialized.current || !inlineMapRef.current) return;
    leafletInitialized.current = true;

    const loadLeaflet = async () => {
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }
      let L: any;
      try {
        L = await import("leaflet");
      } catch {
        await new Promise<void>((resolve) => {
          if ((window as any).L) {
            resolve();
            return;
          }
          const s = document.createElement("script");
          s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          s.onload = () => resolve();
          document.head.appendChild(s);
        });
        L = (window as any).L;
      }
      if (!inlineMapRef.current) return;
      libRef.current = L;

      const map = L.map(inlineMapRef.current, {
        center: [defaultLat, defaultLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      });

      tileLayerRef.current = L.tileLayer(TILE_LAYERS[0].url, {
        attribution: TILE_LAYERS[0].attribution,
        maxZoom: 19,
      }).addTo(map);

      const customIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:36px;height:44px;filter:drop-shadow(0 4px 12px rgba(14,78,204,0.4))">
          <svg width="36" height="44" viewBox="0 0 36 44" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 0C8.059 0 0 8.059 0 18C0 31.5 18 44 18 44C18 44 36 31.5 36 18C36 8.059 27.941 0 18 0Z" fill="#0E4ECC"/>
            <circle cx="18" cy="18" r="8" fill="white"/>
            <circle cx="18" cy="18" r="4" fill="#0E4ECC"/>
          </svg>
        </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
      });

      const marker = L.marker([defaultLat, defaultLng], {
        icon: customIcon,
        draggable: true,
      }).addTo(map);
      const circle = L.circle([defaultLat, defaultLng], {
        radius: radiusMeters,
        color: "#0E4ECC",
        fillColor: "#0E4ECC",
        fillOpacity: 0.08,
        weight: 1.5,
        dashArray: "6 4",
      }).addTo(map);

      markerRef.current = marker;
      circleRef.current = circle;
      mapInstanceRef.current = map;

      marker.on("dragend", (e: any) => {
        const { lat, lng } = e.latlng;
        circle.setLatLng([lat, lng]);
        onChange(lat, lng);
        reverseGeocode(lat, lng);
      });
      map.on("click", (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        circle.setLatLng([lat, lng]);
        onChange(lat, lng);
        reverseGeocode(lat, lng);
      });

      setIsLoading(false);
      if (latitude && longitude) reverseGeocode(latitude, longitude);
    };

    loadLeaflet();
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        markerRef.current = null;
        circleRef.current = null;
        tileLayerRef.current = null;
        leafletInitialized.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Move the Leaflet DOM element between containers on fullscreen toggle
  useEffect(() => {
    const container = isFullscreen ? fsMapRef.current : inlineMapRef.current;
    if (!container || !mapInstanceRef.current) return;

    // Find leaflet root and reparent it
    const leafletEl = (mapInstanceRef.current as any)._container as
      | HTMLElement
      | undefined;
    if (leafletEl && leafletEl.parentElement !== container) {
      container.appendChild(leafletEl);
    }
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 80);
  }, [isFullscreen]);

  useEffect(() => {
    circleRef.current?.setRadius(radiusMeters);
  }, [radiusMeters]);
  useEffect(() => {
    if (!latitude || !longitude) return;
    moveMarker(latitude, longitude);
  }, [latitude, longitude, moveMarker]);

  const handleGetCurrentLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      onChange(lat, lng);
      moveMarker(lat, lng);
      reverseGeocode(lat, lng);
    });
  };

  const handleZoom = (dir: "in" | "out") => {
    if (!mapInstanceRef.current) return;
    dir === "in"
      ? mapInstanceRef.current.zoomIn()
      : mapInstanceRef.current.zoomOut();
  };

  /* ── Shared overlay controls ── */
  const MapOverlays = ({ dark = false }: { dark?: boolean }) => (
    <>
      {/* Right: Zoom + Layers */}
      <div className="lmp-ctrl-col">
        <button
          type="button"
          className={`lmp-ctrl-btn ${dark ? "dk" : ""}`}
          onClick={() => handleZoom("in")}
          title="Perbesar"
        >
          <ZoomIn size={15} />
        </button>
        <div className={`lmp-ctrl-div ${dark ? "dk" : ""}`} />
        <button
          type="button"
          className={`lmp-ctrl-btn ${dark ? "dk" : ""}`}
          onClick={() => handleZoom("out")}
          title="Perkecil"
        >
          <ZoomOut size={15} />
        </button>
        <div style={{ height: 8 }} />
        <div ref={layerPickerRef} style={{ position: "relative" }}>
          <button
            type="button"
            className={`lmp-ctrl-btn ${dark ? "dk" : ""} ${showLayerPicker ? "act" : ""}`}
            title="Ganti layer peta"
            onClick={() => setShowLayerPicker((p) => !p)}
          >
            <Layers size={15} />
          </button>
          {showLayerPicker && (
            <div className={`lmp-layer-panel ${dark ? "dk" : ""}`}>
              <div className={`lmp-layer-hdr ${dark ? "dk" : ""}`}>
                Tile Layer
              </div>
              {TILE_LAYERS.map((tile) => (
                <button
                  key={tile.id}
                  type="button"
                  className={`lmp-layer-row ${dark ? "dk" : ""} ${activeTile.id === tile.id ? "sel" : ""}`}
                  onClick={() => switchTileLayer(tile)}
                >
                  <span className="lmp-layer-em">{tile.preview}</span>
                  <div className="lmp-layer-info">
                    <span className={`lmp-layer-name ${dark ? "dk" : ""}`}>
                      {tile.label}
                    </span>
                    <span className={`lmp-layer-desc ${dark ? "dk" : ""}`}>
                      {tile.description}
                    </span>
                  </div>
                  {activeTile.id === tile.id && (
                    <Check
                      size={13}
                      style={{ color: "var(--blue)", flexShrink: 0 }}
                    />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top-left: Locate + Fullscreen toggle */}
      {!isLoading && (
        <div className="lmp-tl-controls">
          <button
            type="button"
            className={`lmp-locate-pill ${dark ? "dk" : ""}`}
            onClick={handleGetCurrentLocation}
          >
            <Navigation2 size={12} style={{ color: "var(--blue)" }} />
            Lokasi Saya
          </button>
          {/* <button
            type="button"
            className={`lmp-ctrl-btn ${dark ? "dk" : ""}`}
            style={{ width: 34, height: 34 }}
            onClick={() => setIsFullscreen((p) => !p)}
            title={isFullscreen ? "Tutup layar penuh" : "Layar penuh"}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button> */}
        </div>
      )}

      {/* Bottom-left hint */}
      {!isLoading && (
        <div className="lmp-hint">
          <div className={`lmp-hint-pill ${dark ? "dk" : ""}`}>
            <span className="lmp-hint-dot" />
            Klik peta atau seret pin
          </div>
        </div>
      )}

      {/* Attribution */}
      <div className={`lmp-attr ${dark ? "dk" : ""}`}>
        {activeTile.attribution} ·{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noopener noreferrer"
        >
          © OSM
        </a>
      </div>
    </>
  );

  /* ── Search bar component ── */
  const SearchBar = ({
    refProp,
    fsStyle,
  }: {
    refProp: React.RefObject<HTMLDivElement | null>;
    fsStyle?: boolean;
  }) => (
    <div ref={refProp} className={`lmp-search-wrap ${fsStyle ? "fs" : ""}`}>
      <div
        className={`lmp-search-field ${isFocused ? "foc" : ""} ${fsStyle ? "fs" : ""}`}
      >
        <span className="lmp-search-icon">
          <Search size={15} />
        </span>
        <input
          className="lmp-search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            if (searchResults.length > 0) setShowResults(true);
          }}
          placeholder="Cari nama gedung, jalan, atau kawasan..."
        />
        <div className="lmp-search-actions">
          {isSearching && (
            <Loader2
              size={15}
              style={{
                color: "var(--blue)",
                animation: "lmp-spin 0.7s linear infinite",
              }}
            />
          )}
          {searchQuery && !isSearching && (
            <button
              type="button"
              className="lmp-clear-btn"
              onClick={handleClearSearch}
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
      {showResults && searchResults.length > 0 && (
        <div className={`lmp-results-dd ${fsStyle ? "fs" : ""}`}>
          <div className={`lmp-results-hdr ${fsStyle ? "fs" : ""}`}>
            Hasil Pencarian
          </div>
          {searchResults.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`lmp-result-row ${fsStyle ? "fs" : ""}`}
              onClick={() => handleSelectResult(f)}
            >
              <div className={`lmp-result-icon ${fsStyle ? "fs" : ""}`}>
                <Building2 size={15} />
              </div>
              <div className="lmp-result-text">
                <p className={`lmp-result-name ${fsStyle ? "fs" : ""}`}>
                  {f.place_name.split(",")[0]}
                </p>
                <p className={`lmp-result-sub ${fsStyle ? "fs" : ""}`}>
                  {f.place_name.split(", ").slice(1, 3).join(", ")}
                </p>
              </div>
              <ChevronRight size={14} className="lmp-result-arrow" />
            </button>
          ))}
        </div>
      )}
      {showResults &&
        !isSearching &&
        searchResults.length === 0 &&
        searchQuery.length >= 2 && (
          <div className={`lmp-results-dd ${fsStyle ? "fs" : ""}`}>
            <div className="lmp-no-results">
              Lokasi tidak ditemukan untuk "<strong>{searchQuery}</strong>"
            </div>
          </div>
        )}
    </div>
  );

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600&family=DM+Mono:wght@400;500&display=swap');

        :root {
          --blue: #0E4ECC;
          --blue-lt: #EEF3FF;
          --blue-md: #C7D7F8;
          --srf: #FFFFFF;
          --srf2: #F7F8FA;
          --srf3: #EFF1F5;
          --brd: #E3E6EC;
          --brd-foc: #0E4ECC;
          --tx1: #0D1117;
          --tx2: #5A6278;
          --tx3: #9AA0B2;
          --r: 10px;
          --r-sm: 7px;
          --sh-sm: 0 1px 3px rgba(13,17,23,0.06),0 1px 2px rgba(13,17,23,0.04);
          --sh-md: 0 4px 16px rgba(13,17,23,0.08),0 1px 4px rgba(13,17,23,0.05);
          --sh-lg: 0 12px 40px rgba(13,17,23,0.12),0 4px 12px rgba(13,17,23,0.06);
        }

        .lmp-root {
          font-family: 'DM Sans', sans-serif;
          display: flex; flex-direction: column; gap: 12px;
        }

        /* ── SEARCH ── */
        .lmp-search-wrap { position: relative; }
        .lmp-search-field {
          position: relative; display: flex; align-items: center;
          background: var(--srf); border: 1.5px solid var(--brd);
          border-radius: var(--r); transition: border-color .18s, box-shadow .18s;
          box-shadow: var(--sh-sm);
        }
        .lmp-search-field.foc {
          border-color: var(--brd-foc);
          box-shadow: 0 0 0 3px rgba(14,78,204,.1), var(--sh-sm);
        }
        .lmp-search-field.fs {
          background: rgba(255,255,255,.06); border-color: rgba(255,255,255,.1);
        }
        .lmp-search-field.fs.foc {
          background: rgba(255,255,255,.09); border-color: var(--blue);
          box-shadow: 0 0 0 3px rgba(14,78,204,.2);
        }
        .lmp-search-icon {
          position: absolute; left: 14px; color: var(--tx3);
          pointer-events: none; display: flex; align-items: center; transition: color .18s;
        }
        .lmp-search-field.foc .lmp-search-icon { color: var(--blue); }
        .lmp-search-field.fs .lmp-search-icon { color: rgba(255,255,255,.35); }
        .lmp-search-field.fs.foc .lmp-search-icon { color: #90B8FF; }
        .lmp-search-input {
          width: 100%; background: transparent; border: none; outline: none;
          padding: 11px 44px 11px 42px; font-family: 'DM Sans', sans-serif;
          font-size: 14px; font-weight: 400; color: var(--tx1); line-height: 1.5;
        }
        .lmp-search-field.fs .lmp-search-input { color: rgba(255,255,255,.9); }
        .lmp-search-input::placeholder { color: var(--tx3); }
        .lmp-search-field.fs .lmp-search-input::placeholder { color: rgba(255,255,255,.3); }
        .lmp-search-actions { position: absolute; right: 10px; display: flex; align-items: center; gap: 4px; }
        .lmp-clear-btn {
          width: 26px; height: 26px; border-radius: 6px; border: none;
          background: var(--srf3); color: var(--tx2); cursor: pointer;
          display: flex; align-items: center; justify-content: center; transition: background .15s, color .15s;
        }
        .lmp-clear-btn:hover { background: var(--brd); color: var(--tx1); }

        /* Dropdown */
        .lmp-results-dd {
          position: absolute; top: calc(100% + 6px); left: 0; right: 0;
          z-index: 3000; background: var(--srf); border: 1.5px solid var(--brd);
          border-radius: var(--r); box-shadow: var(--sh-lg); overflow: hidden;
          animation: lmp-fdrop .14s ease;
        }
        .lmp-results-dd.fs {
          background: #1A1E2A; border-color: rgba(255,255,255,.1);
          box-shadow: 0 12px 48px rgba(0,0,0,.5);
        }
        .lmp-results-hdr {
          padding: 8px 14px 6px; font-size: 10px; font-weight: 600;
          letter-spacing: .08em; text-transform: uppercase; color: var(--tx3);
          border-bottom: 1px solid var(--brd);
        }
        .lmp-results-hdr.fs { border-color: rgba(255,255,255,.08); color: rgba(255,255,255,.3); }
        .lmp-result-row {
          width: 100%; display: flex; align-items: center; gap: 12px; padding: 11px 14px;
          text-align: left; background: transparent; border: none;
          border-bottom: 1px solid var(--srf3); cursor: pointer; transition: background .12s;
        }
        .lmp-result-row.fs { border-color: rgba(255,255,255,.05); }
        .lmp-result-row:last-child { border-bottom: none; }
        .lmp-result-row:hover { background: var(--blue-lt); }
        .lmp-result-row.fs:hover { background: rgba(14,78,204,.2); }
        .lmp-result-icon {
          width: 32px; height: 32px; border-radius: 8px; background: var(--blue-lt);
          color: var(--blue); display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lmp-result-icon.fs { background: rgba(14,78,204,.2); color: #90B8FF; }
        .lmp-result-text { flex: 1; min-width: 0; }
        .lmp-result-name {
          font-size: 13.5px; font-weight: 500; color: var(--tx1); margin: 0; line-height: 1.4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lmp-result-name.fs { color: rgba(255,255,255,.85); }
        .lmp-result-sub {
          font-size: 12px; color: var(--tx3); margin: 0; line-height: 1.4;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .lmp-result-sub.fs { color: rgba(255,255,255,.3); }
        .lmp-result-arrow { color: var(--tx3); flex-shrink: 0; opacity: 0; transition: opacity .12s, transform .12s; }
        .lmp-result-row:hover .lmp-result-arrow { opacity: 1; transform: translateX(2px); }
        .lmp-no-results { padding: 20px 16px; text-align: center; font-size: 13px; color: var(--tx3); }

        /* ── MAP INLINE ── */
        .lmp-map-wrap {
          position: relative; border-radius: var(--r); overflow: hidden;
          border: 1.5px solid var(--brd); box-shadow: var(--sh-sm); height: 400px;
        }
        .lmp-map-canvas { height: 100%; width: 100%; }
        .lmp-loading {
          position: absolute; inset: 0; z-index: 10; background: var(--srf2);
          display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
        }
        .lmp-loader-ring {
          width: 36px; height: 36px; border: 2.5px solid var(--brd);
          border-top-color: var(--blue); border-radius: 50%; animation: lmp-spin .7s linear infinite;
        }
        .lmp-loading-txt { font-size: 13px; color: var(--tx3); font-weight: 500; }

        /* ── MAP CONTROLS ── */
        .lmp-ctrl-col {
          position: absolute; top: 14px; right: 14px; z-index: 1000;
          display: flex; flex-direction: column; gap: 4px; align-items: center;
        }
        .lmp-ctrl-btn {
          width: 34px; height: 34px; border-radius: var(--r-sm);
          border: 1.5px solid var(--brd); background: var(--srf);
          color: var(--tx2); display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: var(--sh-sm); transition: background .14s, color .14s, transform .1s, border-color .14s;
        }
        .lmp-ctrl-btn.dk {
          background: rgba(20,24,34,.85); border-color: rgba(255,255,255,.12);
          color: rgba(255,255,255,.65); backdrop-filter: blur(8px);
        }
        .lmp-ctrl-btn:hover, .lmp-ctrl-btn.act {
          background: var(--blue-lt); color: var(--blue); border-color: var(--blue-md);
          transform: translateY(-1px); box-shadow: var(--sh-md);
        }
        .lmp-ctrl-btn.dk:hover, .lmp-ctrl-btn.dk.act {
          background: rgba(14,78,204,.3); color: #90B8FF; border-color: rgba(14,78,204,.5);
          transform: translateY(-1px);
        }
        .lmp-ctrl-btn:active { transform: translateY(0); }
        .lmp-ctrl-div { height: 1px; width: 26px; background: var(--brd); margin: 2px 4px; }
        .lmp-ctrl-div.dk { background: rgba(255,255,255,.1); }

        /* Layer panel */
        .lmp-layer-panel {
          position: absolute; right: 40px; top: 0; width: 192px;
          background: var(--srf); border: 1.5px solid var(--brd);
          border-radius: var(--r); box-shadow: var(--sh-lg); overflow: hidden;
          animation: lmp-fslide .15s ease; z-index: 2000;
        }
        .lmp-layer-panel.dk { background: #1A1E2A; border-color: rgba(255,255,255,.1); }
        .lmp-layer-hdr {
          padding: 8px 12px 6px; font-size: 10px; font-weight: 600;
          letter-spacing: .08em; text-transform: uppercase; color: var(--tx3);
          border-bottom: 1px solid var(--brd);
        }
        .lmp-layer-hdr.dk { border-color: rgba(255,255,255,.08); color: rgba(255,255,255,.35); }
        .lmp-layer-row {
          width: 100%; display: flex; align-items: center; gap: 10px; padding: 9px 12px;
          background: transparent; border: none; border-bottom: 1px solid var(--srf3);
          cursor: pointer; transition: background .12s; text-align: left;
        }
        .lmp-layer-row:last-child { border-bottom: none; }
        .lmp-layer-row:hover, .lmp-layer-row.sel { background: var(--blue-lt); }
        .lmp-layer-row.dk { border-color: rgba(255,255,255,.05); }
        .lmp-layer-row.dk:hover, .lmp-layer-row.dk.sel { background: rgba(14,78,204,.2); }
        .lmp-layer-em { font-size: 16px; flex-shrink: 0; }
        .lmp-layer-info { flex: 1; min-width: 0; }
        .lmp-layer-name { display: block; font-size: 13px; font-weight: 500; color: var(--tx1); line-height: 1.3; }
        .lmp-layer-name.dk { color: rgba(255,255,255,.85); }
        .lmp-layer-desc { display: block; font-size: 11px; color: var(--tx3); line-height: 1.3; }
        .lmp-layer-desc.dk { color: rgba(255,255,255,.3); }

        /* Top-left controls */
        .lmp-tl-controls {
          position: absolute; top: 14px; left: 14px; z-index: 1000;
          display: flex; flex-direction: column; gap: 6px; align-items: flex-start;
        }
        .lmp-locate-pill {
          display: flex; align-items: center; gap: 6px; padding: 7px 11px;
          border-radius: var(--r-sm); border: 1.5px solid var(--brd);
          background: var(--srf); color: var(--tx2);
          font-family: 'DM Sans', sans-serif; font-size: 12.5px; font-weight: 500;
          cursor: pointer; box-shadow: var(--sh-sm); transition: all .14s; white-space: nowrap;
        }
        .lmp-locate-pill.dk {
          background: rgba(20,24,34,.85); border-color: rgba(255,255,255,.12);
          color: rgba(255,255,255,.65); backdrop-filter: blur(8px);
        }
        .lmp-locate-pill:hover {
          background: var(--blue-lt); color: var(--blue); border-color: var(--blue-md);
          box-shadow: var(--sh-md); transform: translateY(-1px);
        }
        .lmp-locate-pill.dk:hover { background: rgba(14,78,204,.3); color: #90B8FF; border-color: rgba(14,78,204,.4); }

        /* Hint */
        .lmp-hint { position: absolute; bottom: 14px; left: 14px; z-index: 1000; }
        .lmp-hint-pill {
          display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px;
          background: rgba(255,255,255,.9); backdrop-filter: blur(8px);
          border: 1px solid var(--brd); border-radius: 999px;
          font-size: 11.5px; color: var(--tx2); box-shadow: var(--sh-sm); font-weight: 500;
        }
        .lmp-hint-pill.dk {
          background: rgba(20,24,34,.8); border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.5);
        }
        .lmp-hint-dot {
          width: 6px; height: 6px; border-radius: 50%; background: var(--blue);
          flex-shrink: 0; animation: lmp-pulse 2s ease-in-out infinite;
        }

        /* Attribution */
        .lmp-attr {
          position: absolute; bottom: 14px; right: 14px; z-index: 1000;
          font-size: 10px; color: var(--tx3);
          background: rgba(255,255,255,.85); backdrop-filter: blur(6px);
          padding: 3px 7px; border-radius: 5px; border: 1px solid var(--brd);
        }
        .lmp-attr.dk {
          background: rgba(20,24,34,.8); border-color: rgba(255,255,255,.1); color: rgba(255,255,255,.3);
        }
        .lmp-attr a { color: inherit; text-decoration: none; }
        .lmp-attr a:hover { color: var(--blue); }

        /* ── FULLSCREEN OVERLAY ── */
        .lmp-fs-overlay {
          position: fixed; inset: 0; z-index: 9900;
          background: #0D1117; display: flex; flex-direction: column;
          animation: lmp-fsin .2s ease;
        }
        .lmp-fs-topbar {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 20px; border-bottom: 1px solid rgba(255,255,255,.07);
          background: #141822; flex-shrink: 0;
        }
        .lmp-fs-logo {
          width: 32px; height: 32px; border-radius: 8px; background: var(--blue);
          display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lmp-fs-title-wrap { flex-shrink: 0; }
        .lmp-fs-title { font-size: 14px; font-weight: 600; color: rgba(255,255,255,.9); margin: 0; line-height: 1.2; }
        .lmp-fs-subtitle { font-size: 11px; color: rgba(255,255,255,.3); font-weight: 400; }
        .lmp-fs-search-area { flex: 1; max-width: 520px; }
        .lmp-fs-close {
          display: flex; align-items: center; gap: 6px; padding: 8px 14px;
          border-radius: var(--r-sm); border: 1.5px solid rgba(255,255,255,.12);
          background: rgba(255,255,255,.06); color: rgba(255,255,255,.7);
          font-family: 'DM Sans', sans-serif; font-size: 13px; font-weight: 500;
          cursor: pointer; transition: all .14s; flex-shrink: 0; white-space: nowrap;
        }
        .lmp-fs-close:hover { background: rgba(255,255,255,.11); color: rgba(255,255,255,.95); border-color: rgba(255,255,255,.2); }
        .lmp-fs-maparea { flex: 1; position: relative; overflow: hidden; }
        .lmp-fs-statusbar {
          display: flex; align-items: center; gap: 14px; padding: 10px 20px;
          background: #141822; border-top: 1px solid rgba(255,255,255,.07);
          flex-shrink: 0; overflow: hidden;
        }
        .lmp-fs-stat { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .lmp-fs-stat-lbl {
          font-size: 10px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase;
          color: rgba(255,255,255,.25);
        }
        .lmp-fs-stat-val {
          font-family: 'DM Mono', monospace; font-size: 12px; font-weight: 500; color: rgba(255,255,255,.7);
        }
        .lmp-fs-sdiv { width: 1px; height: 16px; background: rgba(255,255,255,.08); flex-shrink: 0; }
        .lmp-fs-addr {
          display: flex; align-items: center; gap: 7px; flex: 1;
          min-width: 0; overflow: hidden;
        }
        .lmp-fs-addr-txt {
          font-size: 12.5px; color: rgba(255,255,255,.5); white-space: nowrap;
          overflow: hidden; text-overflow: ellipsis;
        }
        .lmp-fs-tile-badge {
          display: flex; align-items: center; gap: 5px; padding: 3px 10px;
          border-radius: 999px; background: rgba(255,255,255,.06);
          border: 1px solid rgba(255,255,255,.1);
          font-size: 11.5px; color: rgba(255,255,255,.4); white-space: nowrap; flex-shrink: 0;
        }

        /* ── ADDRESS CARD ── */
        .lmp-addr-card {
          display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
          background: var(--blue-lt); border: 1.5px solid var(--blue-md);
          border-radius: var(--r); animation: lmp-fdrop .2s ease;
        }
        .lmp-addr-icon {
          width: 30px; height: 30px; border-radius: 8px; background: var(--blue);
          color: white; display: flex; align-items: center; justify-content: center; flex-shrink: 0;
        }
        .lmp-addr-lbl {
          font-size: 10.5px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase;
          color: var(--blue); margin: 0 0 2px; opacity: .7;
        }
        .lmp-addr-txt { font-size: 13.5px; color: #1a2a5e; margin: 0; line-height: 1.5; font-weight: 400; }
        .lmp-addr-fetching {
          display: flex; align-items: center; gap: 7px; font-size: 13px;
          color: var(--blue); opacity: .7; font-weight: 500;
        }

        /* ── COORDS ── */
        .lmp-coords { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .lmp-coord-card {
          background: var(--srf2); border: 1.5px solid var(--brd);
          border-radius: var(--r); padding: 12px 14px; transition: border-color .15s;
        }
        .lmp-coord-card:hover { border-color: var(--blue-md); }
        .lmp-coord-lbl {
          font-size: 10.5px; font-weight: 600; letter-spacing: .07em; text-transform: uppercase;
          color: var(--tx3); margin: 0 0 4px;
        }
        .lmp-coord-val { font-family: 'DM Mono', monospace; font-size: 13px; font-weight: 500; color: var(--tx1); margin: 0; }

        /* ── ANIMATIONS ── */
        @keyframes lmp-spin { to { transform: rotate(360deg); } }
        @keyframes lmp-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.8)} }
        @keyframes lmp-fdrop { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes lmp-fslide { from{opacity:0;transform:translateX(6px)} to{opacity:1;transform:translateX(0)} }
        @keyframes lmp-fsin { from{opacity:0;transform:scale(.98)} to{opacity:1;transform:scale(1)} }

        /* ── LEAFLET ── */
        .leaflet-container { font-family: 'DM Sans', sans-serif; }
        .leaflet-attribution-flag, .leaflet-control-attribution { display: none !important; }
      `}</style>

      {/* ── Fullscreen overlay (portal) ── */}
      {isFullscreen &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="lmp-fs-overlay">
            <div className="lmp-fs-topbar">
              <div className="lmp-fs-logo">
                <MapPin size={16} color="white" />
              </div>
              <div className="lmp-fs-title-wrap">
                <p className="lmp-fs-title">Pilih Lokasi</p>
                <p className="lmp-fs-subtitle">
                  Layar Penuh — tekan Esc untuk keluar
                </p>
              </div>
              <div className="lmp-fs-search-area">
                <SearchBar refProp={fsSearchRef} fsStyle />
              </div>
              <button
                type="button"
                className="lmp-fs-close"
                onClick={() => setIsFullscreen(false)}
              >
                <Minimize2 size={14} />
                Tutup
              </button>
            </div>

            <div className="lmp-fs-maparea">
              {/* Map DOM will be moved here by useEffect */}
              <div ref={fsMapRef} style={{ height: "100%", width: "100%" }} />
              <MapOverlays dark={isDark} />
            </div>

            <div className="lmp-fs-statusbar">
              {latitude && longitude ? (
                <>
                  <div className="lmp-fs-stat">
                    <span className="lmp-fs-stat-lbl">Lat</span>
                    <span className="lmp-fs-stat-val">
                      {latitude.toFixed(8)}
                    </span>
                  </div>
                  <div className="lmp-fs-sdiv" />
                  <div className="lmp-fs-stat">
                    <span className="lmp-fs-stat-lbl">Lng</span>
                    <span className="lmp-fs-stat-val">
                      {longitude.toFixed(8)}
                    </span>
                  </div>
                  <div className="lmp-fs-sdiv" />
                  <div className="lmp-fs-stat">
                    <span className="lmp-fs-stat-lbl">Radius</span>
                    <span className="lmp-fs-stat-val">{radiusMeters}m</span>
                  </div>
                </>
              ) : (
                <span style={{ fontSize: 12, color: "rgba(255,255,255,.3)" }}>
                  Belum ada lokasi dipilih
                </span>
              )}
              {address && (
                <>
                  <div className="lmp-fs-sdiv" />
                  <div className="lmp-fs-addr">
                    <MapPin
                      size={12}
                      style={{ color: "var(--blue)", flexShrink: 0 }}
                    />
                    <span className="lmp-fs-addr-txt">
                      {fetchingAddress ? "Mengambil alamat..." : address}
                    </span>
                  </div>
                </>
              )}
              <div className="lmp-fs-tile-badge">
                {activeTile.preview} {activeTile.label}
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* ── Inline view ── */}
      <div className="lmp-root">
        <SearchBar refProp={inlineSearchRef} />

        <div className="lmp-map-wrap">
          {isLoading && (
            <div className="lmp-loading">
              <div className="lmp-loader-ring" />
              <span className="lmp-loading-txt">Memuat peta...</span>
            </div>
          )}
          {/* When not fullscreen, the leaflet container lives inside here */}
          <div ref={inlineMapRef} className="lmp-map-canvas" />
          <MapOverlays dark={isDark} />
        </div>

        {(address || fetchingAddress) && (
          <div className="lmp-addr-card">
            <div className="lmp-addr-icon">
              <MapPin size={14} />
            </div>
            <div>
              <p className="lmp-addr-lbl">Alamat Terdeteksi</p>
              {fetchingAddress ? (
                <span className="lmp-addr-fetching">
                  <Loader2
                    size={13}
                    style={{ animation: "lmp-spin .7s linear infinite" }}
                  />
                  Mengambil informasi alamat...
                </span>
              ) : (
                <p className="lmp-addr-txt">{address}</p>
              )}
            </div>
          </div>
        )}

        {latitude && longitude && (
          <div className="lmp-coords">
            <div className="lmp-coord-card">
              <p className="lmp-coord-lbl">Latitude</p>
              <p className="lmp-coord-val">{latitude.toFixed(8)}</p>
            </div>
            <div className="lmp-coord-card">
              <p className="lmp-coord-lbl">Longitude</p>
              <p className="lmp-coord-val">{longitude.toFixed(8)}</p>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
