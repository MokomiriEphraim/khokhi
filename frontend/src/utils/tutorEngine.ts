import { TeachBackResult } from '../types';
import { BATTLES_CONTENT } from '../data/battlesData';

export const CHEAT_PATTERNS = [
  /just (clean|do|fix) (it|this) for me/i,
  /give me the (answer|file|code|formula|solution)/i,
  /do my (assignment|homework|project|task)/i,
  /can you (read|open|download|check) my (file|excel|dataset|spreadsheet)/i,
  /write (the|a) (formula|query|script|code) for me/i,
  /solve (this|my) (assignment|problem) directly/i,
  /give me the exact (formula|answer)/i,
  /tell me the answer/i,
  /do the whole thing/i,
  /paste the solution/i,
];

export function checkRefusal(message: string): { isRefusal: boolean; response?: string } {
  const clean = message.trim();
  for (const pattern of CHEAT_PATTERNS) {
    if (pattern.test(clean)) {
      return {
        isRefusal: true,
        response:
          "I can't do that — I have no file access and no tools to write code or deliverables for you. " +
          "That's by design. But I can guide you through the reasoning so you understand and fix it yourself in 3 minutes. " +
          "Which specific column or error are you observing right now?",
      };
    }
  }
  return { isRefusal: false };
}

export function gradeTeachBack(battleId: string, explanation: string): TeachBackResult {
  const text = explanation.trim();
  const lower = text.toLowerCase();

  const rubrics: Record<string, { keywords: string[]; minLen: number }> = {
    '01_floating_point': {
      keywords: ['round', 'precision', 'binary', 'ieee', 'float', 'tail', 'decimal'],
      minLen: 28,
    },
    '02_merged_headers': {
      keywords: ['top-left', 'unmerge', 'null', 'empty', 'blank', 'center across selection', 'column'],
      minLen: 28,
    },
    '03_multi_row_headers': {
      keywords: ['flatten', 'concatenate', 'single', 'combine', 'pandas', 'tier', 'row'],
      minLen: 28,
    },
    '04_stale_formulas': {
      keywords: ['manual', 'automatic', 'f9', 'refresh', 'recalculate', 'options'],
      minLen: 22,
    },
    '05_format_break_2016': {
      keywords: ['text', 'number', 'stored as text', 'value', 'text to columns', 'coerce'],
      minLen: 28,
    },
    '06_blank_vs_zero': {
      keywords: ['denominator', 'average', 'missing', 'count', 'null', 'skew', 'exclude'],
      minLen: 28,
    },
    '07_naming_inconsistency': {
      keywords: ['trim', 'char(160)', 'space', 'whitespace', 'substitute', 'proper', 'casing'],
      minLen: 28,
    },
  };

  const rubric = rubrics[battleId] || { keywords: ['clean', 'data', 'excel'], minLen: 20 };

  if (text.length < rubric.minLen) {
    return {
      passed: false,
      score: 35,
      feedback: 'Your explanation is too brief. Explain *why* the error happened in Excel and *how* your fix addresses the root cause.',
      missing_aspects: ['Underlying cause explanation', 'Mechanical fix details'],
    };
  }

  const matches = rubric.keywords.filter((kw) => lower.includes(kw));
  if (matches.length >= 2 || (matches.length >= 1 && text.length > 55)) {
    const score = Math.min(100, 75 + matches.length * 8);
    return {
      passed: true,
      score,
      feedback: 'Outstanding! You clearly identified the technical mechanism and demonstrated real comprehension.',
      key_insights: matches,
    };
  }

  return {
    passed: false,
    score: 52,
    feedback: "You're on the right track, but haven't identified the technical root cause. Review the concept card and describe what Excel is doing behind the scenes.",
    missing_aspects: ['Name the underlying technical mechanism (e.g. data type, memory allocation, or formula engine state)'],
  };
}

/**
 * Simulates real-time streaming of tokens word-by-word with the exact assistant-ui
 * newest-two-words blue tint effect, while cycling through thinking indicator labels!
 */
export async function streamSocraticResponse(
  prompt: string,
  battleId: string,
  hintLevel: number,
  onThinking: (label: string | undefined) => void,
  onTokenUpdate: (streamedText: string, wordCount: number) => void
): Promise<string> {
  // 1. Refusal check
  onThinking('Checking Refusal Guardrails');
  await new Promise((r) => setTimeout(r, 600));

  const refusal = checkRefusal(prompt);
  if (refusal.isRefusal && refusal.response) {
    onThinking(undefined);
    await simulateWordStream(refusal.response, onTokenUpdate);
    return refusal.response;
  }

  // 2. State Machine: Brief Parser / Concept Consultation
  const battle = BATTLES_CONTENT[battleId] || BATTLES_CONTENT['01_floating_point'];
  onThinking(`Consulting Concept: ${battleId.replace(/^\d+_/, '').replace(/_/g, ' ')}`);
  await new Promise((r) => setTimeout(r, 800));

  onThinking('Formulating Socratic Guidance');
  await new Promise((r) => setTimeout(r, 600));

  // Build Socratic Response based on prompt intent & hints
  let targetResponse = '';
  const pLower = prompt.toLowerCase();

  if (pLower.includes('hint') || hintLevel > 1) {
    const hintIdx = Math.min(hintLevel - 1, battle.hints.length - 1);
    targetResponse = `Here is progressive scaffolding for this battle:\n\n${battle.hints[hintIdx]}\n\nTry applying that step to the sandbox file. What change do you observe in your cells?`;
  } else if (pLower.includes('why') || pLower.includes('explain') || pLower.includes('vlookup') || pLower.includes('sum')) {
    targetResponse = `That is a classic data analysis roadblock! Look closely at the raw values:\n\n${battle.symptom}\n\nHere is your guiding question: ${battle.socraticQuestion}\n\nNotice that we do not change your real assignment file — test this on the sandbox dataset first.`;
  } else {
    targetResponse = `Great initiative! To master this battle without shortcuts, let us analyze the behavior:\n\n1. What is the expected output versus what Excel actually displays?\n2. ${battle.socraticQuestion}\n\nDownload the fake practice sandbox on the right if you need a zero-risk sheet to test your formula!`;
  }

  onThinking(undefined);
  await simulateWordStream(targetResponse, onTokenUpdate);
  return targetResponse;
}

async function simulateWordStream(
  fullText: string,
  onTokenUpdate: (streamedText: string, count: number) => void
) {
  const words = fullText.split(' ');
  let accumulated = '';

  for (let i = 0; i < words.length; i++) {
    accumulated += (i === 0 ? '' : ' ') + words[i];
    onTokenUpdate(accumulated, i + 1);
    // 35ms - 65ms delay per word to give that soft rhythmic delivery
    const delay = words[i].includes('.') || words[i].includes('?') ? 110 : 42;
    await new Promise((r) => setTimeout(r, delay));
  }
}
