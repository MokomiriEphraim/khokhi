import React, { useRef, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';
import { StreamingText } from './streaming-text';
import { ThinkingIndicator, useElapsedLabel } from './thinking-indicator';
import { GuardrailNotice } from './guardrail-notice';

export interface ChatPanelMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: 'running' | 'complete';
  isRefusal?: boolean;
  thinkingLabel?: string;
}

export interface ChatPanelProps {
  messages: ChatPanelMessage[];
  isRunning?: boolean;
  onSend: (message: string) => void;
  className?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isRunning = false,
  onSend,
  className = '',
}) => {
  const [input, setInput] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const elapsed = useElapsedLabel(isRunning);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isRunning]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    onSend(input.trim());
    setInput('');
  };

  return (
    <div
      data-slot="chat-panel"
      className={`flex flex-col flex-1 h-full max-w-2xl sm:max-w-3xl w-full mx-auto relative ${className}`}
    >
      {/* Messages Viewport */}
      <div
        data-slot="chat-panel-messages"
        className="flex-1 overflow-y-auto space-y-6 pt-4 pb-32 px-2"
      >
        {messages.map((message) => {
          const isUser = message.role === 'user';
          const isRefusal = Boolean(message.isRefusal);

          if (isRefusal && !isUser) {
            return (
              <div key={message.id} className="flex justify-start w-full">
                <GuardrailNotice
                  title="I can't do that for you"
                  explanation={
                    message.text ||
                    "Khokhi is designed to build your problem-solving skills, so I will not provide direct deliverables or finished formulas. But I can guide you through the diagnosis and steps so you can solve it yourself in minutes."
                  }
                  policy="anti-cheat policy"
                  alternatives={[
                    'Why does this dirty data issue cause errors in SQL?',
                    'Give me a Socratic hint on which Excel formula to use',
                    'How do I test if my revenue column contains text numbers?',
                  ]}
                  onPick={(alt) => onSend(alt)}
                  className="max-w-2xl"
                />
              </div>
            );
          }

          return (
            <div
              key={message.id}
              className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
            >
              {isUser ? (
                <div
                  data-slot="chat-panel-user-message"
                  className="bg-[#f4f4f4] text-[#0d0d0d] rounded-2xl px-5 py-3 max-w-lg text-base leading-relaxed animate-in fade-in duration-200"
                >
                  {message.text}
                </div>
              ) : (
                <div
                  data-slot="chat-panel-assistant-message"
                  className="text-[#0d0d0d] max-w-2xl text-base leading-relaxed"
                >
                  {message.status === 'running' && !message.text ? (
                    <ThinkingIndicator
                      label={message.thinkingLabel || 'Drafting a reply...'}
                      elapsed={elapsed}
                    />
                  ) : (
                    <StreamingText
                      text={message.text}
                      streaming={message.status === 'running'}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Floating Bottom Composer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-neutral-100 py-4 px-4 z-20">
        <div
          data-slot="chat-panel-composer"
          className="max-w-2xl sm:max-w-3xl mx-auto relative"
        >
          <form onSubmit={handleSubmit} className="relative flex items-center w-full">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Khokhi..."
              disabled={isRunning}
              className="w-full h-14 pl-6 pr-14 rounded-full bg-[#f4f4f4] focus:bg-white text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none border border-neutral-200 focus:border-neutral-300 chatgpt-input-shadow transition-all"
            />
            <button
              type="submit"
              disabled={isRunning || !input.trim()}
              aria-label="Send"
              className="absolute right-3 w-9 h-9 rounded-full bg-[#0d0d0d] hover:bg-neutral-800 text-white flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
          </form>
          <p className="text-[11px] text-center text-neutral-400 mt-2">
            Khokhi leads you to understanding. Zero files touched.
          </p>
        </div>
      </div>
    </div>
  );
};
