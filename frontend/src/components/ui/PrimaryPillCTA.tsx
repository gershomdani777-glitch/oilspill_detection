import React from 'react';

interface PrimaryPillCTAProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export const PrimaryPillCTA: React.FC<PrimaryPillCTAProps> = ({
  children,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  return (
    <button
      {...props}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 px-5 py-2 text-[14px] font-medium text-true-black bg-bone-white rounded-[9999px] shadow-pill select-none transition-opacity ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'active:opacity-90 hover:opacity-95'
      } ${className}`}
    >
      {icon && <span className="text-current">{icon}</span>}
      {children}
    </button>
  );
};