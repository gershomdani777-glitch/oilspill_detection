import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

interface AnnouncementStripProps {
  message: string;
  variant?: 'notice' | 'demo' | 'delay';
}

export const AnnouncementStrip: React.FC<AnnouncementStripProps> = ({
  message,
  variant = 'notice',
}) => {
  return (
    <div className="w-full bg-[#0b0b0c] border-b border-console-charcoal py-1.5 px-4 flex items-center justify-center gap-2 text-[12px] font-sans text-mute-gray select-none">
      {variant === 'demo' ? (
        <AlertTriangle className="w-3.5 h-3.5 text-mute-gray flex-shrink-0 stroke-[1.5]" />
      ) : (
        <Info className="w-3.5 h-3.5 text-mute-gray flex-shrink-0 stroke-[1.5]" />
      )}
      <span>{message}</span>
    </div>
  );
};