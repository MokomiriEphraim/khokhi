import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import {
  findUserByEmail,
  createUser,
  findUserById,
  getPendingSignup,
  savePendingSignup,
  updatePendingSignup,
  deletePendingSignup,
} from './db.mjs';
import { sendOtpEmail } from './email.mjs';

const JWT_SECRET = process.env.JWT_SECRET || 'autonomous-da-secret-jwt-key-2026';

export async function initiateSignup({ name, email, password }) {
  if (!name || !name.trim()) {
    throw new Error('Full name is required');
  }
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required');
  }
  if (!password || password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  const normalizedEmail = email.toLowerCase().trim();

  // 1. Check if user already registered
  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new Error('An account with this email address already exists. Please sign in instead.');
  }

  // 2. Check if locked due to 3 failed attempts
  const pending = await getPendingSignup(normalizedEmail);
  if (pending && pending.blockedUntil && pending.blockedUntil > Date.now()) {
    const hoursLeft = Math.ceil((pending.blockedUntil - Date.now()) / (1000 * 60 * 60));
    throw new Error(`Too many failed attempts. This email is locked for 24 hours (${hoursLeft}h remaining).`);
  }

  // 3. Generate 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  // 4. Hash password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  // 5. Save pending record with 10-minute expiry
  await savePendingSignup({
    email: normalizedEmail,
    name: name.trim(),
    passwordHash,
    otp,
    attempts: pending?.attempts && pending.blockedUntil ? 0 : (pending?.attempts || 0),
    blockedUntil: null,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  // 6. Dispatch email via Resend (greyrope.tech)
  await sendOtpEmail(normalizedEmail, otp, name.trim());

  return {
    step: 'otp_required',
    email: normalizedEmail,
    message: `Verification code sent to ${normalizedEmail}`,
  };
}

export async function resendSignupOtp({ email }) {
  if (!email || !email.includes('@')) {
    throw new Error('Valid email address is required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const pending = await getPendingSignup(normalizedEmail);

  if (!pending) {
    throw new Error('No pending registration found for this email. Please sign up again.');
  }

  if (pending.blockedUntil && pending.blockedUntil > Date.now()) {
    const hoursLeft = Math.ceil((pending.blockedUntil - Date.now()) / (1000 * 60 * 60));
    throw new Error(`This email is temporarily locked for 24 hours (${hoursLeft}h remaining).`);
  }

  // Generate new OTP & renew 10-minute expiry
  const newOtp = String(Math.floor(100000 + Math.random() * 900000));
  await updatePendingSignup(normalizedEmail, {
    otp: newOtp,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  await sendOtpEmail(normalizedEmail, newOtp, pending.name);

  return {
    success: true,
    message: `A new 6-digit code has been sent to ${normalizedEmail}`,
  };
}

export async function verifyOtpAndCreateUser({ email, otp }) {
  if (!email || !otp) {
    throw new Error('Email and 6-digit verification code are required');
  }

  const normalizedEmail = email.toLowerCase().trim();
  const cleanOtp = String(otp).trim();
  const pending = await getPendingSignup(normalizedEmail);

  if (!pending) {
    throw new Error('No pending registration found. Please start over.');
  }

  // 1. Check if 24-hour rate-limit lock is active
  if (pending.blockedUntil && pending.blockedUntil > Date.now()) {
    const hoursLeft = Math.ceil((pending.blockedUntil - Date.now()) / (1000 * 60 * 60));
    throw new Error(`Account registration locked for 24 hours after 3 failed attempts (${hoursLeft}h remaining).`);
  }

  // 2. Check expiration
  if (pending.expiresAt && pending.expiresAt < Date.now()) {
    throw new Error('Verification code has expired. Please click Resend Code.');
  }

  // 3. Verify OTP code
  if (pending.otp !== cleanOtp) {
    const newAttempts = (pending.attempts || 0) + 1;

    // Check if 3rd attempt reached -> lock for 24 hours!
    if (newAttempts >= 3) {
      const blockedUntil = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
      await updatePendingSignup(normalizedEmail, {
        attempts: newAttempts,
        blockedUntil,
      });
      throw new Error('Too many failed attempts (3/3). This email has been locked for 24 hours for security.');
    } else {
      await updatePendingSignup(normalizedEmail, { attempts: newAttempts });
      const remaining = 3 - newAttempts;
      throw new Error(`Incorrect verification code. Attempts remaining: ${remaining}/3.`);
    }
  }

  // 4. Code is correct! Create real user in MongoDB
  const user = await createUser({
    name: pending.name,
    email: pending.email,
    passwordHash: pending.passwordHash,
  });

  // 5. Clean up pending record
  await deletePendingSignup(normalizedEmail);

  // 6. Issue 30-day JWT
  const token = jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return { token, user };
}

export async function loginUser({ email, password }) {
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  const user = await findUserByEmail(email);
  if (!user) {
    throw new Error('Invalid email or password');
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);
  if (!isMatch) {
    throw new Error('Invalid email or password');
  }

  const userId = user._id ? user._id.toString() : user.id;
  const token = jwt.sign(
    { id: userId, email: user.email, name: user.name },
    JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    user: {
      id: userId,
      name: user.name,
      email: user.email,
    },
  };
}

export async function getUserFromToken(token) {
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (!decoded || !decoded.id) return null;
    const user = await findUserById(decoded.id);
    if (!user) return null;
    return {
      id: user._id ? user._id.toString() : user.id,
      name: user.name,
      email: user.email,
    };
  } catch {
    return null;
  }
}
