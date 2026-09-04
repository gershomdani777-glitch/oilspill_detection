import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import { api } from '../../services/api';
import { Crosshair, ChevronDown, Loader, AlertCircle } from 'lucide-react';
import { CoastalRegion } from '../../types';

export const CoastalRegionDropdown: React.FC = () => {
  const {
    currentMode,
    coastalRegions,
    setCoastalRegions,
    selectedCoastalRegionId,
    setSelectedCoastalRegionId,
    scanningStatus,
    scanningCycleCount,
    setDetectionFeed,
    setScanningCycleCount,
    setScanningStatus,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(coastalRegions.length === 0);
  const [error, setError] = useState<string | null>(null);

  // Fetch coastal regions on mount if not already loaded
  useEffect(() => {
    if (currentMode !== 'live' || coastalRegions.length > 0) return;

    const fetchRegions = async () => {
      try {
        setLoading(true);
        setError(null);
        const regions = await api.getCoastalRegions();
        setCoastalRegions(regions);
      } catch (err: any) {
        setError(err.message || 'Failed to load coastal regions');
        console.error('Error fetching regions:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchRegions();
  }, [currentMode, coastalRegions.length, setCoastalRegions]);

  if (currentMode !== 'live') return null;

  const selectedRegion = coastalRegions.find((r) => r.id === selectedCoastalRegionId);

  const filteredRegions = coastalRegions.filter((region) =>
    region.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    region.country_scope?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectRegion = (region: CoastalRegion) => {
    setSelectedCoastalRegionId(region.id);
    setIsOpen(false);
    setSearchTerm('');
    setDetectionFeed([]); // Clear previous feed when switching regions
    setScanningCycleCount(0);
    
    // Auto-start scanning when region is selected
    setScanningStatus('scanning');
  };

  return (
    <div className="absolute top-6 left-6 z-[400] flex flex-col gap-2 max-w-[360px]">
      <div className="bg-console-charcoal/95 backdrop-blur-md border border-wire-gray rounded-[12px] p-3.5 shadow-none flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crosshair className="w-4 h-4 text-bone-white stroke-[1.5]" />
            <span className="text-[13px] font-semibold text-bone-white tracking-tight">
              Coastal Region Monitor
            </span>
          </div>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-[4px] bg-recess-black text-mute-gray border border-wire-gray">
            FR-01 CONTINUOUS
          </span>
        </div>

        {/* Dropdown Select */}
        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            disabled={loading}
            className="w-full flex items-center justify-between px-3 py-2 rounded-[6px] border border-wire-gray bg-recess-black text-bone-white text-[12px] hover:border-bone-white transition-colors disabled:opacity-50"
          >
            <span className="truncate">
              {loading ? 'Loading regions...' : selectedRegion?.name || 'Select a coastal region...'}
            </span>
            <ChevronDown className="w-4 h-4 flex-shrink-0" />
          </button>

          {/* Dropdown Menu */}
          {isOpen && !loading && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-console-charcoal border border-wire-gray rounded-[6px] shadow-lg z-50">
              {/* Search Input */}
              <div className="p-2 border-b border-wire-gray/40">
                <input
                  type="text"
                  placeholder="Search regions..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-2 py-1.5 text-[12px] bg-recess-black border border-wire-gray rounded-[4px] text-bone-white placeholder-mute-gray focus:outline-none focus:border-bone-white"
                  autoFocus
                />
              </div>

              {/* Regions List */}
              <div className="max-h-[280px] overflow-y-auto">
                {filteredRegions.length > 0 ? (
                  filteredRegions.map((region) => (
                    <button
                      key={region.id}
                      onClick={() => handleSelectRegion(region)}
                      className="w-full text-left px-3 py-2 text-[12px] hover:bg-sky-500/20 transition-colors border-b border-wire-gray/20 last:border-b-0 text-bone-white"
                    >
                      <div className="font-medium">{region.name}</div>
                      <div className="text-[11px] text-mute-gray">{region.country_scope}</div>
                    </button>
                  ))
                ) : (
                  <div className="px-3 py-2 text-[12px] text-mute-gray text-center">
                    No regions found
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Scanning Status */}
        {selectedRegion && (
          <div className="pt-2 border-t border-wire-gray/40 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {scanningStatus === 'scanning' && (
                <>
                  <div className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                  <span className="text-[12px] font-mono text-sky-400">
                    Scanning {selectedRegion.name}...
                  </span>
                </>
              )}
              {scanningStatus === 'stopped' && (
                <span className="text-[12px] font-mono text-amber-500">
                  Scan paused
                </span>
              )}
              {scanningStatus === 'idle' && (
                <span className="text-[12px] font-mono text-mute-gray">
                  Ready to scan
                </span>
              )}
            </div>

            {scanningStatus === 'scanning' && (
              <div className="text-[11px] font-mono text-mute-gray">
                Cycle: {scanningCycleCount} | Scanning every 8s
              </div>
            )}

            {/* Region Stats */}
            <div className="flex justify-between text-[11px] font-mono text-mute-gray">
              <div>
                <div className="text-bone-white">{selectedRegion.area_sq_km?.toFixed(1)} km²</div>
              </div>
              <div className="text-right">
                <div className="text-bone-white">{selectedRegion.active_spills_count} active spills</div>
              </div>
            </div>
          </div>
        )}

        {/* Error Banner */}
        {error && (
          <div className="p-2 rounded-[4px] bg-recess-black border border-wire-gray/40 flex items-start gap-2">
            <AlertCircle className="w-3.5 h-3.5 text-off-white flex-shrink-0 mt-0.5" />
            <span className="text-[11px] text-off-white">{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};
