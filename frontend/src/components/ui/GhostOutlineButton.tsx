import React from 'react';

interface GhostOutlineButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
  active?: boolean;
}

export const GhostOutlineButton: React.FC<GhostOutlineButtonProps> = ({
  children,
  icon,
  className = '',
  active = false,
  ...props
}) => {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 px-4 py-1.5 text-[13px] font-medium rounded-[9999px] border transition-colors select-none ${
        active
          ? 'bg-bone-white text-nav-ink border-bone-white'
          : 'bg-transparent text-bone-white border-wire-gray hover:border-mute-gray'
      } ${className}`}
    >
      {icon && <span className="text-current">{icon}</span>}
      {children}
    </button>
  );
};