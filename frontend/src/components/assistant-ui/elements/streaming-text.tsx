import React, { useMemo } from 'react';

export interface StreamingTextProps {
  text: string;
  streaming?: boolean;
  className?: string;
}

/**
 * StreamingText component matching assistant-ui elements specification:
 * - Proper whitespace preservation: words never squish together
 * - Trailing words tinted in deep blue while streaming, settling into dark ink
 * - Trailing caret only renders when streaming is active
 */
export const StreamingText: React.FC<StreamingTextProps> = ({
  text,
  streaming = false,
  className = '',
}) => {
  // Split into tokens while preserving spaces and linebreaks
  const tokens = useMemo(() => {
    if (!text) return [];
    // Split by spaces or linebreaks, keeping delimiters
    return text.split(/(\s+)/);
  }, [text]);

  // Find non-whitespace word indices to identify the trailing window
  const wordIndices = useMemo(() => {
    const indices: number[] = [];
    tokens.forEach((token, idx) => {
      if (token.trim().length > 0) {
        indices.push(idx);
      }
    });
    return indices;
  }, [tokens]);

  const totalWords = wordIndices.length;
  const trailingWordThreshold = totalWords > 2 ? wordIndices[totalWords - 2] : 0;

  return (
    <div
      data-slot="streaming-text"
      className={`leading-relaxed whitespace-pre-wrap text-[#0d0d0d] ${className}`}
    >
      {tokens.map((token, idx) => {
        const isWhitespace = token.trim().length === 0;

        if (isWhitespace) {
          return <span key={idx}>{token}</span>;
        }

        const isTrailing = streaming && idx >= trailingWordThreshold;

        return (
          <span
            key={idx}
            className={`transition-colors duration-700 ease-out ${
              isTrailing
                ? 'text-blue-600 font-medium'
                : 'text-[#0d0d0d] font-normal'
            }`}
          >
            {token}
          </span>
        );
      })}

      {streaming && text.trim().length > 0 && (
        <span
          aria-hidden="true"
          className="inline-block w-1.5 h-4 ml-1 align-middle bg-blue-600 animate-pulse rounded-xs"
        />
      )}
    </div>
  );
};
