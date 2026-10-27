import React from 'react';
import { Battle } from '../types';
import { CheckCircle2, Circle, Flame } from 'lucide-react';

interface BattleListProps {
  battles: Battle[];
  activeBattleId: string;
  onSelectBattle: (id: string) => void;
}

export const BattleList: React.FC<BattleListProps> = ({
  battles,
  activeBattleId,
  onSelectBattle,
}) => {
  const passedCount = battles.filter((b) => b.passed).length;

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-2xl border border-slate-800/80 p-4 overflow-hidden">
      {/* Header with Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              7 Cleaning Battles
            </h2>
          </div>
          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
            {passedCount} / {battles.length} Passed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500 rounded-full"
            style={{ width: `${(passedCount / battles.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Battles List Items */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {battles.map((battle, index) => {
          const isActive = battle.id === activeBattleId;
          const isPassed = battle.passed;

          return (
            <button
              key={battle.id}
              onClick={() => onSelectBattle(battle.id)}
              className={`w-full text-left p-3 rounded-xl transition-all duration-200 border flex items-start gap-3 group relative ${
                isActive
                  ? 'bg-blue-950/40 border-blue-500/50 shadow-md shadow-blue-950/50 ring-1 ring-blue-500/30'
                  : 'bg-slate-900/60 hover:bg-slate-800/60 border-slate-800/80 text-slate-300 hover:border-slate-700'
              }`}
            >
              {/* Passed Status Icon */}
              <div className="mt-0.5 flex-shrink-0">
                {isPassed ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                ) : (
                  <Circle className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-slate-600'}`} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-[11px] font-mono text-slate-500">
                    BATTLE {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    className={`text-[9px] font-semibold uppercase px-1.5 py-0.2 rounded border ${
                      battle.difficulty === 'Easy'
                        ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/30'
                        : battle.difficulty === 'Medium'
                        ? 'bg-amber-950/40 text-amber-400 border-amber-500/30'
                        : 'bg-rose-950/40 text-rose-400 border-rose-500/30'
                    }`}
                  >
                    {battle.difficulty}
                  </span>
                </div>

                <h3
                  className={`text-xs font-semibold truncate ${
                    isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'
                  }`}
                >
                  {battle.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                  {battle.subtitle}
                </p>
              </div>

              {isActive && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
