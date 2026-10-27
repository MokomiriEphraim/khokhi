import { MongoClient } from 'mongodb';

let client = null;
let db = null;
let isConnected = false;
let connectionError = null;
let retryTimer = null;

// Memory fallback store in case MongoDB is temporarily unreachable
const memoryUsers = new Map();
const memoryPendingSignups = new Map();
const memoryUserChats = new Map();

function getUri() {
  return process.env.MONGODB_URI || process.env.MONGO_URI || '';
}

function getDbName() {
  return process.env.MONGODB_DB || process.env.MONGO_DB || 'AutonoumousDB';
}

export async function connectDB() {
  const uri = getUri();
  const dbName = getDbName();

  if (!uri) {
    console.log('ℹ️  No MongoDB URI found in .env yet. Running with local fallback store.');
    isConnected = false;
    return null;
  }

  try {
    console.log(`Connecting to MongoDB Atlas (${dbName})...`);
    // Drop any half-open client from a previous failed attempt
    if (client && !isConnected) {
      await client.close().catch(() => {});
      client = null;
    }
    client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
    });
    await client.connect();
    db = client.db(dbName);
    isConnected = true;
    connectionError = null;
    console.log(`✅ MongoDB Atlas connected successfully to database: "${dbName}"`);

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    // Ensure unique indexes
    await db.collection('users').createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await db.collection('pending_signups').createIndex({ email: 1 }, { unique: true }).catch(() => {});
    await db.collection('user_chats').createIndex({ userId: 1 }, { unique: true }).catch(() => {});
    await db.collection('chat_sessions').createIndex({ userId: 1, sessionId: 1 }, { unique: true }).catch(() => {});
    await db.collection('chat_sessions').createIndex({ userId: 1, updatedAt: -1 }).catch(() => {});

    // Flush anything captured while we were offline so no session is lost
    try {
      for (const record of memoryUserChats.values()) {
        await db.collection('user_chats').updateOne(
          { userId: record.userId },
          { $set: record, $setOnInsert: { createdAt: record.updatedAt || new Date() } },
          { upsert: true }
        );
      }
      if (memoryUserChats.size > 0) {
        console.log(`🔄 Flushed ${memoryUserChats.size} offline chat session(s) to Atlas`);
        memoryUserChats.clear();
      }
    } catch (e) {
      console.warn('Offline chat flush failed:', e.message);
    }

    return db;
  } catch (err) {
    isConnected = false;
    connectionError = err.message;
    console.warn(`⚠️  MongoDB Atlas connection failed (${err.message}). Using local fallback store.`);

    // Self-heal: keep retrying every 30s until Atlas is reachable again
    if (!retryTimer) {
      retryTimer = setInterval(async () => {
        console.log('↻ Retrying MongoDB Atlas connection...');
        try {
          await connectDB();
        } catch {
          /* next attempt in 30s */
        }
      }, 30000);
      retryTimer.unref?.();
    }
    return null;
  }
}

export function getDBStatus() {
  const uri = getUri();
  const dbName = getDbName();
  return {
    configured: Boolean(uri),
    connected: isConnected,
    database: isConnected ? dbName : 'local_fallback',
    error: connectionError,
  };
}

export async function findUserByEmail(email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (isConnected && db) {
    try {
      return await db.collection('users').findOne({ email: normalizedEmail });
    } catch (e) {
      console.warn('MongoDB query error, checking fallback store:', e.message);
    }
  }
  return memoryUsers.get(normalizedEmail) || null;
}

export async function findUserById(id) {
  if (isConnected && db) {
    try {
      const { ObjectId } = await import('mongodb');
      return await db.collection('users').findOne({ _id: new ObjectId(id) });
    } catch {
      try {
        return await db.collection('users').findOne({ id });
      } catch {}
    }
  }
  for (const user of memoryUsers.values()) {
    if (user.id === id) return user;
  }
  return null;
}

export async function createUser({ name, email, passwordHash }) {
  const normalizedEmail = email.toLowerCase().trim();
  const now = new Date();
  const newUser = {
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: now,
    updatedAt: now,
  };

  if (isConnected && db) {
    try {
      const result = await db.collection('users').insertOne(newUser);
      return {
        id: result.insertedId.toString(),
        name: newUser.name,
        email: newUser.email,
        createdAt: newUser.createdAt,
      };
    } catch (e) {
      console.warn('MongoDB insert error, saving to memory fallback:', e.message);
    }
  }

  // Memory fallback
  const id = `usr-${Date.now()}`;
  const userRecord = { id, ...newUser };
  memoryUsers.set(normalizedEmail, userRecord);
  return {
    id,
    name: newUser.name,
    email: newUser.email,
    createdAt: newUser.createdAt,
  };
}

// -------------------------------------------------------------
// Pending Signups & 6-Digit OTP Rate-Limiting Helpers
// -------------------------------------------------------------

export async function getPendingSignup(email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (isConnected && db) {
    try {
      return await db.collection('pending_signups').findOne({ email: normalizedEmail });
    } catch (e) {
      console.warn('MongoDB query error on pending_signups:', e.message);
    }
  }
  return memoryPendingSignups.get(normalizedEmail) || null;
}

export async function savePendingSignup({ email, name, passwordHash, otp, attempts, blockedUntil, expiresAt }) {
  const normalizedEmail = email.toLowerCase().trim();
  const record = {
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    otp,
    attempts: attempts || 0,
    blockedUntil: blockedUntil || null,
    expiresAt: expiresAt || Date.now() + 10 * 60 * 1000,
    updatedAt: new Date(),
  };

  if (isConnected && db) {
    try {
      await db.collection('pending_signups').updateOne(
        { email: normalizedEmail },
        { $set: record },
        { upsert: true }
      );
      return record;
    } catch (e) {
      console.warn('MongoDB upsert error on pending_signups:', e.message);
    }
  }

  memoryPendingSignups.set(normalizedEmail, record);
  return record;
}

export async function updatePendingSignup(email, updates) {
  const normalizedEmail = email.toLowerCase().trim();
  const updateData = { ...updates, updatedAt: new Date() };

  if (isConnected && db) {
    try {
      await db.collection('pending_signups').updateOne(
        { email: normalizedEmail },
        { $set: updateData }
      );
    } catch (e) {
      console.warn('MongoDB update error on pending_signups:', e.message);
    }
  }

  const existing = memoryPendingSignups.get(normalizedEmail);
  if (existing) {
    memoryPendingSignups.set(normalizedEmail, { ...existing, ...updateData });
  }
}

export async function deletePendingSignup(email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (isConnected && db) {
    try {
      await db.collection('pending_signups').deleteOne({ email: normalizedEmail });
    } catch (e) {
      console.warn('MongoDB delete error on pending_signups:', e.message);
    }
  }
  memoryPendingSignups.delete(normalizedEmail);
}

// -------------------------------------------------------------
// User Chat Session Persistence (MongoDB Atlas: user_chats)
// -------------------------------------------------------------

export async function getUserChatHistory(userId) {
  if (!userId) return null;
  const key = String(userId);

  if (isConnected && db) {
    try {
      const record = await db.collection('user_chats').findOne({ userId: key });
      if (record) {
        return {
          userId: record.userId,
          userEmail: record.userEmail,
          battleId: record.battleId || '01_floating_point',
          messages: record.messages || [],
          auditStats: record.auditStats || null,
          fileContext: record.fileContext || null,
          contextFileName: record.contextFileName || null,
          assignmentBrief: record.assignmentBrief || null,
          updatedAt: record.updatedAt || record.createdAt,
        };
      }
    } catch (e) {
      console.warn('MongoDB query error on user_chats:', e.message);
    }
  }

  return memoryUserChats.get(key) || null;
}

export async function saveUserChatHistory(
  userId,
  { userEmail, battleId, messages, auditStats, fileContext = null, contextFileName = null, assignmentBrief = null }
) {
  if (!userId) return null;
  const key = String(userId);
  const now = new Date();

  const record = {
    userId: key,
    userEmail: userEmail || '',
    battleId: battleId || '01_floating_point',
    messages: Array.isArray(messages) ? messages : [],
    auditStats: auditStats || null,
    fileContext: fileContext || null,
    contextFileName: contextFileName || null,
    assignmentBrief: assignmentBrief || null,
    updatedAt: now,
  };

  if (isConnected && db) {
    try {
      await db.collection('user_chats').updateOne(
        { userId: key },
        {
          $set: record,
          $setOnInsert: { createdAt: now },
        },
        { upsert: true }
      );
      return record;
    } catch (e) {
      console.warn('MongoDB upsert error on user_chats:', e.message);
    }
  }

  memoryUserChats.set(key, record);
  return record;
}

export async function clearUserChatHistory(userId) {
  if (!userId) return false;
  const key = String(userId);

  if (isConnected && db) {
    try {
      await db.collection('user_chats').updateOne(
        { userId: key },
        {
          $set: {
            messages: [],
            fileContext: null,
            contextFileName: null,
            assignmentBrief: null,
            updatedAt: new Date(),
          },
        }
      );
      return true;
    } catch (e) {
      console.warn('MongoDB clear error on user_chats:', e.message);
    }
  }

  const existing = memoryUserChats.get(key);
  if (existing) {
    memoryUserChats.set(key, { ...existing, messages: [], fileContext: null, contextFileName: null, assignmentBrief: null, updatedAt: new Date() });
  }
  return true;
}

// -------------------------------------------------------------
// Multi-Session Chat History (MongoDB Atlas: chat_sessions)
// Allows a user to have many named past conversations they can
// browse, resume, and delete.
// -------------------------------------------------------------

/** In-memory fallback when MongoDB is unreachable */
const memoryChatSessions = new Map(); // key = userId, value = Session[]

function makeSessionId() {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Return all sessions for a user, newest first. Strips message bodies for
 * the list view — callers fetch the full session by ID when needed.
 */
export async function listChatSessions(userId) {
  if (!userId) return [];
  const key = String(userId);

  if (isConnected && db) {
    try {
      const sessions = await db
        .collection('chat_sessions')
        .find({ userId: key })
        .sort({ updatedAt: -1 })
        .limit(50)
        .project({ messages: 0 })
        .toArray();
      return sessions.map((s) => ({
        id: s.sessionId || String(s._id),
        title: s.title || 'Untitled session',
        fileName: s.fileName || null,
        messageCount: s.messageCount || 0,
        preview: s.preview || '',
        hasBrief: Boolean(s.assignmentBrief),
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    } catch (e) {
      console.warn('MongoDB list chat_sessions error:', e.message);
    }
  }

  const sessions = memoryChatSessions.get(key) || [];
  return sessions
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(({ messages: _m, ...rest }) => ({
      ...rest,
      hasBrief: Boolean(rest.assignmentBrief),
    }));
}

/**
 * Create a brand-new session and return its ID.
 */
export async function createChatSession(userId, { title, fileName, messages, fileContext, assignmentBrief }) {
  if (!userId) return null;
  const key = String(userId);
  const now = new Date();
  const sessionId = makeSessionId();
  const msgArray = Array.isArray(messages) ? messages : [];
  const preview = msgArray.find((m) => m.role === 'user')?.text?.slice(0, 120) || '';

  const record = {
    sessionId,
    userId: key,
    title: (title || 'Untitled session').slice(0, 200),
    fileName: fileName || null,
    fileContext: fileContext || null,
    assignmentBrief: assignmentBrief || null,
    messages: msgArray,
    messageCount: msgArray.length,
    preview,
    createdAt: now,
    updatedAt: now,
  };

  if (isConnected && db) {
    try {
      await db.collection('chat_sessions').insertOne(record);
      return sessionId;
    } catch (e) {
      console.warn('MongoDB insert chat_session error:', e.message);
    }
  }

  const sessions = memoryChatSessions.get(key) || [];
  sessions.push(record);
  memoryChatSessions.set(key, sessions);
  return sessionId;
}

/**
 * Append / overwrite a session's messages. Also updates title + preview.
 */
export async function updateChatSession(userId, sessionId, { title, fileName, messages, fileContext, assignmentBrief }) {
  if (!userId || !sessionId) return false;
  const key = String(userId);
  const now = new Date();
  const msgArray = Array.isArray(messages) ? messages : [];
  const preview = msgArray.find((m) => m.role === 'user')?.text?.slice(0, 120) || '';

  const update = {
    messages: msgArray,
    messageCount: msgArray.length,
    preview,
    updatedAt: now,
  };
  if (title) update.title = title.slice(0, 200);
  if (fileName !== undefined) update.fileName = fileName;
  if (fileContext !== undefined) update.fileContext = fileContext;
  if (assignmentBrief !== undefined) update.assignmentBrief = assignmentBrief;

  if (isConnected && db) {
    try {
      await db.collection('chat_sessions').updateOne(
        { userId: key, sessionId },
        { $set: update }
      );
      return true;
    } catch (e) {
      console.warn('MongoDB update chat_session error:', e.message);
    }
  }

  const sessions = memoryChatSessions.get(key) || [];
  const idx = sessions.findIndex((s) => s.sessionId === sessionId);
  if (idx !== -1) sessions[idx] = { ...sessions[idx], ...update };
  memoryChatSessions.set(key, sessions);
  return true;
}

/**
 * Delete a session by ID.
 */
export async function deleteChatSession(userId, sessionId) {
  if (!userId || !sessionId) return false;
  const key = String(userId);

  if (isConnected && db) {
    try {
      await db.collection('chat_sessions').deleteOne({ userId: key, sessionId });
      return true;
    } catch (e) {
      console.warn('MongoDB delete chat_session error:', e.message);
    }
  }

  const sessions = memoryChatSessions.get(key) || [];
  memoryChatSessions.set(key, sessions.filter((s) => s.sessionId !== sessionId));
  return true;
}

/**
 * Load the full messages for one session.
 */
export async function getChatSession(userId, sessionId) {
  if (!userId || !sessionId) return null;
  const key = String(userId);

  if (isConnected && db) {
    try {
      const doc = await db.collection('chat_sessions').findOne({ userId: key, sessionId });
      if (doc) {
        return {
          id: doc.sessionId,
          title: doc.title,
          fileName: doc.fileName || null,
          fileContext: doc.fileContext || null,
          assignmentBrief: doc.assignmentBrief || null,
          messages: doc.messages || [],
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
        };
      }
    } catch (e) {
      console.warn('MongoDB get chat_session error:', e.message);
    }
  }

  const sessions = memoryChatSessions.get(key) || [];
  const s = sessions.find((x) => x.sessionId === sessionId);
  return s
    ? {
        id: s.sessionId,
        title: s.title,
        fileName: s.fileName,
        fileContext: s.fileContext,
        assignmentBrief: s.assignmentBrief || null,
        messages: s.messages || [],
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }
    : null;
}
