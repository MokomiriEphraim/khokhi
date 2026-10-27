import React, { useState, useEffect } from 'react';
import { MousePointer2, Play, Pause, RotateCcw, ChevronRight } from 'lucide-react';

export interface ComputerStep {
  action: string;
  target: string;
  x: number; // percentage 0 - 100
  y: number; // percentage 0 - 100
  instruction?: string;
}

export interface ComputerUseProps {
  title?: string;
  steps: ComputerStep[];
  autoPlay?: boolean;
  loop?: boolean;
  children: React.ReactNode;
  className?: string;
  onStepComplete?: (stepIndex: number) => void;
}

/**
 * Computer Use component matching assistant-ui elements 30/151 specification:
 * - Browser/app chrome frame with traffic-light dots and title
 * - Cursor that moves to each action with a fading trail behind it
 * - Live action footer displaying action name, target element, and step n/total
 */
export const ComputerUse: React.FC<ComputerUseProps> = ({
  title = 'Microsoft Excel — Data Cleaning Guide',
  steps = [],
  autoPlay = true,
  loop = true,
  children,
  className = '',
  onStepComplete,
}) => {
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(autoPlay);

  const clampedIndex = steps.length > 0 ? Math.max(0, Math.min(activeIndex, steps.length - 1)) : 0;
  const currentStep = steps[clampedIndex];

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || steps.length <= 1) return;

    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = prev + 1;
        if (next >= steps.length) {
          if (loop) return 0;
          setIsPlaying(false);
          return prev;
        }
        onStepComplete?.(next);
        return next;
      });
    }, 2400);

    return () => clearInterval(timer);
  }, [isPlaying, steps.length, loop, onStepComplete]);

  // Trail: Up to 2 previous steps before active step
  const trailSteps = steps.slice(Math.max(0, clampedIndex - 2), clampedIndex);

  return (
    <div
      data-slot="computer-use"
      className={`relative overflow-hidden rounded-2xl border border-neutral-300 bg-white shadow-md flex flex-col ${className}`}
    >
      {/* 1. Header: Traffic-light dots & Window Title */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#f3f2f1] border-b border-neutral-200 select-none">
        <div className="flex items-center gap-2">
          {/* Traffic-light dots */}
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
          </div>

          <span className="text-xs text-neutral-600 font-medium ml-2 font-mono truncate max-w-xs sm:max-w-md">
            {title}
          </span>
        </div>

        {/* Playback Scrubber Controls */}
        {steps.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-neutral-500">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              title={isPlaying ? 'Pause Guide' : 'Play Guide'}
              className="p-1 rounded hover:bg-neutral-200 text-neutral-700 transition-colors"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            </button>

            <button
              onClick={() => {
                setActiveIndex(0);
                setIsPlaying(true);
              }}
              title="Restart from beginning"
              className="p-1 rounded hover:bg-neutral-200 text-neutral-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* 2. Main Screen Area with Cursor & Fading Trail */}
      <div className="relative flex-1 overflow-hidden select-none">
        {/* The screen (children) */}
        {children}

        {/* Fading Trail Dots */}
        {trailSteps.map((step, i) => (
          <div
            key={`trail-${i}`}
            className="absolute z-30 pointer-events-none -translate-x-1/2 -translate-y-1/2 transition-opacity duration-500"
            style={{
              left: `${step.x}%`,
              top: `${step.y}%`,
              opacity: 0.18 * (i + 1),
            }}
          >
            <div className="w-4 h-4 rounded-full bg-blue-500 border border-white shadow-sm ring-2 ring-blue-300" />
          </div>
        ))}

        {/* Active Cursor: Animated Blue Pointer */}
        {currentStep && (
          <div
            className="absolute z-40 pointer-events-none transition-[left,top] duration-500 ease-out"
            style={{
              left: `${currentStep.x}%`,
              top: `${currentStep.y}%`,
            }}
          >
            {/* SVG Mouse Pointer Icon */}
            <div className="relative -translate-x-1 -translate-y-1">
              <MousePointer2 className="w-6 h-6 fill-blue-600 text-white drop-shadow-[0_2px_8px_rgba(37,99,235,0.6)] animate-pulse" />

              {/* Action Tooltip Bubble on Hover Point */}
              <div className="absolute left-6 top-2 bg-neutral-900 text-white text-[11px] font-medium px-2.5 py-1 rounded-md shadow-lg whitespace-nowrap animate-in fade-in zoom-in-95 duration-200 border border-neutral-700">
                <span>{currentStep.action}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 3. Footer: Action, Target, and Step Count */}
      {steps.length > 0 && currentStep && (
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#f9f9f9] border-t border-neutral-200 text-xs select-none">
          <div className="flex items-center gap-2 truncate">
            <span className="font-semibold text-neutral-900 bg-white border border-neutral-200 px-2 py-0.5 rounded shadow-2xs">
              {currentStep.action}
            </span>
            <span className="text-neutral-500 truncate flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-neutral-400" />
              <span>{currentStep.target}</span>
            </span>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 pl-2">
            <span className="font-mono text-[11px] text-neutral-500 bg-neutral-100 px-2 py-0.5 rounded-full border border-neutral-200">
              Step {clampedIndex + 1} of {steps.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
