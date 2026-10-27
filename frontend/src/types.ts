export interface Battle {
  id: string;
  title: string;
  subtitle: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tag: string;
  passed?: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: 'running' | 'complete';
  thinkingLabel?: string;
  isRefusal?: boolean;
  battleId?: string;
  hintLevel?: number;
  attachments?: { name: string; type: 'spreadsheet' | 'rubric' }[];
}

export interface TeachBackResult {
  passed: boolean;
  score: number;
  feedback: string;
  key_insights?: string[];
  missing_aspects?: string[];
}

export interface AuditStats {
  total_events: number;
  refusals_intercepted: number;
  teach_backs_attempted: number;
  teach_backs_passed: number;
  student_files_accessed: number;
  code_deliverables_generated: number;
  active_students: number;
}
