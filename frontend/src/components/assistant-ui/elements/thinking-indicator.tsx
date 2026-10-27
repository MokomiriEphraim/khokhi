import React, { useEffect, useState } from 'react';

export interface ThinkingIndicatorProps {
  label: string;
  elapsed?: string;
  className?: string;
}

export function useElapsedLabel(active: boolean): string | undefined {
  const [label, setLabel] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!active) {
      setLabel(undefined);
      return;
    }
    const start = Date.now();
    setLabel('0s');
    const id = setInterval(() => {
      setLabel(`${Math.round((Date.now() - start) / 1000)}s`);
    }, 1000);
    return () => clearInterval(id);
  }, [active]);

  return label;
}

export const ThinkingIndicator: React.FC<ThinkingIndicatorProps> = ({
  label,
  elapsed,
  className = '',
}) => {
  return (
    <div
      data-slot="thinking-indicator"
      className={`inline-flex items-center gap-2 text-neutral-500 text-xs transition-all duration-300 ${className}`}
    >
      <span className="relative flex h-2 w-2">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-neutral-400 opacity-60"></span>
        <span className="relative inline-flex rounded-full h-2 w-2 bg-neutral-800"></span>
      </span>

      <span key={label} className="font-normal text-neutral-600">
        {label}
      </span>

      {elapsed !== undefined && (
        <span className="font-mono text-[11px] text-neutral-400 tabular-nums">
          {elapsed}
        </span>
      )}
    </div>
  );
};
