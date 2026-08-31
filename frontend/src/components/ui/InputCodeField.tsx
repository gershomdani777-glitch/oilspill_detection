import React from 'react';

interface InputCodeFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const InputCodeField: React.FC<InputCodeFieldProps> = ({
  label,
  className = '',
  ...props
}) => {
  return (
    <div className="flex flex-col gap-1 w-full">
      {label && <label className="text-[12px] text-mute-gray font-mono uppercase tracking-wider">{label}</label>}
      <input
        {...props}
        className={`bg-recess-black border border-wire-gray focus:border-bone-white rounded-[4px] px-3 py-2 text-[13px] font-mono text-bone-white outline-none placeholder:text-smoke transition-colors ${className}`}
      />
    </div>
  );
};