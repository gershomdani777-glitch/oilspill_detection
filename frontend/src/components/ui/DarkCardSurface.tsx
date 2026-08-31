import React from 'react';

interface DarkCardSurfaceProps {
  children: React.ReactNode;
  className?: string;
  padding?: string;
}

export const DarkCardSurface: React.FC<DarkCardSurfaceProps> = ({
  children,
  className = '',
  padding = 'p-6',
}) => {
  return (
    <div
      className={`bg-console-charcoal border border-wire-gray rounded-[12px] ${padding} ${className}`}
    >
      {children}
    </div>
  );
};