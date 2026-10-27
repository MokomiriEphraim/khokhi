import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import {
  connectDB,
  getDBStatus,
  getUserChatHistory,
  saveUserChatHistory,
  clearUserChatHistory,
  listChatSessions,
  createChatSession,
  updateChatSession,
  deleteChatSession,
  getChatSession,
} from './db.mjs';
import {
  initiateSignup,
  verifyOtpAndCreateUser,
  resendSignupOtp,
  loginUser,
  getUserFromToken,
} from './auth.mjs';

// Read .env if present in root or parent
const envCandidates = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '..', '.env'),
  path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '.env'),
];
for (const envPath of envCandidates) {
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const [k, ...v] = trimmed.split('=');
      if (k && v.length) {
        process.env[k.trim()] = v.join('=').trim().replace(/^["']|["']$/g, '');
      }
    }
    break;
  }
}

const PORT = parseInt(process.env.PORT || '8000', 10);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// ── Token budget & rate-limit guardrails ────────────────────────────
// Protects your OpenAI credits when 22+ students hit the system at once.
const RATE_LIMIT_PER_MIN = 15;      // max messages per user per minute
const DAILY_MSG_LIMIT    = 150;     // max messages per user per day
const MAX_HISTORY_TURNS  = 10;      // only send last N history messages to OpenAI (saves input tokens)

// In-memory rate tracking (resets on server restart — fine for <50 users)
const rateBuckets = new Map();      // userId → { count, resetAt }
const dailyBuckets = new Map();     // userId → { count, resetAt }

function checkRateLimit(userId) {
  const now = Date.now();

  // Per-minute bucket
  let minute = rateBuckets.get(userId);
  if (!minute || now > minute.resetAt) {
    minute = { count: 0, resetAt: now + 60_000 };
    rateBuckets.set(userId, minute);
  }
  if (minute.count >= RATE_LIMIT_PER_MIN) {
    const waitSec = Math.ceil((minute.resetAt - now) / 1000);
    return `Slow down — you're sending messages too fast. Wait ${waitSec}s and try again.`;
  }

  // Daily bucket (resets at midnight)
  const todayKey = new Date().toISOString().slice(0, 10);
  let daily = dailyBuckets.get(userId);
  if (!daily || daily.day !== todayKey) {
    daily = { count: 0, day: todayKey };
    dailyBuckets.set(userId, daily);
  }
  if (daily.count >= DAILY_MSG_LIMIT) {
    return `You've reached your daily coaching limit (${DAILY_MSG_LIMIT} messages). Come back tomorrow — your progress is saved! 🎓`;
  }

  // All clear — increment both
  minute.count++;
  daily.count++;
  return null;
}


const CHEAT_PATTERNS = [
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

const SOCRATIC_SYSTEM_PROMPT = `
You are Khokhi, the elite Socratic Data Analysis Coach for students mastering the end-to-end Data Analytics Pipeline:
1. EXCEL DATA CLEANING:
   - Diagnosing merged headers, multi-row reporting banners, ghost whitespace, text-stored numbers, currency symbols, floating point tails, and blank cells vs zero skew.
2. EXPORTING TO SQL:
   - Schema enforcement, column name sanitization (no spaces/symbols), proper data types (VARCHAR, INT, DECIMAL, DATE YYYY-MM-DD), primary key integrity, and handling NULL values for database bulk insert.
3. VISUALISING IN POWER BI:
   - Power Query ETL, building clean Star Schema models, avoiding Many-to-Many relationship traps, and writing accurate DAX measures (CALCULATE, SUM, DIVIDE with safe divide, RELATED).

SOUTH AFRICAN DOMAIN & LOCALIZATION INTELLIGENCE:
You have native expertise in South African commercial, banking, and academic data standards:
- DATASET AWARENESS: ONLY talk about currency, South African Rand (R), or tax/VAT IF the student's dataset actually contains financial/currency/monetary columns (e.g. tuition fees, salaries, budgets, invoices). If the dataset contains academic ranks, headcounts, student numbers, staff counts, or FTEs, DO NOT invent or bring up currency! Look strictly at what data columns actually exist in their sheet.
- CURRENCY (WHEN RELEVANT): In South Africa, currency is the South African Rand (R / ZAR). If the dataset actually has financial figures, refer to values in Rands (e.g. R1,500.00). If numbers are stored with a leading "R " or non-breaking spaces as thousand separators, guide the student on how to strip the "R", trim whitespace, and coerce the column into true numbers.
- VAT (WHEN RELEVANT): In South Africa, the standard Value-Added Tax (VAT) rate is 15% on invoices and commercial transactions.
- DATES: In South Africa, dates standard is DD/MM/YYYY (Day/Month/Year). Emphasize ambiguity when exporting to SQL databases, which strictly require ISO standard format (YYYY-MM-DD).
- IDENTIFIERS & PII: 13-digit South African National ID numbers (YYMMDD SSSS C A Z) must always be formatted as Text (VARCHAR in SQL), never as general numbers, to avoid scientific notation corruption (e.g. 9.40812E+12) and lost leading zeroes. 10-digit SA phone numbers (082..., 071..., 060... or +27) must also be preserved as text.
- SOUTH AFRICAN INSTITUTIONS & CONTEXT: Confidently recognize South African entities (DHET/HEMIS higher education reports, universities: Wits, UCT, UP, UJ, Stellenbosch, UKZN, TUT, CPUT, CUT, DUT, etc., SARS for tax, Stats SA, SA banks).

STRICT SOCRATIC PEDAGOGICAL CONSTRAINTS (ACTION-FIRST GUIDED LEARNING):
1. SHOW WHAT TO DO & WHY (ACTION-FIRST):
   - Do NOT interrogate the student with open-ended quizzes (avoid asking "How would you do this?", "Do you see how this affects your data?").
   - INSTEAD, GIVE DIRECT, CONCRETE ACTION GUIDANCE: Tell the student clearly WHAT action to take in Excel and WHY:
     * Example: "Step 1: Select rows 1 to 7 on the far-left margin, right-click, and click Delete. This removes the report banners so Row 8 shifts up to become your clean column headers."
   - Still do NOT write finished Python code or complete spreadsheet formulas for them — guide their actions directly in Excel.

2. REAL-TIME EDIT EVALUATION (GOOD MOVES vs BAD MOVES):
   - When the student's message or context indicates they took an action:
     * IF IT WAS A GOOD MOVE: Validate it immediately! (e.g. "Spot on! Deleting those title rows freed up your headers. Now let's tackle the next blocker...")
     * IF IT WAS A BAD MOVE / ERROR: Warn them kindly and tell them how to fix or undo it (e.g. "Careful — deleting that row removed actual institution data! Press Ctrl+Z to undo. What we need to delete is rows 1–7 above the headers.")

3. NEVER INSTRUCT DELETING VALID DATA ROWS OR COLUMN HEADERS:
   - LOOK AT THE SAMPLE ROWS in the context before telling the student to delete any row!
   - If a row contains institution records, student IDs, universities (e.g. UCT, CUT, DUT, CPUT), numbers, or observations, IT IS VALID DATA. DO NOT tell the student to delete it!
   - CRITICAL — STACKED / MULTI-ROW HEADERS ARE NOT TITLE BANNERS:
     * Never confuse stacked headers (e.g. Row 2 has Years "2009", "2010"...; Row 3 has "Number", "University", "Surplus/Deficit") with title banners!
     * NEVER tell the student to delete rows containing column names, year labels, or metric categories! Deleting them will destroy their headers!
     * If Row 1 is a solitary blank row, instruct deleting ONLY Row 1.
     * When headers span multiple rows (e.g. Year on top, metric below), coach the student to combine or flatten them into one row (e.g. "2009 Surplus/Deficit"), NEVER delete them.
   - Only instruct deleting genuine title banners (e.g. "Department of Higher Education...", "Table 21..."), lone blank divider rows, bottom footnotes/source notes, or subtotal/grand total summary rows.

4. STRICT ROW NUMBER BOUNDS & ROW SHIFT AWARENESS:
   - The context specifies: 'Size: <N> rows x <M> columns'. The active sheet only has <N> total rows!
   - You MUST NEVER cite, recommend, or tell the student to select or delete any row number greater than <N>.
   - When telling the student to delete a Total or Subtotal row, look at the EXACT row index given in the context (e.g. 'Subtotal/total rows: row 27 [TOTAL]'), NEVER invent or hallucinate row numbers from other documents or past states.
   - DELETE ENTIRE DIRTY BANNER AT ONCE: When multiple title/banner/spacer rows precede the headers (e.g. Rows 1 to 7), instruct the student to select and delete ALL dirty banner rows at once (e.g. "Select rows 1 to 7, right-click, and delete them together"). This shifts the header row directly into Row 1 in a single clean step and prevents row-shift confusion.
   - If guiding step-by-step, ALWAYS account for row shifts: deleting rows 1 to 4 causes row 6 to become row 2 in the live sheet. Never tell them to delete "Row 6" if earlier rows were already deleted!

5. ONE ACTION STEP AT A TIME:
   - Do NOT overwhelm the student with a 5-step checklist in one reply.
   - Focus on ONE priority action at a time (e.g. 1st: remove title banners; 2nd: remove subtotal/total rows; 3rd: check formats).

6. STUDENT FILE CONTEXT: Each student message may arrive with an [ACTIVE SPREADSHEET CONTEXT] block — a structural profile of the Excel file they have open (sheet names, headers, detected title/subtotal/footnote rows, anomalies, sample rows). When present, USE IT: name their file and its sheets, point at specific row numbers and columns, and answer as if you are looking at their sheet's structure. Never claim you cannot see their file when the context block is present.

5. SHORT, CONVERSATIONAL COACHING TURNS:
   - Keep answers concise, clear, and encouraging (under 3 short paragraphs). End each response by telling the student what to try in Excel now.
`;

function checkRefusal(message) {
  for (const pattern of CHEAT_PATTERNS) {
    if (pattern.test(message)) {
      return (
        "I can't do that — I have no file access and no tools to write code or deliverables for you. " +
        "That's by design. But I can guide you through the reasoning so you understand and fix it yourself in 3 minutes. " +
        "Which specific column, SQL import error, or Power BI model are you observing right now?"
      );
    }
  }
  return null;
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(new Error('Invalid JSON format in request body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function extractTextFromDocument(filename, buffer) {
  return new Promise((resolve, reject) => {
    const ext = path.extname(filename || '').toLowerCase();

    // Plain text formats
    if (['.txt', '.md', '.csv', '.tsv', '.json'].includes(ext)) {
      return resolve(buffer.toString('utf8'));
    }

    // PDF documents via pdftotext with regex stream fallback
    if (ext === '.pdf') {
      try {
        const proc = spawn('pdftotext', ['-', '-']);
        let stdout = '';
        let stderr = '';
        proc.stdout.on('data', (d) => { stdout += d; });
        proc.stderr.on('data', (d) => { stderr += d; });
        proc.on('close', (code) => {
          if (code === 0 && stdout.trim()) {
            resolve(stdout);
          } else {
            const raw = buffer.toString('latin1');
            const streamMatches = raw.match(/stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g) || [];
            let fallbackText = '';
            for (const sm of streamMatches) {
              const clean = sm.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
              if (clean.length > 30) fallbackText += clean + '\n';
            }
            if (fallbackText.trim()) resolve(fallbackText);
            else reject(new Error(`pdftotext exited with code ${code}: ${stderr || 'No text extracted'}`));
          }
        });
        proc.on('error', () => {
          const raw = buffer.toString('latin1');
          const clean = raw.replace(/[^\x20-\x7E\n\r\t]/g, ' ');
          if (clean.trim().length > 50) resolve(clean);
          else reject(new Error('Could not parse PDF'));
        });
        proc.stdin.write(buffer);
        proc.stdin.end();
      } catch (err) {
        reject(err);
      }
      return;
    }

    // Word doc (.docx is a zip containing XML)
    if (ext === '.docx' || ext === '.doc') {
      const raw = buffer.toString('latin1');
      const text = raw.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ');
      if (text.trim().length > 20) return resolve(text);
    }

    // Default fallback
    resolve(buffer.toString('utf8'));
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  // Health check
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      status: OPENAI_API_KEY ? 'ok' : 'missing_api_key',
      provider: 'openai-gpt-4o-mini',
      model: 'gpt-4o-mini',
      database: getDBStatus(),
    });
    return;
  }

  // Database status
  if (pathname === '/api/auth/status') {
    sendJson(res, 200, getDBStatus());
    return;
  }

  // Auth: Step 1 - Initiate Signup (generates and sends 6-digit OTP via greyrope.tech)
  if (pathname === '/api/auth/signup' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await initiateSignup(body);
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      const isLockout = err.message.includes('locked for 24 hours');
      sendJson(res, isLockout ? 429 : 400, { success: false, error: err.message });
    }
    return;
  }

  // Auth: Step 2 - Verify OTP & Create Account (enforces 3 attempts / 24h lockout)
  if (pathname === '/api/auth/verify-otp' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await verifyOtpAndCreateUser(body);
      sendJson(res, 201, { success: true, ...result });
    } catch (err) {
      const isLockout = err.message.includes('locked for 24 hours');
      sendJson(res, isLockout ? 429 : 400, { success: false, error: err.message });
    }
    return;
  }

  // Auth: Resend OTP Code
  if (pathname === '/api/auth/resend-otp' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await resendSignupOtp(body);
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      const isLockout = err.message.includes('locked for 24 hours');
      sendJson(res, isLockout ? 429 : 400, { success: false, error: err.message });
    }
    return;
  }

  // Auth: Login
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const result = await loginUser(body);
      sendJson(res, 200, { success: true, ...result });
    } catch (err) {
      sendJson(res, 400, { success: false, error: err.message });
    }
    return;
  }

  // Auth: Get Current User
  if (pathname === '/api/auth/me' && req.method === 'GET') {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        sendJson(res, 401, { success: false, error: 'Authorization token required' });
        return;
      }
      const user = await getUserFromToken(token);
      if (!user) {
        sendJson(res, 401, { success: false, error: 'Invalid or expired token' });
        return;
      }
      sendJson(res, 200, { success: true, user });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // Chat History: Get User Chat Session
  if (pathname === '/api/chat/history' && req.method === 'GET') {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        sendJson(res, 401, { success: false, error: 'Authorization token required' });
        return;
      }
      const user = await getUserFromToken(token);
      if (!user) {
        sendJson(res, 401, { success: false, error: 'Invalid or expired token' });
        return;
      }
      const history = await getUserChatHistory(user.id);
      sendJson(res, 200, {
        success: true,
        history: history || {
          userId: user.id,
          userEmail: user.email,
          battleId: '01_floating_point',
          messages: [],
          auditStats: null,
        },
      });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // Chat History: Save / Upsert Current User Chat
  if (pathname === '/api/chat/save' && req.method === 'POST') {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        sendJson(res, 401, { success: false, error: 'Authorization token required' });
        return;
      }
      const user = await getUserFromToken(token);
      if (!user) {
        sendJson(res, 401, { success: false, error: 'Invalid or expired token' });
        return;
      }
      const body = await parseBody(req);
      // fileContext persists with the student's chat so a refresh/relaunch
      // restores the coach's knowledge of their open sheet.
      const fileContext =
        typeof body.fileContext === 'string' && body.fileContext.trim()
          ? body.fileContext.trim().slice(0, 8000)
          : null;
      const contextFileName =
        typeof body.contextFileName === 'string' && body.contextFileName.trim()
          ? body.contextFileName.trim().slice(0, 255)
          : null;
      const saved = await saveUserChatHistory(user.id, {
        userEmail: user.email,
        battleId: body.battleId || '01_floating_point',
        messages: body.messages || [],
        auditStats: body.auditStats || null,
        fileContext,
        contextFileName,
        assignmentBrief: typeof body.assignmentBrief === 'string' ? body.assignmentBrief.trim() : null,
      });
      sendJson(res, 200, { success: true, saved });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // Parse Document: PDF / TXT / DOCX text extraction for assignment instructions
  if (pathname === '/api/parse-document' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const filename = body.filename || 'document.pdf';
      const base64 = body.base64 || '';
      if (!base64) {
        sendJson(res, 400, { success: false, error: 'Document base64 content required' });
        return;
      }
      const buffer = Buffer.from(base64, 'base64');
      const rawText = await extractTextFromDocument(filename, buffer);

      const cleaned = (rawText || '')
        .replace(/\r\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      const words = cleaned ? cleaned.split(/\s+/).filter(Boolean).length : 0;
      sendJson(res, 200, {
        success: true,
        filename,
        text: cleaned,
        wordCount: words,
        charCount: cleaned.length,
      });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message || 'Failed to parse document' });
    }
    return;
  }

  // Chat History: Clear User Active Chat
  if (pathname === '/api/chat/clear' && (req.method === 'POST' || req.method === 'DELETE')) {
    try {
      const authHeader = req.headers.authorization || '';
      const token = authHeader.replace(/^Bearer\s+/i, '').trim();
      if (!token) {
        sendJson(res, 401, { success: false, error: 'Authorization token required' });
        return;
      }
      const user = await getUserFromToken(token);
      if (!user) {
        sendJson(res, 401, { success: false, error: 'Invalid or expired token' });
        return;
      }
      await clearUserChatHistory(user.id);
      sendJson(res, 200, { success: true, message: 'Chat cleared successfully' });
    } catch (err) {
      sendJson(res, 500, { success: false, error: err.message });
    }
    return;
  }

  // ── Multi-Session Chat History Routes ──────────────────────────────────────

  // GET /api/sessions — list all sessions for the logged-in user
  if (pathname === '/api/sessions' && req.method === 'GET') {
    try {
      const user = await getUserFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '');
      if (!user) { sendJson(res, 401, { success: false, error: 'Unauthorized' }); return; }
      const sessions = await listChatSessions(user.id);
      sendJson(res, 200, { success: true, sessions });
    } catch (err) { sendJson(res, 500, { success: false, error: err.message }); }
    return;
  }

  // POST /api/sessions — save current chat as a new named session
  if (pathname === '/api/sessions' && req.method === 'POST') {
    try {
      const user = await getUserFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '');
      if (!user) { sendJson(res, 401, { success: false, error: 'Unauthorized' }); return; }
      const body = await parseBody(req);
      const sessionId = await createChatSession(user.id, {
        title: body.title || 'Untitled session',
        fileName: body.fileName || null,
        messages: body.messages || [],
        fileContext: body.fileContext || null,
        assignmentBrief: typeof body.assignmentBrief === 'string' ? body.assignmentBrief.trim() : null,
      });
      sendJson(res, 200, { success: true, sessionId });
    } catch (err) { sendJson(res, 500, { success: false, error: err.message }); }
    return;
  }

  // GET /api/sessions/:id — load full messages of a session
  const sessionLoadMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionLoadMatch && req.method === 'GET') {
    try {
      const user = await getUserFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '');
      if (!user) { sendJson(res, 401, { success: false, error: 'Unauthorized' }); return; }
      const session = await getChatSession(user.id, sessionLoadMatch[1]);
      if (!session) { sendJson(res, 404, { success: false, error: 'Session not found' }); return; }
      sendJson(res, 200, { success: true, session });
    } catch (err) { sendJson(res, 500, { success: false, error: err.message }); }
    return;
  }

  // PUT /api/sessions/:id — update (overwrite messages) of a session
  const sessionUpdateMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionUpdateMatch && req.method === 'PUT') {
    try {
      const user = await getUserFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '');
      if (!user) { sendJson(res, 401, { success: false, error: 'Unauthorized' }); return; }
      const body = await parseBody(req);
      await updateChatSession(user.id, sessionUpdateMatch[1], {
        title: body.title !== undefined ? body.title : undefined,
        fileName: body.fileName !== undefined ? body.fileName : undefined,
        messages: body.messages || [],
        fileContext: body.fileContext !== undefined ? body.fileContext : undefined,
        assignmentBrief: body.assignmentBrief !== undefined ? (typeof body.assignmentBrief === 'string' ? body.assignmentBrief.trim() : null) : undefined,
      });
      sendJson(res, 200, { success: true });
    } catch (err) { sendJson(res, 500, { success: false, error: err.message }); }
    return;
  }

  // DELETE /api/sessions/:id — delete one session
  const sessionDeleteMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
  if (sessionDeleteMatch && req.method === 'DELETE') {
    try {
      const user = await getUserFromToken(req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '');
      if (!user) { sendJson(res, 401, { success: false, error: 'Unauthorized' }); return; }
      await deleteChatSession(user.id, sessionDeleteMatch[1]);
      sendJson(res, 200, { success: true });
    } catch (err) { sendJson(res, 500, { success: false, error: err.message }); }
    return;
  }

  // Socratic Chat Stream
  if (pathname === '/api/chat/stream' && req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', async () => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      });

      const sendEvent = (event, data) => {
        res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      try {
        const payload = JSON.parse(body || '{}');
        const userPrompt = payload.prompt || '';
        const battleId = payload.battleId || '01_floating_point';
        const history = payload.messages || [];

        // ── Rate limit check (identify user by auth token or fall back to IP) ──
        const authToken = req.headers.authorization?.replace(/^Bearer\s+/i, '').trim() || '';
        let rateLimitId = req.socket.remoteAddress || 'anon';
        try {
          const rateLimitUser = await getUserFromToken(authToken);
          if (rateLimitUser?.id) rateLimitId = rateLimitUser.id;
        } catch { /* use IP fallback */ }

        const rateLimitMsg = checkRateLimit(rateLimitId);
        if (rateLimitMsg) {
          sendEvent('token', { delta: rateLimitMsg });
          sendEvent('done', {});
          res.end();
          return;
        }
        // Structural profile of the student's active spreadsheet (attached client-side).
        // Refusal guardrails run on the student's own words only — never on file content.
        const fileContext =
          typeof payload.fileContext === 'string' && payload.fileContext.trim()
            ? payload.fileContext.trim().slice(0, 8000)
            : '';
        // Assignment brief / project instructions submitted by the student.
        // This keeps Khokhi aligned to the student's actual goals for the whole session.
        // Cap matches the UI's 3000-char brief editor.
        const assignmentBrief =
          typeof payload.assignmentBrief === 'string' && payload.assignmentBrief.trim()
            ? payload.assignmentBrief.trim().slice(0, 3000)
            : '';

        // 1. Refusal Check
        sendEvent('thinking', { label: fileContext ? 'Diagnosing spreadsheet...' : 'Thinking...' });
        await new Promise((r) => setTimeout(r, 200));

        const refusal = checkRefusal(userPrompt);
        if (refusal) {
          sendEvent('refusal', { isRefusal: true });
          const words = refusal.split(' ');
          for (let i = 0; i < words.length; i++) {
            sendEvent('token', { delta: (i === 0 ? '' : ' ') + words[i] });
            await new Promise((r) => setTimeout(r, 25));
          }
          sendEvent('done', {});
          res.end();
          return;
        }

        // 2. Chat messages
        const briefBlock = assignmentBrief
          ? `\n\n[STUDENT ASSIGNMENT BRIEF]:\n${assignmentBrief}\n\nYou MUST keep this brief in active plan memory for the entire session. Always align your coaching steps, priorities, and sequence to help the student complete these assignment objectives. When they finish a step, acknowledge the progress toward the brief goals and guide them to the next one.`
          : '';
        // Context-aware mode: when no spreadsheet is loaded, Khokhi chats normally
        const noFileGuard = !fileContext
          ? `\n\nIMPORTANT — NO SPREADSHEET LOADED:\nThe student has NOT uploaded or loaded any Excel file yet. There is NO active spreadsheet context.\n- Do NOT give data-cleaning instructions, do NOT reference rows, columns, headers, or banners.\n- Do NOT treat the student's chat message as spreadsheet content.\n- Chat naturally and helpfully. Greet them, answer general data analytics questions, or guide them on how to get started.\n- Encourage them to upload their Excel spreadsheet (and optionally their assignment instructions PDF) using the attachment button (📎) in the chat input so you can start coaching them.\n- Once they upload a file, you will receive a [ACTIVE SPREADSHEET CONTEXT] block and can begin real coaching.\n- Keep it friendly, brief, and conversational.`
          : '';
        const systemMsg = `${SOCRATIC_SYSTEM_PROMPT}${briefBlock}${noFileGuard}\nActive Challenge Context: ${battleId}`;
        // File context rides with the latest user turn only (history stays clean);
        // guardrails above already screened the student's own prompt text.
        const finalUserContent = fileContext
          ? `${fileContext}\n\n[STUDENT'S MESSAGE]:\n${userPrompt}`
          : userPrompt;
        const chatMessages = [
          { role: 'system', content: systemMsg },
          // Trim history to last N turns to save input tokens (biggest cost saver)
          ...history
            .map((m) => ({ role: m.role, content: String(m.text ?? '').trim() }))
            .filter((m) => m.content.length > 0)
            .slice(-MAX_HISTORY_TURNS),
          { role: 'user', content: finalUserContent.trim() || '(no message)' },
        ];

        if (!OPENAI_API_KEY) {
          sendEvent('token', { delta: 'Error: OPENAI_API_KEY is not configured on the server. Please provide a valid key.' });
          sendEvent('done', {});
          res.end();
          return;
        }

        sendEvent('thinking', { label: 'Drafting coaching response...' });
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        try {
          const oaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              messages: chatMessages,
              stream: true,
              temperature: 0.7,
              max_tokens: 700,
            }),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          if (!oaiRes.ok) {
            const errBody = await oaiRes.text();
            throw new Error(`OpenAI API responded with status ${oaiRes.status}: ${errBody}`);
          }

          sendEvent('thinking', { label: undefined });
          const reader = oaiRes.body.getReader();
          const decoder = new TextDecoder('utf-8');
          // Carry partial lines across network chunks — OpenAI splits SSE
          // lines mid-payload all the time; dropping them loses words.
          let sseBuffer = '';
          let doneStream = false;

          while (!doneStream) {
            const { done, value } = await reader.read();
            if (done) break;
            sseBuffer += decoder.decode(value, { stream: true });
            const lines = sseBuffer.split('\n');
            sseBuffer = lines.pop() || ''; // incomplete line waits for next chunk

            for (const line of lines) {
              const clean = line.trim();
              if (!clean.startsWith('data: ')) continue;
              const rawData = clean.replace('data: ', '').trim();
              if (rawData === '[DONE]') {
                doneStream = true;
                break;
              }
              try {
                const parsed = JSON.parse(rawData);
                const delta = parsed.choices?.[0]?.delta?.content;
                if (delta) {
                  sendEvent('token', { delta });
                }
              } catch {
                // unparseable line — already buffered, shouldn't happen
              }
            }
          }
          // Flush any complete line left in the buffer
          if (sseBuffer.trim().startsWith('data: ')) {
            try {
              const parsed = JSON.parse(sseBuffer.trim().replace('data: ', ''));
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) {
                sendEvent('token', { delta });
              }
            } catch {}
          }
        } catch (oaiErr) {
          clearTimeout(timeoutId);
          console.error('OpenAI stream failed:', oaiErr.message);
          sendEvent('token', { delta: `\n\n[OpenAI Service Error: ${oaiErr.message}]` });
        }

        sendEvent('done', {});
        res.end();
      } catch (err) {
        console.error('Fatal streaming error:', err);
        sendEvent('token', { delta: `\n\n[Error: ${err.message}]` });
        sendEvent('done', {});
        res.end();
      }
    });
    return;
  }

  // ── Static file serving for production SPA ──────────────────────────
  // Serve built frontend from frontend/dist (robust to any cwd)
  const candidateDirs = [
    path.resolve(process.cwd(), 'frontend', 'dist'),
    path.resolve(process.cwd(), '..', 'frontend', 'dist'),
    path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'frontend', 'dist'),
  ];
  const STATIC_DIR = candidateDirs.find((d) => fs.existsSync(d)) || candidateDirs[0];
  if (fs.existsSync(STATIC_DIR)) {
    // Map common extensions → MIME types
    const MIME = {
      '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
      '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
      '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2',
      '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.webp': 'image/webp',
    };
    let filePath = path.join(STATIC_DIR, pathname === '/' ? 'index.html' : pathname);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
      return;
    }
    // SPA fallback — serve index.html for any unknown path (client-side routing)
    const indexPath = path.join(STATIC_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      fs.createReadStream(indexPath).pipe(res);
      return;
    }
  }

  res.writeHead(404);
  res.end('Not Found');
});

// Connect to MongoDB Atlas upon launch
connectDB().catch((e) => console.warn('connectDB initialization warning:', e.message));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend API running on http://localhost:${PORT}`);
  console.log(`AI Provider: OpenAI (gpt-4o-mini) [Strict] - Key configured: ${Boolean(OPENAI_API_KEY)}`);
});
