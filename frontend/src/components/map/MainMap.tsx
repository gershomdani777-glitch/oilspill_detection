import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, Polygon, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { useStore } from '../../store/useStore';
import { SpillLayer } from './SpillLayer';
import { VesselLayer } from './VesselLayer';
import { DriftLayer } from './DriftLayer';
import { MapLegend } from './MapLegend';
import { MapDrawToolbar } from './MapDrawToolbar';
import { api } from '../../services/api';

const STADIA_API_KEY =
  'eyJhbGciOiJIUzI1NiJ9.eyJhIjoiYWNfYTQ3dnE4NmsiLCJqdGkiOiIzZDlmODg1MSJ9.O_ob_pZiyhgyS2uuJ83T3HhHQjxOPjnMWRvhkTkBlBo';

interface BaseLayerConfig {
  id: string;
  name: string;
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

const BASE_LAYERS: BaseLayerConfig[] = [
  {
    id: 'stadia_dark',
    name: 'Stadia Dark',
    url: `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=${STADIA_API_KEY}`,
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; OSM',
    maxZoom: 20,
  },
  {
    id: 'stadia_satellite',
    name: 'Stadia Satellite',
    url: `https://tiles.stadiamaps.com/tiles/alidade_satellite/{z}/{x}/{y}{r}.jpg?api_key=${STADIA_API_KEY}`,
    attribution:
      '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; OpenMapTiles &copy; OSM',
    maxZoom: 20,
  },
  {
    id: 'carto_dark',
    name: 'Carto Dark',
    url: 'https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}.png',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19,
    subdomains: ['a', 'b', 'c', 'd'],
  },
  {
    id: 'esri_ocean',
    name: 'ESRI Ocean',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Ocean/World_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri &mdash; Sources: GEBCO, NOAA, CHS',
    maxZoom: 16,
  },
];

// ------------------------------------------------------------
// Drag-to-draw bounding box controller
// Uses refs (NOT state) for startPoint so the mouseup/mousemove
// closures always read the latest value without stale captures.
// ------------------------------------------------------------
const DrawController: React.FC<{
  isDrawing: boolean;
  onDrawComplete: () => void;
}> = ({ isDrawing, onDrawComplete }) => {
  const map = useMap();
  const { setSelectedRegion, setRegionError, setActiveDetection, setActiveVesselsData, setCleanSceneResult } = useStore();

  // Refs keep the latest values without triggering re-renders inside event handlers
  const startLatLng = useRef<L.LatLng | null>(null);
  const isDragging = useRef(false);

  // Visual preview rectangle layer (plain Leaflet, no React-Leaflet)
  const rectLayer = useRef<L.Rectangle | null>(null);

  // Enable / disable map interaction when drawing mode toggles
  useEffect(() => {
    const container = map.getContainer();
    if (isDrawing) {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      container.style.cursor = 'crosshair';
    } else {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      container.style.cursor = '';
      // Clean up any dangling preview
      if (rectLayer.current) {
        rectLayer.current.remove();
        rectLayer.current = null;
      }
      startLatLng.current = null;
      isDragging.current = false;
    }
  }, [isDrawing, map]);

  useMapEvents({
    mousedown(e) {
      if (!isDrawing) return;
      startLatLng.current = e.latlng;
      isDragging.current = true;
    },

    mousemove(e) {
      if (!isDrawing || !isDragging.current || !startLatLng.current) return;
      const bounds = L.latLngBounds(startLatLng.current, e.latlng);
      if (rectLayer.current) {
        rectLayer.current.setBounds(bounds);
      } else {
        rectLayer.current = L.rectangle(bounds, {
          color: '#fafafa',
          weight: 2,
          dashArray: '4 4',
          fillColor: '#fafafa',
          fillOpacity: 0.12,
          interactive: false,
        }).addTo(map);
      }
    },

    async mouseup(e) {
      if (!isDrawing || !isDragging.current || !startLatLng.current) return;

      const start = startLatLng.current;
      isDragging.current = false;
      startLatLng.current = null;

      // Remove preview rect
      if (rectLayer.current) {
        rectLayer.current.remove();
        rectLayer.current = null;
      }

      const minLat = Math.min(start.lat, e.latlng.lat);
      const maxLat = Math.max(start.lat, e.latlng.lat);
      const minLng = Math.min(start.lng, e.latlng.lng);
      const maxLng = Math.max(start.lng, e.latlng.lng);

      // Ignore accidental tiny clicks
      if (maxLat - minLat < 0.005 || maxLng - minLng < 0.005) {
        onDrawComplete();
        return;
      }

      const geometry = {
        type: 'Polygon',
        coordinates: [
          [
            [minLng, minLat],
            [maxLng, minLat],
            [maxLng, maxLat],
            [minLng, maxLat],
            [minLng, minLat],
          ],
        ],
      };

      try {
        setActiveDetection(null);
        setCleanSceneResult(null);
        setActiveVesselsData([], null as any);

        const res = await api.selectRegion(geometry);
        setSelectedRegion({
          region_id: res.region_id,
          geometry,
          bbox: res.bbox,
          area_sq_km: res.area_sq_km,
        });
        setRegionError(null);
      } catch (err: any) {
        setRegionError(err.message || 'Region validation failed. Try a smaller area.');
      }

      onDrawComplete();
    },
  });

  return null;
};

// Auto-pan / fly-to when region or detection changes
const MapViewController: React.FC = () => {
  const map = useMap();
  const { currentMode, selectedRegion, activeDetection, replayTimeline, currentReplayStepIndex } =
    useStore();

  useEffect(() => {
    if (currentMode === 'live') {
      if (activeDetection?.centroid) {
        map.flyTo([activeDetection.centroid.lat, activeDetection.centroid.lon], 11, {
          duration: 1.5,
        });
      } else if (selectedRegion?.bbox) {
        const [min_lon, min_lat, max_lon, max_lat] = selectedRegion.bbox;
        map.fitBounds(
          [
            [min_lat, min_lon],
            [max_lat, max_lon],
          ],
          { padding: [50, 50] }
        );
      }
    } else if (currentMode === 'historical' && replayTimeline) {
      const step = replayTimeline.timeline[currentReplayStepIndex];
      if (step?.vessel_positions?.[0]) {
        const v = step.vessel_positions[0];
        map.setView([v.lat, v.lon], 11);
      }
    }
  }, [selectedRegion, activeDetection, currentMode, replayTimeline, currentReplayStepIndex, map]);

  return null;
};

// Root map component
export const MainMap: React.FC = () => {
  const {
    currentMode,
    selectedRegion,
    activeDetection,
    activeVessels,
    driftTrajectory,
    showDrift,
    replayTimeline,
    currentReplayStepIndex,
  } = useStore();

  const [activeLayerId, setActiveLayerId] = useState<string>('stadia_dark');
  const [isDrawingMode, setIsDrawingMode] = useState<boolean>(false);

  const activeLayer = BASE_LAYERS.find((l) => l.id === activeLayerId) || BASE_LAYERS[0];

  const regionCoords = selectedRegion?.geometry?.coordinates?.[0]?.map(
    ([lon, lat]: [number, number]) => [lat, lon] as [number, number]
  );

  const currentHistoricalStep = replayTimeline?.timeline?.[currentReplayStepIndex];

  return (
    <div className="relative w-full h-[calc(100vh-56px)] bg-nav-ink overflow-hidden">
      <MapContainer
        center={[-20.44, 57.74]}
        zoom={5}
        scrollWheelZoom={true}
        zoomControl={false}
        className="w-full h-full"
      >
        {/* Base tile layer — key forces remount on layer switch */}
        <TileLayer
          key={activeLayer.id}
          url={activeLayer.url}
          attribution={activeLayer.attribution}
          maxZoom={activeLayer.maxZoom}
          subdomains={activeLayer.subdomains || 'abc'}
        />

        <MapViewController />

        {/* Drag-draw bounding box in live mode */}
        {currentMode === 'live' && (
          <DrawController
            isDrawing={isDrawingMode}
            onDrawComplete={() => setIsDrawingMode(false)}
          />
        )}

        {/* Confirmed region bounding box preview */}
        {currentMode === 'live' && regionCoords && !activeDetection && (
          <Polygon
            positions={regionCoords}
            pathOptions={{
              color: '#fafafa',
              dashArray: '5 5',
              weight: 2,
              fillColor: '#fafafa',
              fillOpacity: 0.1,
            }}
          />
        )}

        {/* Live scan data layers */}
        {currentMode === 'live' && (
          <>
            <SpillLayer detection={activeDetection} />
            <VesselLayer vessels={activeVessels} />
            <DriftLayer driftTrajectory={driftTrajectory} visible={showDrift} />
          </>
        )}

        {/* Historical replay data layers */}
        {currentMode === 'historical' && currentHistoricalStep && (
          <>
            <SpillLayer detection={null} historicalSpillState={currentHistoricalStep.spill_state} />
            <VesselLayer vessels={[]} historicalVessels={currentHistoricalStep.vessel_positions} />
          </>
        )}
      </MapContainer>

      {/* Layer switcher — top right */}
      <div className="absolute top-6 right-6 z-[400] flex items-center bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[8px] p-1 gap-1 text-[11px] font-mono">
        {BASE_LAYERS.map((layer) => (
          <button
            key={layer.id}
            onClick={() => setActiveLayerId(layer.id)}
            className={`px-2.5 py-1 rounded-[4px] transition-colors ${
              activeLayerId === layer.id
                ? 'bg-bone-white text-nav-ink font-bold'
                : 'text-mute-gray hover:text-off-white hover:bg-recess-black/50'
            }`}
          >
            {layer.name}
          </button>
        ))}
      </div>

      {/* Drawing toolbar (left panel) and legend */}
      <MapDrawToolbar isDrawingMode={isDrawingMode} setIsDrawingMode={setIsDrawingMode} />
      <MapLegend />
    </div>
  );
};