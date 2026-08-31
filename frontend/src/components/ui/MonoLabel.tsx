import React from 'react';

interface MonoLabelProps {
  children: React.ReactNode;
  className?: string;
}

export const MonoLabel: React.FC<MonoLabelProps> = ({ children, className = '' }) => {
  return (
    <span className={`font-mono text-[13px] text-mute-gray tracking-tight ${className}`}>
      {children}
    </span>
  );
};