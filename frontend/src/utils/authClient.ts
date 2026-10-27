export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  success: boolean;
  step?: 'otp_required';
  token?: string;
  user?: User;
  error?: string;
  message?: string;
}

export interface DBStatus {
  configured: boolean;
  connected: boolean;
  database: string;
  error: string | null;
}

const TOKEN_KEY = 'autonomous_da_auth_token';
const USER_KEY = 'autonomous_da_auth_user';

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredAuth(token: string, user: User) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearStoredAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  // Purge ALL student-specific data so the next user on a shared machine starts clean
  const keysToRemove = Object.keys(localStorage).filter((k) => k.startsWith('khokhi_'));
  keysToRemove.forEach((k) => localStorage.removeItem(k));
}

export async function fetchDBStatus(): Promise<DBStatus> {
  try {
    const res = await fetch('/api/auth/status');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    return await res.json();
  } catch (err: any) {
    return {
      configured: false,
      connected: false,
      database: 'local_fallback',
      error: err.message,
    };
  }
}

export async function apiSignup(name: string, email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to initiate signup' };
  }
}

export async function apiVerifyOtp(email: string, otp: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, otp }),
    });
    const data = await res.json();
    if (data.success && data.token && data.user) {
      setStoredAuth(data.token, data.user);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to verify OTP' };
  }
}

export async function apiResendOtp(email: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to resend code' };
  }
}

export async function apiLogin(email: string, password: string): Promise<AuthResponse> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (data.success && data.token && data.user) {
      setStoredAuth(data.token, data.user);
    }
    return data;
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to sign in' };
  }
}

export async function apiGetMe(): Promise<User | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      clearStoredAuth();
      return null;
    }
    const data = await res.json();
    if (data.success && data.user) {
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    return null;
  } catch {
    return getStoredUser();
  }
}

// -------------------------------------------------------------------
// User Chat Session Persistence (MongoDB Atlas)
// -------------------------------------------------------------------

export interface SavedChatHistory {
  userId: string;
  userEmail: string;
  battleId: string;
  messages: any[];
  auditStats?: any;
  /** Structural profile of the file the student had open — restored on login */
  fileContext?: string | null;
  contextFileName?: string | null;
  assignmentBrief?: string | null;
  updatedAt?: string;
}

export async function apiGetChatHistory(): Promise<SavedChatHistory | null> {
  const token = getStoredToken();
  if (!token) return null;

  try {
    const res = await fetch('/api/chat/history', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.success && data.history) {
      return data.history;
    }
    return null;
  } catch {
    return null;
  }
}

export async function apiSaveChatHistory(payload: {
  messages: any[];
  battleId?: string;
  auditStats?: any;
  fileContext?: string | null;
  contextFileName?: string | null;
  assignmentBrief?: string | null;
}): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const res = await fetch('/api/chat/save', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function apiClearChatHistory(): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;

  try {
    const res = await fetch('/api/chat/clear', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ── Document Parsing (PDF / TXT / DOCX) ──────────────────────────────────────

export async function apiParseDocument(file: File): Promise<{
  success: boolean;
  filename: string;
  text: string;
  wordCount: number;
  charCount: number;
  error?: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onerror = () =>
      resolve({
        success: false,
        filename: file.name,
        text: '',
        wordCount: 0,
        charCount: 0,
        error: 'Could not read file',
      });
    reader.onload = async () => {
      try {
        const buffer = reader.result as ArrayBuffer;
        let binary = '';
        const bytes = new Uint8Array(buffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64 = btoa(binary);

        const res = await fetch('/api/parse-document', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: file.name, base64 }),
        });
        const data = await res.json();
        if (data.success) {
          resolve(data);
        } else {
          resolve({
            success: false,
            filename: file.name,
            text: '',
            wordCount: 0,
            charCount: 0,
            error: data.error || 'Failed to parse document',
          });
        }
      } catch (err: any) {
        resolve({
          success: false,
          filename: file.name,
          text: '',
          wordCount: 0,
          charCount: 0,
          error: err.message || 'Failed to parse document',
        });
      }
    };
    reader.readAsArrayBuffer(file);
  });
}

// ── Multi-Session Chat History ────────────────────────────────────────────────

export interface ChatSessionMeta {
  id: string;
  title: string;
  fileName: string | null;
  messageCount: number;
  preview: string;
  hasBrief?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ChatSessionFull extends ChatSessionMeta {
  fileContext: string | null;
  assignmentBrief?: string | null;
  messages: any[];
}

/** List all past sessions (no messages body, just metadata) */
export async function apiListSessions(): Promise<ChatSessionMeta[]> {
  const token = getStoredToken();
  if (!token) return [];
  try {
    const res = await fetch('/api/sessions', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return [];
    const data = await res.json();
    return data.success ? data.sessions : [];
  } catch { return []; }
}

/** Save current messages as a new named session */
export async function apiSaveSession(payload: {
  title: string;
  fileName?: string | null;
  messages: any[];
  fileContext?: string | null;
  assignmentBrief?: string | null;
}): Promise<string | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.sessionId : null;
  } catch { return null; }
}

/** Update an existing session's messages and metadata */
export async function apiUpdateSession(
  sessionId: string,
  payload: {
    title?: string;
    fileName?: string | null;
    messages: any[];
    fileContext?: string | null;
    assignmentBrief?: string | null;
  }
): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Load the full messages of a session */
export async function apiLoadSession(sessionId: string): Promise<ChatSessionFull | null> {
  const token = getStoredToken();
  if (!token) return null;
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? data.session : null;
  } catch { return null; }
}

/** Delete a session by ID */
export async function apiDeleteSession(sessionId: string): Promise<boolean> {
  const token = getStoredToken();
  if (!token) return false;
  try {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch { return false; }
}
