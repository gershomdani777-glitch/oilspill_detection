import React from 'react';

interface AuroraBarProps {
  width?: string;
  className?: string;
}

export const AuroraBar: React.FC<AuroraBarProps> = ({ width = 'w-16', className = '' }) => {
  return (
    <div
      className={`h-[8px] rounded-[2px] ${width} ${className}`}
      style={{
        background: 'linear-gradient(90deg, #f6d1ac 0%, #f3b5d2 25%, #c7b8f5 50%, #a7eadc 75%, #afcdf6 100%)',
      }}
    />
  );
};