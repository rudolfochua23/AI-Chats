const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('node:path');
const crypto = require('node:crypto');

const db = require('./db');
const storage = require('./storage');
const xendit = require('./xendit');
const adminDb = require('./admin-db');
const adminRouter = require('./admin-routes');

let nodemailer;
try { nodemailer = require('nodemailer'); } catch { nodemailer = null; }

const app = express();
const PORT = Number(process.env.PORT || 4173);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const DEFAULT_SESSION_SECRET = 'replace-this-session-secret-in-production';
const SESSION_SECRET = process.env.SESSION_SECRET || DEFAULT_SESSION_SECRET;
const COOKIE_SECURE = process.env.COOKIE_SECURE
  ? process.env.COOKIE_SECURE === 'true'
  : IS_PRODUCTION;
const COOKIE_DOMAIN = process.env.COOKIE_DOMAIN || undefined;
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const LOGIN_LOCK_BASE_MS = 30 * 1000;
const LOGIN_LOCK_MAX_MS = 10 * 60 * 1000;
const VERIFICATION_TTL_MS = 15 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER || 'noreply@localhost';
const APP_URL = process.env.APP_URL || `http://localhost:${PORT}`;
const COOKIE_NAME = 'chatpile_sid';
const PASSWORD_MAX_LENGTH = 256;
const INITIAL_ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || 'admin@localhost';
const INITIAL_ADMIN_USERNAME = process.env.APP_ADMIN_USERNAME || 'admin';

if (IS_PRODUCTION && SESSION_SECRET === DEFAULT_SESSION_SECRET) {
  console.error('SESSION_SECRET must be set in production.');
  process.exit(1);
}

// Periodic cleanup of expired auth state (every 15 min)
setInterval(() => { db.cleanupExpiredAuthState().catch((e) => console.error('Auth cleanup error:', e.message)); }, 15 * 60 * 1000);

// Periodic cleanup of stale API key rate limit entries (every 5 min)
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of apiKeyRateLimit) {
    if (now - entry.windowStart > API_KEY_RATE_WINDOW_MS * 2) apiKeyRateLimit.delete(key);
  }
}, 5 * 60 * 1000);

// API key rate limiter (in-memory is fine — this is throughput control, not security state)
const apiKeyRateLimit = new Map();
const API_KEY_RATE_WINDOW_MS = 60 * 1000; // 1 minute
const API_KEY_RATE_MAX = 30; // 30 requests per minute per key

function checkApiKeyRateLimit(apiKey) {
  const now = Date.now();
  const entry = apiKeyRateLimit.get(apiKey);
  if (!entry || now - entry.windowStart > API_KEY_RATE_WINDOW_MS) {
    apiKeyRateLimit.set(apiKey, { windowStart: now, count: 1 });
    return true;
  }
  entry.count++;
  return entry.count <= API_KEY_RATE_MAX;
}

// ─── Express setup ────────────────────────────────────────────────────────────

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "blob:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));
// Xendit webhook — needs raw body for signature verification, BEFORE express.json()
app.post('/api/webhook/xendit', express.json({ limit: '1mb' }), async (req, res) => {
  const callbackToken = req.headers['x-callback-token'];
  if (!xendit.verifyWebhook(callbackToken)) {
    res.status(401).json({ ok: false, error: 'Invalid callback token' });
    return;
  }

  const event = req.headers['x-callback-event'] || req.body.event || '';
  const data = req.body.data || req.body;

  try {
    const planId = data.plan_id || data.id;
    if (!planId) { res.json({ ok: true }); return; }

    const user = await db.findUserByXenditPlanId(planId);
    if (!user) { console.log(`Webhook: no user for plan ${planId}`); res.json({ ok: true }); return; }

    if (event === 'recurring.plan.activated' || event === 'recurring.cycle.succeeded') {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const tier = user.storage_tier || 1;
      await db.updateSubscription(user.id, {
        status: 'active',
        expiresAt: nextMonth.toISOString(),
        storageTier: tier,
      });
      const eventType = event === 'recurring.plan.activated' ? 'activated' : 'payment_succeeded';
      await adminDb.logSubscriptionEvent(user.id, {
        eventType, storageTier: tier,
        amountCents: db.priceForTier(tier),
        currency: xendit.PLAN_CURRENCY,
        metadata: { planId: planId, xenditEvent: event },
      }).catch(e => console.error('Event log error:', e.message));
      console.log(`Webhook: upgraded user ${user.email} to premium (tier ${tier}, ${tier * 5} GB)`);
    } else if (event === 'recurring.plan.inactivated') {
      await db.updateSubscription(user.id, { status: 'cancelled' });
      await adminDb.logSubscriptionEvent(user.id, {
        eventType: 'cancelled',
        storageTier: user.storage_tier,
        metadata: { planId: planId, xenditEvent: event },
      }).catch(e => console.error('Event log error:', e.message));
      console.log(`Webhook: cancelled subscription for ${user.email}`);
    } else if (event === 'recurring.cycle.failed') {
      await db.updateSubscription(user.id, { status: 'past_due' });
      await adminDb.logSubscriptionEvent(user.id, {
        eventType: 'payment_failed',
        storageTier: user.storage_tier,
        metadata: { planId: planId, xenditEvent: event },
      }).catch(e => console.error('Event log error:', e.message));
      console.log(`Webhook: payment failed for ${user.email}`);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.status(500).json({ ok: false });
  }
});

app.use(express.json({ limit: '10mb' }));
app.use(session({
  name: COOKIE_NAME,
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE,
    ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
    maxAge: SESSION_TTL_MS,
  },
}));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowLocalOrigin = typeof origin === 'string'
    && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin);

  if (allowLocalOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-API-Key');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  }

  if (req.method === 'OPTIONS') { res.sendStatus(204); return; }
  next();
});

// ─── Rate limiting ────────────────────────────────────────────────────────────

function getClientIp(req) {
  // trust proxy is set, so req.ip already handles X-Forwarded-For
  return req.ip || 'unknown';
}

async function getLockState(ip) {
  const row = await db.getLoginAttempts(ip);
  if (!row) return { failedCount: 0, lockUntil: 0, locked: false, lockedForSeconds: 0 };
  const lockUntilMs = new Date(row.lock_until).getTime();
  const remainingMs = lockUntilMs - Date.now();
  return { failedCount: row.failed_count, lockUntil: lockUntilMs, locked: remainingMs > 0, lockedForSeconds: Math.ceil(Math.max(0, remainingMs) / 1000) };
}

async function registerFailedAttempt(ip) {
  const row = await db.getLoginAttempts(ip);
  const failedCount = (row?.failed_count || 0) + 1;
  let lockUntil = 0;
  if (failedCount >= 3) {
    const exponent = Math.max(0, failedCount - 3);
    lockUntil = Date.now() + Math.min(LOGIN_LOCK_MAX_MS, LOGIN_LOCK_BASE_MS * Math.pow(2, exponent));
  }
  await db.registerFailedLogin(ip, failedCount, lockUntil);
}

async function clearAttempts(ip) { await db.clearLoginAttempts(ip); }

// ─── Password helpers ─────────────────────────────────────────────────────────

function derivePasswordHash(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) { reject(error); return; }
      resolve(key.toString('hex'));
    });
  });
}

function constantTimeEqualHex(leftHex, rightHex) {
  const left = Buffer.from(leftHex, 'hex');
  const right = Buffer.from(rightHex, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

async function verifyPassword(password, user) {
  const hash = await derivePasswordHash(password, user.salt);
  return constantTimeEqualHex(hash, user.hash);
}

// ─── Seed admin ──────────────────────────────────────────────────────────────

async function seedAdmin() {
  const existing = await db.findUserByEmail(INITIAL_ADMIN_EMAIL);
  if (existing) return;

  const initialPassword = process.env.APP_ADMIN_PASSWORD;
  if (!initialPassword) {
    console.error('APP_ADMIN_PASSWORD must be set to seed the initial admin account.');
    process.exit(1);
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await derivePasswordHash(initialPassword, salt);
  await db.createUser({
    email: INITIAL_ADMIN_EMAIL,
    username: INITIAL_ADMIN_USERNAME,
    salt, hash,
    verified: true,
    role: 'admin',
  });
  console.log(`Admin seeded: ${INITIAL_ADMIN_EMAIL}`);
}

// ─── Email helper ─────────────────────────────────────────────────────────────

// Reuse a single SMTP transport (avoid creating per-email)
let smtpTransport = null;
function getSmtpTransport() {
  if (!smtpTransport && nodemailer && SMTP_HOST) {
    smtpTransport = nodemailer.createTransport({
      host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return smtpTransport;
}

async function sendEmail({ to, subject, text }) {
  const transport = getSmtpTransport();
  if (!transport) {
    console.log(`\n[EMAIL - no SMTP configured]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: SMTP_FROM, to, subject, text });
}

function generateVerificationCode() { return String(crypto.randomInt(100000, 999999)); }
function generateResetToken() { return crypto.randomBytes(32).toString('hex'); }

// ─── Auth middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  if (!req.session?.user) { res.status(401).json({ ok: false, error: 'Unauthorized' }); return; }
  next();
}

// ─── Auth routes ──────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => res.json({ ok: true, status: 'healthy' }));

app.get('/api/auth/session', (req, res) => {
  res.json({
    authenticated: Boolean(req.session?.user),
    email: req.session?.user?.email || null,
    username: req.session?.user?.username || null,
    role: req.session?.user?.role || null,
  });
});

app.post('/api/auth/login', async (req, res) => {
  const ip = getClientIp(req);
  try {
    const lock = await getLockState(ip);
    if (lock.locked) {
      res.status(429).json({ ok: false, error: 'Too many failed attempts.', lockedForSeconds: lock.lockedForSeconds });
      return;
    }

    const { email, password } = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string') {
      res.status(400).json({ ok: false, error: 'Invalid login payload.' });
      return;
    }

    const user = await db.findUserByEmail(email.trim());
    const fail = async () => {
      await registerFailedAttempt(ip);
      const state = await getLockState(ip);
      res.status(401).json({ ok: false, error: 'Invalid credentials.', lockedForSeconds: state.locked ? state.lockedForSeconds : 0 });
    };

    if (!user || !user.verified) { await fail(); return; }
    if (!(await verifyPassword(password, user))) { await fail(); return; }

    await clearAttempts(ip);
    // Regenerate session to prevent session fixation attacks
    const userData = { userId: user.id, email: user.email, username: user.username, tier: user.tier, role: user.role };
    await new Promise((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) { reject(err); return; }
        req.session.user = userData;
        resolve();
      });
    });
    res.json({ ok: true, email: user.email, username: user.username, tier: user.tier });
  } catch (e) {
    console.error('Login error:', e.message);
    res.status(500).json({ ok: false, error: 'Authentication failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) console.error('Session destroy error:', err.message);
    res.clearCookie(COOKIE_NAME);
    res.json({ ok: true });
  });
});

app.post('/api/auth/register', async (req, res) => {
  const { email, username, password } = req.body || {};
  if (typeof email !== 'string' || typeof username !== 'string' || typeof password !== 'string') {
    res.status(400).json({ ok: false, error: 'Invalid payload.' }); return;
  }

  const emailNorm = email.trim().toLowerCase();
  const usernameTrim = username.trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailNorm)) { res.status(400).json({ ok: false, error: 'Invalid email address.' }); return; }
  if (!/^[a-zA-Z0-9_-]{3,30}$/.test(usernameTrim)) { res.status(400).json({ ok: false, error: 'Username must be 3–30 characters (letters, numbers, _ or -).' }); return; }
  if (password.length < 12) { res.status(400).json({ ok: false, error: 'Password must be at least 12 characters.' }); return; }
  if (password.length > PASSWORD_MAX_LENGTH) { res.status(400).json({ ok: false, error: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.` }); return; }

  try {
    const existing = await db.findUserByEmail(emailNorm);
    if (existing && existing.verified) { res.json({ ok: true }); return; }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derivePasswordHash(password, salt);
    const code = generateVerificationCode();

    await db.setPendingVerification(emailNorm, { code, username: usernameTrim, salt, hash, expiresAt: Date.now() + VERIFICATION_TTL_MS });

    await sendEmail({
      to: emailNorm,
      subject: 'Your ChatPile App verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not register for ChatPile App, ignore this email.`,
    });
    res.json({ ok: true });
  } catch (e) {
    console.error('Registration error:', e.message);
    res.status(500).json({ ok: false, error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { email, code } = req.body || {};
  if (typeof email !== 'string' || typeof code !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }

  const emailNorm = email.trim().toLowerCase();
  const pending = await db.getPendingVerification(emailNorm);

  if (!pending) {
    res.status(400).json({ ok: false, error: 'Verification code expired or not found. Please register again.' }); return;
  }
  if (pending.attempts >= 5) {
    await db.deletePendingVerification(emailNorm);
    res.status(400).json({ ok: false, error: 'Too many failed attempts. Please register again.' }); return;
  }
  const codeA = Buffer.from(pending.code);
  const codeB = Buffer.from(code.trim());
  if (codeA.length !== codeB.length || !crypto.timingSafeEqual(codeA, codeB)) {
    await db.incrementVerificationAttempts(emailNorm);
    res.status(400).json({ ok: false, error: 'Incorrect verification code.' }); return;
  }

  try {
    const newUser = await db.createUser({
      email: emailNorm,
      username: pending.username,
      salt: pending.salt,
      hash: pending.hash,
      verified: true,
      role: 'user',
    });
    await db.deletePendingVerification(emailNorm);

    req.session.user = { userId: newUser.id, email: newUser.email, username: newUser.username, tier: newUser.tier || 'free', role: newUser.role || 'user' };
    res.json({ ok: true, email: newUser.email, username: newUser.username });
  } catch (e) {
    console.error('Verify-email error:', e.message);
    res.status(500).json({ ok: false, error: 'Verification failed. Please try again.' });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  const emailNorm = email.trim().toLowerCase();
  const pending = await db.getPendingVerification(emailNorm);
  res.json({ ok: true });
  if (!pending) return;

  const code = generateVerificationCode();
  await db.setPendingVerification(emailNorm, { code, username: pending.username, salt: pending.salt, hash: pending.hash, expiresAt: Date.now() + VERIFICATION_TTL_MS });
  try {
    await sendEmail({ to: emailNorm, subject: 'Your ChatPile App verification code', text: `Your new verification code is: ${code}\n\nThis code expires in 15 minutes.` });
  } catch (e) { console.error('Resend verification email error:', e.message); }
});

app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  const emailNorm = email.trim().toLowerCase();
  res.json({ ok: true });

  try {
    const user = await db.findUserByEmail(emailNorm);
    if (!user || !user.verified) return;
    const token = generateResetToken();
    await db.setPasswordResetToken(token, { email: emailNorm, userId: user.id, expiresAt: Date.now() + RESET_TTL_MS });
    await sendEmail({
      to: emailNorm, subject: 'Reset your ChatPile App password',
      text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${APP_URL}/?reset=${token}\n\nIf you did not request this, ignore this email.`,
    });
  } catch (e) { console.error('Forgot-password email error:', e.message); }
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== 'string' || typeof newPassword !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  if (newPassword.length < 12) { res.status(400).json({ ok: false, error: 'Password must be at least 12 characters.' }); return; }
  if (newPassword.length > PASSWORD_MAX_LENGTH) { res.status(400).json({ ok: false, error: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.` }); return; }

  const entry = await db.getPasswordResetToken(token);
  if (!entry) {
    res.status(400).json({ ok: false, error: 'Reset link expired or invalid. Please request a new one.' }); return;
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derivePasswordHash(newPassword, salt);
    await db.updateUserPassword(entry.user_id, salt, hash);
    await db.deletePasswordResetToken(token);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'Password reset failed. Please try again.' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  if (newPassword.length < 12) { res.status(400).json({ ok: false, error: 'New password must be at least 12 characters.' }); return; }
  if (newPassword.length > PASSWORD_MAX_LENGTH) { res.status(400).json({ ok: false, error: `Password must not exceed ${PASSWORD_MAX_LENGTH} characters.` }); return; }
  if (currentPassword === newPassword) { res.status(400).json({ ok: false, error: 'New password must be different from current password.' }); return; }

  try {
    const user = await db.findUserById(req.session.user.userId);
    if (!user) { res.status(404).json({ ok: false, error: 'User not found.' }); return; }
    if (!(await verifyPassword(currentPassword, user))) { res.status(401).json({ ok: false, error: 'Current password is incorrect.' }); return; }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derivePasswordHash(newPassword, salt);
    await db.updateUserPassword(user.id, salt, hash);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'Unable to change password.' });
  }
});

app.get('/api/auth/api-key', requireAuth, async (req, res) => {
  try {
    const apiKey = await db.getApiKey(req.session.user.userId);
    res.json({ ok: true, apiKey });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to get API key.' });
  }
});

app.post('/api/auth/regenerate-api-key', requireAuth, async (req, res) => {
  try {
    const apiKey = await db.updateUserApiKey(req.session.user.userId);
    res.json({ ok: true, apiKey });
  } catch {
    res.status(500).json({ ok: false, error: 'Failed to regenerate API key.' });
  }
});

// ─── Subscription API ─────────────────────────────────────────────────────────

app.post('/api/subscription/create', requireAuth, async (req, res) => {
  if (!xendit.isConfigured()) {
    res.status(503).json({ ok: false, error: 'Payment gateway not configured.' });
    return;
  }

  try {
    const user = await db.getUserAccount(req.session.user.userId);
    if (user.tier === 'premium' && user.subscription_status === 'active') {
      res.status(400).json({ ok: false, error: 'You already have an active premium subscription.' });
      return;
    }

    // If there's an existing plan, check its state
    if (user.xendit_plan_id) {
      try {
        const existing = await xendit.getPlan(user.xendit_plan_id);
        if (existing.status === 'ACTIVE') {
          const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth() + 1);
          const tier = user.storage_tier || 1;
          await db.updateSubscription(user.id, { status: 'active', expiresAt: nextMonth.toISOString(), storageTier: tier });
          res.json({ ok: true, tier: 'premium' });
          return;
        }
      } catch (e) { console.log('Existing plan check failed:', e.message); }
      // Deactivate any stale/pending/expired plan before creating fresh
      try { await xendit.deactivatePlan(user.xendit_plan_id); } catch (e) { console.log('Plan deactivation skipped:', e.message); }
    }

    const customer = await xendit.getOrCreateCustomer({ userId: user.id, email: user.email, username: user.username });
    if (!customer?.id) {
      res.status(500).json({ ok: false, error: 'Failed to create payment customer.' });
      return;
    }

    // New subscribers start at tier 1 ($2/mo for 5 GB)
    const initialTier = 1;
    const plan = await xendit.createRecurringPlan({
      customerId: customer.id,
      userId: user.id,
      email: user.email,
      amount: db.priceForTier(initialTier),
      returnUrl: `${APP_URL}/?subscription=success`,
      cancelUrl: `${APP_URL}/?subscription=cancelled`,
    });

    await db.updateSubscription(user.id, {
      xenditPlanId: plan.id,
      status: 'pending',
    });
    await adminDb.logSubscriptionEvent(user.id, {
      eventType: 'created', storageTier: initialTier,
      amountCents: db.priceForTier(initialTier),
      currency: xendit.PLAN_CURRENCY,
      metadata: { planId: plan.id },
    }).catch(e => console.error('Event log error:', e.message));

    const payUrl = plan.actions?.find(a => a.action === 'AUTH')?.url
      || plan.actions?.find(a => a.url_type === 'WEB')?.url
      || plan.actions?.[0]?.url;

    res.json({ ok: true, planId: plan.id, approvalUrl: payUrl });
  } catch (e) {
    console.error('Subscription create error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to create subscription.' });
  }
});

app.post('/api/subscription/activate', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserAccount(req.session.user.userId);
    if (!user.xendit_plan_id) {
      res.status(400).json({ ok: false, error: 'No pending subscription found.' });
      return;
    }

    const plan = await xendit.getPlan(user.xendit_plan_id);
    if (plan.status === 'ACTIVE') {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const tier = user.storage_tier || 1;
      await db.updateSubscription(user.id, {
        status: 'active',
        expiresAt: nextMonth.toISOString(),
        storageTier: tier,
      });
      res.json({ ok: true, tier: 'premium' });
    } else {
      res.json({ ok: true, status: plan.status });
    }
  } catch (e) {
    console.error('Subscription activate error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to activate subscription.' });
  }
});

app.post('/api/subscription/cancel', requireAuth, async (req, res) => {
  try {
    const user = await db.getUserAccount(req.session.user.userId);
    if (!user.xendit_plan_id || user.subscription_status !== 'active') {
      res.status(400).json({ ok: false, error: 'No active subscription to cancel.' });
      return;
    }

    await xendit.deactivatePlan(user.xendit_plan_id);
    await db.updateSubscription(user.id, { status: 'cancelled' });
    await adminDb.logSubscriptionEvent(user.id, {
      eventType: 'cancelled', storageTier: user.storage_tier,
      metadata: { planId: user.xendit_plan_id },
    }).catch(e => console.error('Event log error:', e.message));

    res.json({ ok: true, expiresAt: user.subscription_expires_at });
  } catch (e) {
    console.error('Subscription cancel error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to cancel subscription.' });
  }
});

app.post('/api/subscription/upgrade-storage', requireAuth, async (req, res) => {
  if (!xendit.isConfigured()) {
    res.status(503).json({ ok: false, error: 'Payment gateway not configured.' });
    return;
  }

  try {
    const user = await db.getUserAccount(req.session.user.userId);
    if (user.tier !== 'premium' || user.subscription_status !== 'active') {
      res.status(400).json({ ok: false, error: 'You need an active premium subscription to upgrade storage.' });
      return;
    }

    const currentTier = user.storage_tier || 1;
    if (currentTier >= db.MAX_STORAGE_TIER) {
      res.status(400).json({ ok: false, error: `Maximum storage tier reached (${currentTier * 5} GB).` });
      return;
    }

    // Only allow upgrade when storage usage is at 80% or above
    const used = Number(user.storage_used_bytes) || 0;
    const limit = Number(user.storage_limit_bytes) || 0;
    if (limit > 0 && used / limit < 0.8) {
      const pct = Math.round((used / limit) * 100);
      res.status(400).json({ ok: false, error: `Storage is only ${pct}% full. You can upgrade when usage reaches 80%.` });
      return;
    }

    const newTier = currentTier + 1;
    const newAmount = db.priceForTier(newTier);

    // Update the recurring plan amount at Xendit for next billing cycle
    await xendit.updatePlanAmount(user.xendit_plan_id, newAmount);

    // Immediately increase the user's storage limit
    await db.updateSubscription(user.id, { storageTier: newTier });
    await adminDb.logSubscriptionEvent(user.id, {
      eventType: 'upgraded', storageTier: newTier,
      amountCents: newAmount,
      currency: xendit.PLAN_CURRENCY,
      metadata: { planId: user.xendit_plan_id, previousTier: currentTier },
    }).catch(e => console.error('Event log error:', e.message));

    res.json({
      ok: true,
      storageTier: newTier,
      storageLimitBytes: db.storageBytesForTier(newTier),
      monthlyPriceCents: newAmount,
    });
  } catch (e) {
    console.error('Storage upgrade error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to upgrade storage. Please try again.' });
  }
});

// ─── Conversation API ─────────────────────────────────────────────────────────

app.post('/api/conversations', async (req, res) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey) { res.status(401).json({ ok: false, error: 'Missing API key.' }); return; }
  if (!checkApiKeyRateLimit(apiKey)) { res.status(429).json({ ok: false, error: 'Rate limit exceeded. Max 30 requests per minute.' }); return; }

  const user = await db.findUserByApiKey(apiKey);
  if (!user) { res.status(401).json({ ok: false, error: 'Invalid API key. Check Settings for your key.' }); return; }

  const { id, title, platform, url, captured, messages, attachments } = req.body || {};
  if (!id || !title || !Array.isArray(messages) || !messages.length) {
    res.status(400).json({ ok: false, error: 'Missing required fields: id, title, messages[].' }); return;
  }

  // Resolve live account state (handles lazy subscription expiry)
  const account = await db.getUserAccount(user.id);
  const isFreeTier = !account || account.tier === 'free';
  const hasActiveSubscription = account && account.subscription_status === 'active';
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;

  // Strict tier gate: reject all file uploads for free-tier API keys upfront
  if (hasAttachments && isFreeTier) {
    // Still save the conversation text, but refuse all files
    try {
      const result = await db.upsertConversation({
        userId: user.id, id, title,
        platform: platform || 'unknown',
        url: url || null,
        captured: captured || new Date().toISOString(),
        messages,
      });
      res.json({
        ok: true, ...result,
        savedAttachments: 0,
        filesRejected: true,
        filesRejectedReason: 'File and media uploads require a Premium subscription. Upgrade in Settings to start saving attachments.',
      });
    } catch (e) {
      console.error('Upsert error:', e.message);
      res.status(500).json({ ok: false, error: 'Failed to save conversation.' });
    }
    return;
  }

  try {
    const result = await db.upsertConversation({
      userId: user.id, id, title,
      platform: platform || 'unknown',
      url: url || null,
      captured: captured || new Date().toISOString(),
      messages,
    });

    // Process attachments (only for premium users with active subscriptions)
    let savedAttachments = 0;
    const skippedAttachments = [];
    let addedBytes = 0;

    if (hasAttachments && hasActiveSubscription) {
      // Fetch current storage usage for accurate quota check
      const storageLimit = Number(account.storage_limit_bytes) || 0;
      const storageUsed = Number(account.storage_used_bytes) || 0;

      for (const att of attachments) {
        if (!att.fileName || !att.mimeType || !att.data) continue;

        // Storage quota check (tracks bytes added in this request to avoid stale data)
        const estimatedSize = Buffer.byteLength(att.data, 'base64');
        if (storageLimit > 0 && storageUsed + addedBytes + estimatedSize > storageLimit) {
          skippedAttachments.push({ fileName: att.fileName, reason: 'quota_exceeded' });
          continue;
        }

        const safeName = path.basename(att.fileName).slice(0, 255) || 'unnamed';
        const buffer = Buffer.from(att.data, 'base64');
        const { storagePath, fileSize, fileCategory } = await storage.uploadFile({
          userId: user.id, conversationId: id,
          fileName: safeName, mimeType: att.mimeType, buffer,
        });

        await db.createAttachment({
          conversationId: id, userId: user.id,
          messageIndex: att.messageIndex ?? 0,
          fileName: safeName, fileType: att.mimeType,
          fileCategory, fileSize, storagePath,
        });

        await db.addStorageUsed(user.id, fileSize);
        addedBytes += fileSize;
        savedAttachments++;
      }
    } else if (hasAttachments && !hasActiveSubscription) {
      // Premium user but subscription lapsed (cancelled/past_due/pending)
      skippedAttachments.push(...attachments
        .filter(a => a.fileName)
        .map(a => ({ fileName: a.fileName, reason: 'subscription_inactive' })));
    }

    const response = { ok: true, ...result, savedAttachments };
    if (skippedAttachments.length > 0) {
      response.skippedAttachments = skippedAttachments;
      const quotaSkipped = skippedAttachments.filter(s => s.reason === 'quota_exceeded');
      const inactiveSkipped = skippedAttachments.filter(s => s.reason === 'subscription_inactive');
      if (quotaSkipped.length > 0) {
        response.quotaWarning = `${quotaSkipped.length} file(s) skipped — storage quota exceeded. Upgrade your storage in Settings.`;
      }
      if (inactiveSkipped.length > 0) {
        response.subscriptionWarning = `${inactiveSkipped.length} file(s) skipped — subscription is not active. Reactivate in Settings to resume saving files.`;
      }
    }
    res.json(response);
  } catch (e) {
    console.error('Upsert error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to save conversation.' });
  }
});

app.get('/api/conversations', requireAuth, async (req, res) => {
  const { platform, q, limit, offset } = req.query;
  try {
    const result = await db.listConversations({
      userId: req.session.user.userId,
      platform: platform || 'all',
      query: q || '',
      limit: Math.min(Number(limit) || 200, 500),
      offset: Number(offset) || 0,
    });
    res.json(result);
  } catch (e) {
    console.error('List error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to list conversations.' });
  }
});

app.get('/api/conversations/:id', requireAuth, async (req, res) => {
  try {
    const conversation = await db.getConversation(req.session.user.userId, req.params.id);
    if (!conversation) { res.status(404).json({ ok: false, error: 'Conversation not found.' }); return; }
    res.json(conversation);
  } catch (e) {
    console.error('Get error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to get conversation.' });
  }
});

app.delete('/api/conversations/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.session.user.userId;
    // Clean up S3 files and storage accounting
    const attachments = await db.getConversationAttachmentPaths(userId, req.params.id);
    const totalSize = attachments.reduce((sum, a) => sum + Number(a.file_size), 0);
    await storage.deleteConversationFiles(userId, req.params.id);
    await db.deleteConversation(userId, req.params.id);
    if (totalSize > 0) await db.subtractStorageUsed(userId, totalSize);
    res.json({ ok: true });
  } catch (e) {
    console.error('Delete error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to delete conversation.' });
  }
});

// Serve attachment files (session auth, scoped to user)
app.get('/api/files/:attachmentId', requireAuth, async (req, res) => {
  try {
    const attachment = await db.getAttachment(req.session.user.userId, req.params.attachmentId);
    if (!attachment) { res.status(404).json({ ok: false, error: 'File not found.' }); return; }

    const file = await storage.getFile(attachment.storage_path);
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    const safeName = attachment.file_name.replace(/["\\\r\n]/g, '_');
    res.set('Content-Disposition', `inline; filename="${safeName}"`);
    if (file.contentLength) res.set('Content-Length', String(file.contentLength));
    file.stream.pipe(res);
  } catch (e) {
    console.error('File serve error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to serve file.' });
  }
});

// Account info (session auth)
app.get('/api/account', requireAuth, async (req, res) => {
  try {
    const account = await db.getUserAccount(req.session.user.userId);
    if (!account) { res.status(404).json({ ok: false, error: 'Account not found.' }); return; }
    res.json(account);
  } catch (e) {
    res.status(500).json({ ok: false, error: 'Failed to get account.' });
  }
});

app.get('/api/stats', requireAuth, async (req, res) => {
  try {
    res.json(await db.getStats(req.session.user.userId));
  } catch (e) {
    console.error('Stats error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to get stats.' });
  }
});

app.get('/api/search', requireAuth, async (req, res) => {
  const { q, limit } = req.query;
  if (!q) { res.status(400).json({ ok: false, error: 'Query parameter q is required.' }); return; }
  try {
    const results = await db.searchMessages(req.session.user.userId, q, { limit: Math.min(Number(limit) || 50, 200) });
    res.json({ results });
  } catch (e) {
    console.error('Search error:', e.message);
    res.status(500).json({ ok: false, error: 'Search failed.' });
  }
});

// ─── Admin Routes ──────────────────────────────────────────────────────────

app.use('/api/admin', adminRouter);

// ─── User Ticket Routes ───────────────────────────────────────────────────

app.post('/api/tickets', requireAuth, async (req, res) => {
  const { subject, description, priority, attachments: atts } = req.body || {};
  if (!subject || typeof subject !== 'string' || !description || typeof description !== 'string') {
    return res.status(400).json({ ok: false, error: 'Subject and description are required.' });
  }
  if (subject.length > 200) return res.status(400).json({ ok: false, error: 'Subject must be under 200 characters.' });
  if (description.length > 5000) return res.status(400).json({ ok: false, error: 'Description must be under 5000 characters.' });

  try {
    const ticket = await adminDb.createTicket(req.session.user.userId, {
      subject: subject.trim(),
      description: description.trim(),
      priority: ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium',
    });

    // Process screenshot attachments (base64)
    if (Array.isArray(atts)) {
      for (const att of atts.slice(0, 5)) {
        if (!att.fileName || !att.data) continue;
        const safeName = path.basename(att.fileName).slice(0, 255) || 'screenshot.png';
        const buffer = Buffer.from(att.data, 'base64');
        if (buffer.length > 10 * 1024 * 1024) continue; // 10MB max

        const storagePath = storage.buildTicketStoragePath(ticket.id, safeName);
        await storage.uploadTicketFile({ storagePath, buffer, mimeType: att.mimeType || 'image/png', fileName: safeName });
        await adminDb.createTicketAttachment({
          ticketId: ticket.id, ticketMessageId: null, userId: req.session.user.userId,
          fileName: safeName, fileType: att.mimeType || 'image/png', fileSize: buffer.length, storagePath,
        });
      }
    }

    res.json({ ok: true, ticket });
  } catch (e) {
    console.error('Create ticket error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to create ticket.' });
  }
});

app.get('/api/tickets', requireAuth, async (req, res) => {
  try {
    const tickets = await adminDb.listUserTickets(req.session.user.userId, {
      limit: Math.min(Number(req.query.limit) || 20, 100),
      offset: Number(req.query.offset) || 0,
    });
    res.json({ ok: true, tickets });
  } catch (e) {
    console.error('List tickets error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to list tickets.' });
  }
});

app.get('/api/tickets/:id', requireAuth, async (req, res) => {
  try {
    const ticket = await adminDb.getTicket(req.params.id);
    if (!ticket || ticket.user_id !== req.session.user.userId) {
      return res.status(404).json({ ok: false, error: 'Ticket not found.' });
    }
    const messages = await adminDb.getTicketMessages(req.params.id);
    const attachments = await adminDb.getTicketAttachments(req.params.id);
    res.json({ ok: true, ticket, messages, attachments });
  } catch (e) {
    console.error('Get ticket error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to get ticket.' });
  }
});

app.post('/api/tickets/:id/messages', requireAuth, async (req, res) => {
  const { message, attachments: atts } = req.body || {};
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ ok: false, error: 'Message is required.' });
  }
  if (message.length > 5000) return res.status(400).json({ ok: false, error: 'Message must be under 5000 characters.' });

  try {
    const ticket = await adminDb.getTicket(req.params.id);
    if (!ticket || ticket.user_id !== req.session.user.userId) {
      return res.status(404).json({ ok: false, error: 'Ticket not found.' });
    }
    if (ticket.status === 'closed') {
      return res.status(400).json({ ok: false, error: 'Cannot reply to a closed ticket.' });
    }

    const ticketMsg = await adminDb.addTicketMessage(req.params.id, req.session.user.userId, {
      message, isAdmin: false,
    });

    const savedAttachments = [];
    if (Array.isArray(atts)) {
      for (const att of atts.slice(0, 5)) {
        if (!att.fileName || !att.data) continue;
        const safeName = path.basename(att.fileName).slice(0, 255) || 'screenshot.png';
        const buffer = Buffer.from(att.data, 'base64');
        if (buffer.length > 10 * 1024 * 1024) continue;

        const storagePath = storage.buildTicketStoragePath(req.params.id, safeName);
        await storage.uploadTicketFile({ storagePath, buffer, mimeType: att.mimeType || 'image/png', fileName: safeName });
        const attachment = await adminDb.createTicketAttachment({
          ticketId: req.params.id, ticketMessageId: ticketMsg.id, userId: req.session.user.userId,
          fileName: safeName, fileType: att.mimeType || 'image/png', fileSize: buffer.length, storagePath,
        });
        savedAttachments.push(attachment);
      }
    }

    res.json({ ok: true, message: ticketMsg, attachments: savedAttachments });
  } catch (e) {
    console.error('Ticket reply error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to reply to ticket.' });
  }
});

// Serve ticket attachments (user can only see their own tickets' files)
app.get('/api/ticket-files/:attachmentId', requireAuth, async (req, res) => {
  try {
    const attachment = await adminDb.getTicketAttachment(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ ok: false, error: 'File not found.' });

    // Verify user owns the ticket
    const ticket = await adminDb.getTicket(attachment.ticket_id);
    if (!ticket || (ticket.user_id !== req.session.user.userId && req.session.user.role !== 'admin')) {
      return res.status(403).json({ ok: false, error: 'Access denied.' });
    }

    const file = await storage.getFile(attachment.storage_path);
    res.set('Content-Type', file.contentType || 'application/octet-stream');
    const safeName = attachment.file_name.replace(/["\\\r\n]/g, '_');
    res.set('Content-Disposition', `inline; filename="${safeName}"`);
    if (file.contentLength) res.set('Content-Length', String(file.contentLength));
    file.stream.pipe(res);
  } catch (e) {
    console.error('Ticket file serve error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to serve file.' });
  }
});

// ─── Error handler ────────────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ ok: false, error: 'Internal server error.' });
});

// ─── Static + SPA ─────────────────────────────────────────────────────────────

app.use(express.static(path.join(__dirname, 'app')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'app', 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

db.migrate()
  .then(() => adminDb.migrateAdmin())
  .then(() => seedAdmin())
  .then(() => {
    app.listen(PORT, () => console.log(`ChatPile App server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to start:', error);
    process.exit(1);
  });
