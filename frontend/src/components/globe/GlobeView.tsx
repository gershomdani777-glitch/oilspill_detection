import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  geoOrthographic,
  geoPath,
  geoGraticule,
  GeoPermissibleObjects,
} from 'd3-geo';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import { CoastalRegion, MonitoredScene, SceneStatus } from '../../types';
import {
  RotateCw, ZoomIn, ZoomOut, Compass, ShieldAlert,
  X, AlertTriangle, Clock, Satellite, Globe2, ChevronRight,
} from 'lucide-react';
import { useStore } from '../../store/useStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface GlobeViewProps {
  regions: CoastalRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (regionId: string) => void;
  scenes: MonitoredScene[];
  activeDetectionCoords?: { lat: number; lon: number } | null;
}

type Rotation = [number, number, number]; // [lambda, phi, gamma]

// ─── Helpers ─────────────────────────────────────────────────────────────────

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// Lerp angle accounting for wrapping (shortest path)
const lerpAngle = (a: number, b: number, t: number) => {
  let diff = b - a;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return a + diff * t;
};

const SCENE_COLORS: Record<SceneStatus, { stroke: string; fill: string }> = {
  NOT_MONITORED:  { stroke: '#6b7280', fill: 'rgba(107,114,128,0.12)' },
  MONITORING:     { stroke: '#38bdf8', fill: 'rgba(56,189,248,0.18)' },
  NEW_ACQUISITION:{ stroke: '#eab308', fill: 'rgba(234,179,8,0.28)' },
  PROCESSING:     { stroke: '#f97316', fill: 'rgba(249,115,22,0.28)' },
  PROCESSED:      { stroke: '#22c55e', fill: 'rgba(34,197,94,0.22)' },
  SPILL_DETECTED: { stroke: '#ef4444', fill: 'rgba(239,68,68,0.38)' },
  ERROR:          { stroke: '#94a3b8', fill: 'rgba(148,163,184,0.15)' },
};

// ─── Spill Detail Popup ───────────────────────────────────────────────────────

interface SpillPopupProps {
  scene: MonitoredScene;
  regionName: string;
  onClose: () => void;
  onViewEvidence: () => void;
}

const SpillPopup: React.FC<SpillPopupProps> = ({ scene, regionName, onClose, onViewEvidence }) => (
  <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-50 w-[440px] max-w-[calc(100vw-32px)]
    bg-[#0d1117]/97 border border-red-500/60 rounded-xl shadow-2xl backdrop-blur-xl font-mono overflow-hidden">
    {/* Header */}
    <div className="flex items-center justify-between px-4 py-3 bg-red-500/15 border-b border-red-500/40">
      <div className="flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-red-400 font-bold text-[12px] tracking-wider uppercase">⚠ Oil Spill Detected</span>
      </div>
      <button onClick={onClose} className="p-1 rounded text-slate-500 hover:text-white transition-colors">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>

    {/* Body */}
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[#161b22] rounded-lg p-3 border border-slate-700/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Region</div>
          <div className="text-[12px] text-white font-semibold">{regionName}</div>
        </div>
        <div className="bg-[#161b22] rounded-lg p-3 border border-slate-700/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Orbit Track</div>
          <div className="text-[12px] text-white font-semibold">#{scene.relative_orbit} {scene.orbit_direction}</div>
        </div>
        <div className="bg-[#161b22] rounded-lg p-3 border border-slate-700/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Last Processed</div>
          <div className="text-[11px] text-sky-400">
            {scene.last_processed_timestamp
              ? new Date(scene.last_processed_timestamp).toLocaleString()
              : 'N/A'}
          </div>
        </div>
        <div className="bg-[#161b22] rounded-lg p-3 border border-slate-700/60">
          <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Detection ID</div>
          <div className="text-[11px] text-amber-400 truncate">
            {scene.latest_detection_id ? scene.latest_detection_id.slice(0, 16) + '…' : 'PENDING'}
          </div>
        </div>
      </div>

      <div className="bg-red-900/20 border border-red-500/30 rounded-lg px-3 py-2 text-[11px] text-red-300 leading-relaxed">
        Sentinel-1 SAR scene confirms dark slick anomaly exceeding ResNet-50 look-alike discrimination threshold.
        AIS vessel attribution analysis in progress.
      </div>

      <button
        onClick={onViewEvidence}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg
          bg-red-500 hover:bg-red-400 text-white font-bold text-[12px] tracking-wide
          transition-colors shadow-lg"
      >
        <ShieldAlert className="w-4 h-4" />
        View Evidence & Attribution
        <ChevronRight className="w-3.5 h-3.5" />
      </button>
    </div>
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────

const SVG_SIZE = 900;

export const GlobeView: React.FC<GlobeViewProps> = ({
  regions,
  selectedRegionId,
  onSelectRegion,
  scenes,
  activeDetectionCoords,
}) => {
  const { setIsEvidenceOpen } = useStore();

  // ── Globe state ──
  const [rotation, setRotation] = useState<Rotation>([55, -15, 0]);
  const [zoom, setZoom] = useState(1.0);
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoveredRegionId, setHoveredRegionId] = useState<string | null>(null);
  const [hoveredSceneId, setHoveredSceneId] = useState<string | null>(null);
  const [selectedScene, setSelectedScene] = useState<MonitoredScene | null>(null);
  const [pulseScale, setPulseScale] = useState(1);

  // ── World map data (loaded async) ──
  const [worldGeo, setWorldGeo] = useState<{
    land: GeoPermissibleObjects;
    countries: GeoPermissibleObjects;
  } | null>(null);

  // ── Drag state (via refs to avoid stale closures) ──
  const isDragging = useRef(false);
  const hasDragged = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const rotationRef = useRef<Rotation>([55, -15, 0]);
  const targetRotation = useRef<Rotation | null>(null);

  // ── Animation ──
  const animFrameRef = useRef<number | undefined>(undefined);
  const pulseFrameRef = useRef<number | undefined>(undefined);

  // Load world atlas from /public (avoids Rolldown module resolution issues)
  useEffect(() => {
    Promise.all([
      fetch('/land-110m.json').then((r) => r.json()),
      fetch('/countries-110m.json').then((r) => r.json()),
    ]).then(([landTopo, countriesTopo]) => {
      const land = feature(
        landTopo as Topology,
        (landTopo as Topology).objects.land as GeometryCollection
      );
      const countries = feature(
        countriesTopo as Topology,
        (countriesTopo as Topology).objects.countries as GeometryCollection
      );
      setWorldGeo({ land, countries });
    }).catch(console.error);
  }, []);

  // Sync rotationRef with state
  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  // Fly to selected region (smooth animated rotation)
  useEffect(() => {
    if (!selectedRegionId) return;
    const reg = regions.find((r) => r.id === selectedRegionId);
    if (!reg?.bbox) return;
    const [minLon, minLat, maxLon, maxLat] = reg.bbox;
    const cLon = (minLon + maxLon) / 2;
    const cLat = (minLat + maxLat) / 2;
    // D3 orthographic rotate convention: rotate([lambda, -phi])
    targetRotation.current = [-cLon, -cLat, 0];
    setAutoRotate(false);
  }, [selectedRegionId, regions]);

  // Main animation loop: auto-rotate + fly-to lerp
  useEffect(() => {
    const LERP_SPEED = 0.06;

    const tick = () => {
      let [l, p, g] = rotationRef.current;
      let changed = false;

      if (targetRotation.current) {
        const [tl, tp, tg] = targetRotation.current;
        const nl = lerpAngle(l, tl, LERP_SPEED);
        const np = lerpAngle(p, tp, LERP_SPEED);
        l = nl; p = np; g = tg;
        if (Math.abs(nl - tl) < 0.1 && Math.abs(np - tp) < 0.1) {
          targetRotation.current = null;
          l = tl; p = tp;
        }
        changed = true;
      } else if (autoRotate && !isDragging.current) {
        l = (l + 0.12) % 360;
        changed = true;
      }

      if (changed) {
        rotationRef.current = [l, p, g];
        setRotation([l, p, g]);
      }
      animFrameRef.current = requestAnimationFrame(tick);
    };

    animFrameRef.current = requestAnimationFrame(tick);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [autoRotate]);

  // Pulse animation for active beacon
  useEffect(() => {
    if (!activeDetectionCoords) return;
    let t = 0;
    const pulseTick = () => {
      t += 0.05;
      setPulseScale(1 + 0.6 * Math.abs(Math.sin(t)));
      pulseFrameRef.current = requestAnimationFrame(pulseTick);
    };
    pulseFrameRef.current = requestAnimationFrame(pulseTick);
    return () => { if (pulseFrameRef.current) cancelAnimationFrame(pulseFrameRef.current); };
  }, [activeDetectionCoords]);

  // ── D3 Projection ──
  const radius = SVG_SIZE * 0.38 * zoom;
  const cx = SVG_SIZE / 2;
  const cy = SVG_SIZE / 2;

  const projection = geoOrthographic()
    .scale(radius)
    .translate([cx, cy])
    .rotate(rotation)
    .clipAngle(90);

  const pathGen = geoPath(projection);
  const graticule = geoGraticule()();

  // Region centroid projected point (for label/beacon)
  const regionCenter = useCallback((reg: CoastalRegion) => {
    if (!reg.bbox) return null;
    const [minLon, minLat, maxLon, maxLat] = reg.bbox;
    return projection([(minLon + maxLon) / 2, (minLat + maxLat) / 2]);
  }, [projection]);

  // Build region GeoJSON bounding box polygon
  const regionPolygon = (reg: CoastalRegion): GeoPermissibleObjects | null => {
    if (!reg.bbox) return null;
    const [minLon, minLat, maxLon, maxLat] = reg.bbox;
    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [minLon, minLat], [maxLon, minLat],
          [maxLon, maxLat], [minLon, maxLat],
          [minLon, minLat],
        ]],
      },
      properties: {},
    } as GeoPermissibleObjects;
  };

  // Build scene GeoJSON footprint
  const sceneGeoJSON = (scene: MonitoredScene): GeoPermissibleObjects | null => {
    if (!scene.footprint?.coordinates) return null;
    const coords = scene.footprint.coordinates;
    // Detect MultiPolygon vs Polygon
    const isMulti = Array.isArray(coords[0][0][0]);
    return {
      type: 'Feature',
      geometry: {
        type: isMulti ? 'MultiPolygon' : 'Polygon',
        coordinates: coords,
      },
      properties: {},
    } as GeoPermissibleObjects;
  };

  // ── Drag event handlers ──
  // NOTE: Never add e.preventDefault() to handleMouseDown — browsers use it to
  // decide whether to fire subsequent click events. Calling preventDefault() here
  // silently suppresses all onClick handlers on child SVG elements (regions, scenes).
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    hasDragged.current = false;   // reset on each new press
    dragStart.current = { x: e.clientX, y: e.clientY };
    targetRotation.current = null;
    setAutoRotate(false);
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    if (!hasDragged.current && Math.hypot(dx, dy) < 5) return;
    hasDragged.current = true;

    dragStart.current = { x: e.clientX, y: e.clientY };

    const [l, p, g] = rotationRef.current;
    const sensitivity = 0.35;
    const nl = (l + dx * sensitivity) % 360;
    const np = Math.max(-80, Math.min(80, p - dy * sensitivity));
    rotationRef.current = [nl, np, g];
    setRotation([nl, np, g]);
  }, []);

  const handleMouseUp = () => { isDragging.current = false; };

  // Touch support
  const lastTouch = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    isDragging.current = true;
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    targetRotation.current = null;
    setAutoRotate(false);
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - lastTouch.current.x;
    const dy = e.touches[0].clientY - lastTouch.current.y;
    lastTouch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    const [l, p, g] = rotationRef.current;
    const nl = (l + dx * 0.35) % 360;
    const np = Math.max(-80, Math.min(80, p - dy * 0.35));
    rotationRef.current = [nl, np, g];
    setRotation([nl, np, g]);
  };

  // Find scene from click
  const handleSceneClick = (scene: MonitoredScene, e: React.MouseEvent) => {
    e.stopPropagation();
    if (scene.status === 'SPILL_DETECTED') {
      setSelectedScene(scene);
    }
  };

  const handleRegionClick = (reg: CoastalRegion, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectRegion(reg.id);
  };

  // Dismiss spill popup on globe background click
  const handleBackgroundClick = () => {
    setSelectedScene(null);
  };

  // Active detection projected point
  const detectionPt = activeDetectionCoords
    ? projection([activeDetectionCoords.lon, activeDetectionCoords.lat])
    : null;

  const selectedRegionData = regions.find((r) => r.id === selectedScene?.region_id);

  return (
    <div className="relative w-full h-full bg-[#030712] flex items-center justify-center overflow-hidden select-none">

      {/* ── SVG Globe ── */}
      <svg
        viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
        className="w-full h-full max-w-[95vh] max-h-[95vh] object-contain cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={() => { isDragging.current = false; }}
        onClick={handleBackgroundClick}
      >
        <defs>
          {/* Clip to sphere */}
          <clipPath id="globe-clip">
            <circle cx={cx} cy={cy} r={radius} />
          </clipPath>
          {/* Atmosphere glow filter */}
          <radialGradient id="atm-glow" cx="50%" cy="50%">
            <stop offset="75%" stopColor="#0ea5e9" stopOpacity="0" />
            <stop offset="90%" stopColor="#0ea5e9" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </radialGradient>
          {/* Ocean gradient */}
          <radialGradient id="ocean-grad" cx="35%" cy="35%">
            <stop offset="0%"   stopColor="#0f2240" />
            <stop offset="60%"  stopColor="#071526" />
            <stop offset="100%" stopColor="#030a14" />
          </radialGradient>
          {/* Spill glow */}
          <filter id="spill-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          {/* Region glow */}
          <filter id="region-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Atmosphere halo ring */}
        <circle cx={cx} cy={cy} r={radius * 1.05} fill="url(#atm-glow)" />

        {/* Outer glow ring */}
        <circle cx={cx} cy={cy} r={radius + 2} fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeOpacity="0.4" />

        {/* Ocean base */}
        <circle cx={cx} cy={cy} r={radius} fill="url(#ocean-grad)" clipPath="url(#globe-clip)" />

        {/* Land masses (world-atlas) */}
        {worldGeo && (
          <g clipPath="url(#globe-clip)">
            {/* Land */}
            <path
              d={pathGen(worldGeo.land) || ''}
              fill="#1a3a2a"
              stroke="#2d5c40"
              strokeWidth="0.6"
            />
            {/* Country borders */}
            <path
              d={pathGen(worldGeo.countries) || ''}
              fill="none"
              stroke="#2a4a38"
              strokeWidth="0.4"
              strokeOpacity="0.7"
            />
          </g>
        )}

        {/* Graticule grid */}
        <path
          d={pathGen(graticule) || ''}
          fill="none"
          stroke="#94a3b8"
          strokeWidth="0.5"
          strokeOpacity="0.12"
          clipPath="url(#globe-clip)"
        />

        {/* Terminator shade (simulated dark side on edges) */}
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="#0a0f1a"
          strokeWidth="18"
          strokeOpacity="0.5"
          clipPath="url(#globe-clip)"
        />

        {/* ── Scene Footprints ── */}
        {scenes.map((scene) => {
          const geo = sceneGeoJSON(scene);
          if (!geo) return null;
          const pathStr = pathGen(geo);
          if (!pathStr) return null;
          const colors = SCENE_COLORS[scene.status] ?? SCENE_COLORS.MONITORING;
          const isSpill = scene.status === 'SPILL_DETECTED';
          const isHovered = scene.id === hoveredSceneId;

          return (
            <path
              key={scene.id}
              d={pathStr}
              fill={colors.fill}
              stroke={colors.stroke}
              strokeWidth={isSpill ? 2.5 : (isHovered ? 2 : 1.5)}
              strokeOpacity={isHovered ? 1 : 0.85}
              clipPath="url(#globe-clip)"
              cursor={isSpill ? 'pointer' : 'default'}
              filter={isSpill ? 'url(#spill-glow)' : undefined}
              onClick={(e) => handleSceneClick(scene, e)}
              onMouseEnter={() => setHoveredSceneId(scene.id)}
              onMouseLeave={() => setHoveredSceneId(null)}
              className={isSpill ? 'animate-pulse' : ''}
            />
          );
        })}

        {/* ── Coastal Region Overlays ── */}
        {regions.map((reg) => {
          const geo = regionPolygon(reg);
          if (!geo) return null;
          const pathStr = pathGen(geo);
          if (!pathStr) return null;
          const isSelected = reg.id === selectedRegionId;
          const isHovered = reg.id === hoveredRegionId;
          const isActive = reg.monitoring_state === 'ACTIVE';
          const isPaused = reg.monitoring_state === 'PAUSED';

          let stroke = '#64748b';
          let fill = 'rgba(100,116,139,0.12)';
          if (isSelected) { stroke = '#38bdf8'; fill = 'rgba(56,189,248,0.28)'; }
          else if (isActive) { stroke = '#22c55e'; fill = 'rgba(34,197,94,0.2)'; }
          else if (isPaused) { stroke = '#eab308'; fill = 'rgba(234,179,8,0.18)'; }

          const cPt = regionCenter(reg);

          return (
            <g
              key={reg.id}
              clipPath="url(#globe-clip)"
              cursor="pointer"
              onClick={(e) => handleRegionClick(reg, e)}
              onMouseEnter={() => setHoveredRegionId(reg.id)}
              onMouseLeave={() => setHoveredRegionId(null)}
              filter={isSelected || isHovered ? 'url(#region-glow)' : undefined}
            >
              <path
                d={pathStr}
                fill={fill}
                stroke={stroke}
                strokeWidth={isSelected ? 2.5 : (isHovered ? 2 : 1.5)}
                strokeDasharray={isActive ? undefined : (isPaused ? '6,3' : undefined)}
              />
              {/* Centroid beacon */}
              {cPt && (
                <>
                  {/* Outer ring pulse */}
                  {(isSelected || isActive) && (
                    <circle
                      cx={cPt[0]} cy={cPt[1]}
                      r={isSelected ? 12 : 9}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="1"
                      strokeOpacity="0.4"
                    />
                  )}
                  <circle
                    cx={cPt[0]} cy={cPt[1]}
                    r={isSelected ? 6 : 4}
                    fill={isActive ? '#22c55e' : (isSelected ? '#38bdf8' : '#e2e8f0')}
                    stroke="#000"
                    strokeWidth="1"
                  />
                  {/* Region name label */}
                  <text
                    x={cPt[0]}
                    y={cPt[1] - 14}
                    textAnchor="middle"
                    fill={isSelected ? '#fff' : '#cbd5e1'}
                    fontSize={isSelected ? '11' : '10'}
                    fontWeight={isSelected ? 'bold' : 'normal'}
                    fontFamily="monospace"
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {reg.name.split(' (')[0]}
                  </text>
                  {/* "Click to monitor" hint on hover */}
                  {isHovered && !isSelected && (
                    <text
                      x={cPt[0]}
                      y={cPt[1] + 22}
                      textAnchor="middle"
                      fill="#94a3b8"
                      fontSize="9"
                      fontFamily="monospace"
                      style={{ pointerEvents: 'none', userSelect: 'none' }}
                    >
                      click to select
                    </text>
                  )}
                </>
              )}
            </g>
          );
        })}

        {/* ── Active Spill Detection Beacon ── */}
        {detectionPt && (
          <g filter="url(#spill-glow)" clipPath="url(#globe-clip)">
            {/* Pulsing outer ring */}
            <circle
              cx={detectionPt[0]} cy={detectionPt[1]}
              r={16 * pulseScale}
              fill="rgba(239,68,68,0.15)"
              stroke="#ef4444"
              strokeWidth="1"
              strokeOpacity={1.5 - pulseScale}
            />
            <circle
              cx={detectionPt[0]} cy={detectionPt[1]}
              r={10}
              fill="rgba(239,68,68,0.4)"
            />
            <circle
              cx={detectionPt[0]} cy={detectionPt[1]}
              r={5}
              fill="#ef4444"
              stroke="#fff"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {/* ── Status Legend ── */}
      <div className="absolute top-4 left-4 p-3 rounded-xl bg-black/70 border border-slate-700/60
        backdrop-blur-md font-mono text-[10px] space-y-1.5 shadow-xl pointer-events-auto">
        <div className="text-white font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5 text-[11px]">
          <ShieldAlert className="w-3.5 h-3.5 text-sky-400" />
          <span>Scene Status</span>
        </div>
        {([
          ['#475569', 'Not Monitored'],
          ['#38bdf8', 'Active Monitoring'],
          ['#eab308', 'New Acquisition'],
          ['#f97316', 'Processing'],
          ['#22c55e', 'Clean (Processed)'],
          ['#ef4444', '⚠ Spill Detected'],
        ] as const).map(([color, label]) => (
          <div key={label} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
            <span className={label.startsWith('⚠') ? 'text-red-400 font-bold' : 'text-slate-400'}>{label}</span>
          </div>
        ))}
      </div>

      {/* ── Globe Controls ── */}
      <div className="absolute bottom-4 left-4 flex items-center gap-1.5
        bg-black/70 border border-slate-700/60 rounded-xl p-1.5 shadow-xl backdrop-blur-md font-mono text-[11px] pointer-events-auto">
        <button
          onClick={() => { setAutoRotate((a) => !a); targetRotation.current = null; }}
          title="Toggle Auto-Rotate"
          className={`p-2 rounded-lg flex items-center gap-1.5 transition-all ${
            autoRotate
              ? 'bg-sky-500/20 text-sky-400 border border-sky-500/30'
              : 'text-slate-400 hover:text-white hover:bg-white/10'
          }`}
        >
          <RotateCw className={`w-3.5 h-3.5 ${autoRotate ? 'animate-spin' : ''}`} />
          <span>Rotate</span>
        </button>

        <div className="w-px h-5 bg-slate-700" />

        <button
          onClick={() => setZoom((z) => Math.min(2.2, z + 0.2))}
          title="Zoom In"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
          title="Zoom Out"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </button>

        <div className="w-px h-5 bg-slate-700" />

        <button
          onClick={() => {
            setRotation([55, -15, 0]);
            rotationRef.current = [55, -15, 0];
            targetRotation.current = null;
            setZoom(1.0);
            setAutoRotate(true);
          }}
          title="Reset View"
          className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
        >
          <Compass className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* ── Region selector hint (when no region selected) ── */}
      {!selectedRegionId && regions.length > 0 && (
        <div className="absolute bottom-4 right-4 flex items-center gap-2
          bg-black/60 border border-sky-500/30 rounded-xl px-3 py-2 pointer-events-none
          font-mono text-[11px] text-sky-400 backdrop-blur-md animate-pulse">
          <Globe2 className="w-3.5 h-3.5" />
          <span>Click a region on the globe to monitor it</span>
        </div>
      )}

      {/* ── Spill Detail Popup ── */}
      {selectedScene && (
        <SpillPopup
          scene={selectedScene}
          regionName={selectedRegionData?.name ?? selectedScene.region_id}
          onClose={() => setSelectedScene(null)}
          onViewEvidence={() => {
            setSelectedScene(null);
            setIsEvidenceOpen(true);
          }}
        />
      )}
    </div>
  );
};
