import { ChatMessage } from '../types';

export interface StreamChatOptions {
  prompt: string;
  battleId: string;
  messages: ChatMessage[];
  /** Structural profile of the active spreadsheet — attached server-side to the outbound user turn only */
  fileContext?: string | null;
  /** Assignment brief / project instructions supplied by the student at session start */
  assignmentBrief?: string | null;
  onThinking: (label: string | undefined) => void;
  onToken: (token: string, fullAccumulated: string) => void;
  onRefusal?: () => void;
}

export async function streamBackendChat({
  prompt,
  battleId,
  messages,
  fileContext,
  assignmentBrief,
  onThinking,
  onToken,
  onRefusal,
}: StreamChatOptions): Promise<string> {
  const response = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      battleId,
      fileContext: fileContext || undefined,
      assignmentBrief: assignmentBrief || undefined,
      messages: messages.map((m) => ({ role: m.role, text: m.text })),
    }),
  });

  if (!response.ok) {
    throw new Error(`Server returned status ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No readable stream available from server');

  const decoder = new TextDecoder('utf-8');
  let fullAccumulated = '';
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';

    for (const evt of events) {
      if (!evt.trim()) continue;
      const lines = evt.split('\n');
      let eventType = 'message';
      let dataStr = '';

      for (const line of lines) {
        if (line.startsWith('event: ')) {
          eventType = line.replace('event: ', '').trim();
        } else if (line.startsWith('data: ')) {
          dataStr = line.replace('data: ', '').trim();
        }
      }

      if (eventType === 'thinking') {
        try {
          const parsed = JSON.parse(dataStr);
          onThinking(parsed.label);
        } catch {}
      } else if (eventType === 'refusal') {
        onRefusal?.();
      } else if (eventType === 'token') {
        try {
          const parsed = JSON.parse(dataStr);
          const delta = parsed.delta || '';
          fullAccumulated += delta;
          onToken(delta, fullAccumulated);
        } catch {
          // Plain text fallback
          fullAccumulated += dataStr;
          onToken(dataStr, fullAccumulated);
        }
      } else if (eventType === 'done') {
        onThinking(undefined);
      }
    }
  }

  onThinking(undefined);
  return fullAccumulated;
}

export async function getBackendHealth(): Promise<{ provider: string; model: string }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) throw new Error();
    return await res.json();
  } catch {
    return { provider: 'local', model: 'fallback' };
  }
}
