import React from 'react';

interface SoundwaveProps {
  isActive: boolean;
  color?: string;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Soundwave: React.FC<SoundwaveProps> = ({
  isActive,
  color = 'bg-indigo-400',
  className = '',
  size = 'md',
}) => {
  const heights = {
    sm: ['h-2', 'h-4', 'h-3', 'h-5', 'h-2'],
    md: ['h-3', 'h-6', 'h-4', 'h-7', 'h-3'],
    lg: ['h-4', 'h-8', 'h-6', 'h-9', 'h-4'],
  };

  const currentHeights = heights[size];

  return (
    <div className={`flex items-center justify-center gap-1 h-8 ${className}`}>
      {currentHeights.map((_, i) => (
        <span
          key={i}
          className={`w-1 rounded-full transition-all duration-200 ${color} ${
            isActive ? `animate-soundwave-${(i % 4) + 1}` : 'h-1.5 opacity-40'
          }`}
          style={{
            animationDelay: isActive ? `${i * 0.15}s` : '0s',
          }}
        />
      ))}
    </div>
  );
};
