import React from 'react';
import { useStore } from '../../store/useStore';
import { Play, Square } from 'lucide-react';

export const StopStartScanButton: React.FC = () => {
  const {
    currentMode,
    selectedCoastalRegionId,
    scanningStatus,
    setScanningStatus,
  } = useStore();

  if (currentMode !== 'live' || !selectedCoastalRegionId) {
    return null;
  }

  const isScanning = scanningStatus === 'scanning';
  const isStopped = scanningStatus === 'stopped';

  const handleToggle = () => {
    if (isScanning) {
      setScanningStatus('stopped');
    } else {
      // Handle both 'idle' and 'stopped' states by starting scan
      setScanningStatus('scanning');
    }
  };

  return (
    <button
      onClick={handleToggle}
      className={`w-full py-2.5 px-3 rounded-[8px] font-mono text-[13px] font-bold flex items-center justify-center gap-2 transition-all ${
        isScanning
          ? 'bg-red-600 hover:bg-red-700 text-white shadow-lg'
          : 'bg-sky-600 hover:bg-sky-700 text-white shadow-lg'
      }`}
    >
      {isScanning ? (
        <>
          <Square className="w-4 h-4 fill-current" />
          <span>STOP SCAN</span>
        </>
      ) : (
        <>
          <Play className="w-4 h-4 fill-current" />
          <span>START SCAN</span>
        </>
      )}
    </button>
  );
};
