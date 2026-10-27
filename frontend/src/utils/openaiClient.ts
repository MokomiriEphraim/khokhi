import { BATTLES_CONTENT } from '../data/battlesData';
import { checkRefusal } from './tutorEngine';

export const OPENAI_MODEL = 'gpt-4o-mini';

const SOCRATIC_SYSTEM_PROMPT = `
You are the Socratic Data Analysis Mentor for students learning Excel and data cleaning.
Your motto: "The speed of ChatGPT. The discipline of a tutor. Answer instantly — just not with the answer."

CRITICAL PEDAGOGICAL CONSTRAINTS:
1. NEVER provide direct copy-paste solutions, complete final formulas, cleaned tables, or written deliverables. Doing the student's work is considered cheating in this training program.
2. If the user asks you to "do it for me", "clean this file", or "give me the exact formula", you MUST politely refuse: state that you have zero file access and no code execution tools by design, but you will help them reason through it in 3 minutes.
3. Use Socratic questioning: ask them what symptom they see, what formula/feature they think applies, or how Excel handles data types under the hood.
4. Keep responses punchy, conversational, and encouraging (1-3 short paragraphs max).
5. When relevant, reference the 7 Data Cleaning Battles:
   - 01: Floating-Point Drift (IEEE 754 precision tails, ROUND())
   - 02: Merged Headers Trap (top-left retention, Center Across Selection)
   - 03: Multi-Row Headers (combining tier 1 and tier 2 with concatenation)
   - 04: Stale Formulas (Manual calculation mode, F9 recalculation)
   - 05: Format Break (Stored as text, Text to Columns, SUM() returning 0)
   - 06: Blank vs Zero (AVERAGE denominator skew, AVERAGEIF)
   - 07: Naming Inconsistency (non-breaking spaces CHAR(160), TRIM, SUBSTITUTE)
`;

export async function streamOpenAIResponse(
  prompt: string,
  battleId: string,
  apiKey: string,
  onThinking: (label: string | undefined) => void,
  onTokenUpdate: (streamedText: string, wordCount: number) => void
): Promise<string> {
  // 1. Refusal check
  onThinking('Checking Refusal Guardrails');
  await new Promise((r) => setTimeout(r, 400));

  const refusal = checkRefusal(prompt);
  if (refusal.isRefusal && refusal.response) {
    onThinking(undefined);
    // Stream refusal text
    const words = refusal.response.split(' ');
    let current = '';
    for (let i = 0; i < words.length; i++) {
      current += (i === 0 ? '' : ' ') + words[i];
      onTokenUpdate(current, i + 1);
      await new Promise((r) => setTimeout(r, 35));
    }
    return refusal.response;
  }

  // 2. Active battle context
  const battle = BATTLES_CONTENT[battleId] || BATTLES_CONTENT['01_floating_point'];
  onThinking(`Connecting to ${OPENAI_MODEL}`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey.trim()}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: 'system', content: SOCRATIC_SYSTEM_PROMPT },
          {
            role: 'system',
            content: `Current Battle Context: ${battleId}.\nSymptom: ${battle.symptom}\nRoot Cause: ${battle.rootCause}\nSocratic Question: ${battle.socraticQuestion}`,
          },
          { role: 'user', content: prompt },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.error?.message || `OpenAI request failed: ${response.statusText}`);
    }

    onThinking('Formulating Socratic Guidance');
    await new Promise((r) => setTimeout(r, 300));
    onThinking(undefined);

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No readable stream available');

    const decoder = new TextDecoder('utf-8');
    let fullText = '';
    let wordCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter((l) => l.trim().startsWith('data: '));

      for (const line of lines) {
        const jsonStr = line.replace('data: ', '').trim();
        if (jsonStr === '[DONE]') break;
        try {
          const parsed = JSON.parse(jsonStr);
          const delta = parsed.choices?.[0]?.delta?.content || '';
          if (delta) {
            fullText += delta;
            wordCount = fullText.split(/\s+/).filter(Boolean).length;
            onTokenUpdate(fullText, wordCount);
          }
        } catch {
          // ignore parse errors for partial chunks
        }
      }
    }

    return fullText;
  } catch (err: any) {
    onThinking(undefined);
    const fallbackMsg = `[OpenAI Error: ${err.message || 'Connection failed'}]. Falling back to local Socratic guidance:\n\n${battle.socraticQuestion}`;
    onTokenUpdate(fallbackMsg, fallbackMsg.split(' ').length);
    return fallbackMsg;
  }
}
