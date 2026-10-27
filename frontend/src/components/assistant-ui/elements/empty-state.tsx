import React from 'react';
import { ArrowUp, Table, Database, BarChart3 } from 'lucide-react';

export interface Suggestion {
  prompt: string;
  title: string;
  icon?: 'excel' | 'sql' | 'powerbi';
}

export interface EmptyStateProps {
  suggestions?: Suggestion[];
  onSelectSuggestion?: (prompt: string) => void;
  onSubmitPrompt?: (prompt: string) => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  suggestions = [
    {
      title: 'Excel: Clean headers & formats',
      prompt: 'How do I clean messy merged headers, ghost whitespace, and text numbers in Excel so my dataset is tabular?',
      icon: 'excel',
    },
    {
      title: 'SQL: Fix types & export errors',
      prompt: 'Why is my SQL table import failing on date formats (YYYY-MM-DD) and column data type mismatches from my CSV?',
      icon: 'sql',
    },
    {
      title: 'Power BI: Fix broken relationships',
      prompt: 'Why are my Power BI model relationships breaking and my DAX measures returning incorrect totals?',
      icon: 'powerbi',
    },
  ],
  onSelectSuggestion,
  onSubmitPrompt,
  className = '',
}) => {
  const [value, setValue] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim() && onSubmitPrompt) {
      onSubmitPrompt(value.trim());
      setValue('');
    }
  };

  const renderIcon = (type?: 'excel' | 'sql' | 'powerbi') => {
    if (type === 'excel') return <Table className="w-3.5 h-3.5 text-neutral-500" />;
    if (type === 'sql') return <Database className="w-3.5 h-3.5 text-neutral-500" />;
    if (type === 'powerbi') return <BarChart3 className="w-3.5 h-3.5 text-neutral-500" />;
    return null;
  };

  return (
    <div
      data-slot="empty-state"
      className={`flex flex-col items-center justify-center max-w-2xl sm:max-w-3xl w-full mx-auto text-center px-4 ${className}`}
    >
      {/* Input Composer: Wide, Spacious, Professional ChatGPT Style */}
      <div
        data-slot="empty-state-composer"
        className="w-full relative animate-in fade-in duration-300"
      >
        <form onSubmit={handleSubmit} className="relative flex items-center w-full">
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Ask about Excel cleaning, SQL export, or Power BI models..."
            className="w-full h-15 sm:h-16 pl-6 pr-16 rounded-full bg-[#f4f4f4] hover:bg-[#f0f0f0] focus:bg-white text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none border border-neutral-200/90 focus:border-neutral-300 chatgpt-input-shadow transition-all shadow-xs"
            autoFocus
          />
          <button
            type="submit"
            disabled={!value.trim()}
            aria-label="Send"
            className="absolute right-3.5 w-10 h-10 rounded-full bg-[#0d0d0d] hover:bg-neutral-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-xs"
          >
            <ArrowUp className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* 3 Pipeline Starters: Excel -> SQL -> Power BI */}
      <div
        data-slot="empty-state-suggestions"
        className="mt-6 flex flex-wrap justify-center gap-2.5 animate-in fade-in duration-500 delay-150"
      >
        {suggestions.map((item) => (
          <button
            key={item.title}
            data-slot="empty-state-suggestion"
            onClick={() => onSelectSuggestion?.(item.prompt)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white hover:bg-neutral-50 text-xs sm:text-sm text-neutral-700 hover:text-neutral-900 border border-neutral-200/90 shadow-2xs transition-all active:scale-[0.98]"
          >
            {renderIcon(item.icon)}
            <span>{item.title}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
