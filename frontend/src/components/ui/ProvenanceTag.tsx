import React from 'react';
import { ProvenanceType } from '../../types';

interface ProvenanceTagProps {
  provenance: ProvenanceType | string;
  className?: string;
}

export const ProvenanceTag: React.FC<ProvenanceTagProps> = ({ provenance, className = '' }) => {
  const isDemo =
    provenance === 'demo_reconstruction' ||
    provenance === 'demo_data' ||
    provenance === 'model_reconstruction';

  const label =
    provenance === 'live_satellite'
      ? 'Live Satellite'
      : provenance === 'documented_fact'
      ? 'Documented Fact'
      : provenance === 'historical_record'
      ? 'Historical Archive'
      : 'Demo / Reconstruction';

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-sans font-medium rounded-[4px] bg-transparent text-mute-gray ${
        isDemo ? 'border border-dashed border-wire-gray' : 'border border-solid border-wire-gray'
      } ${className}`}
    >
      {label}
    </span>
  );
};