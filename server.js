const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const path = require('node:path');
const crypto = require('node:crypto');

const db = require('./db');
const storage = require('./storage');
const xendit = require('./xendit');

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
const INITIAL_ADMIN_EMAIL = process.env.APP_ADMIN_EMAIL || 'admin@localhost';
const INITIAL_ADMIN_USERNAME = process.env.APP_ADMIN_USERNAME || 'admin';

if (IS_PRODUCTION && SESSION_SECRET === DEFAULT_SESSION_SECRET) {
  console.error('SESSION_SECRET must be set in production.');
  process.exit(1);
}

// In-memory stores
const loginAttemptsByIp = new Map();
const pendingVerifications = new Map();
const passwordResetTokens = new Map();

// ─── Express setup ────────────────────────────────────────────────────────────

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
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
      console.log(`Webhook: upgraded user ${user.email} to premium (tier ${tier}, ${tier * 5} GB)`);
    } else if (event === 'recurring.plan.inactivated') {
      await db.updateSubscription(user.id, { status: 'cancelled' });
      console.log(`Webhook: cancelled subscription for ${user.email}`);
    } else if (event === 'recurring.cycle.failed') {
      await db.updateSubscription(user.id, { status: 'past_due' });
      console.log(`Webhook: payment failed for ${user.email}`);
    }

    res.json({ ok: true });
  } catch (e) {
    console.error('Webhook error:', e.message);
    res.status(500).json({ ok: false });
  }
});

app.use(express.json({ limit: '50mb' }));
app.use(session({
  name: 'ai_chats_sid',
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
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) return forwarded.split(',')[0].trim();
  return req.ip || 'unknown';
}

function getLockState(ip) {
  const current = loginAttemptsByIp.get(ip) || { failedCount: 0, lockUntil: 0 };
  const remainingMs = current.lockUntil - Date.now();
  return { ...current, locked: remainingMs > 0, lockedForSeconds: Math.ceil(Math.max(0, remainingMs) / 1000) };
}

function registerFailedAttempt(ip) {
  const current = loginAttemptsByIp.get(ip) || { failedCount: 0, lockUntil: 0 };
  const failedCount = current.failedCount + 1;
  let lockUntil = 0;
  if (failedCount >= 3) {
    const exponent = Math.max(0, failedCount - 3);
    lockUntil = Date.now() + Math.min(LOGIN_LOCK_MAX_MS, LOGIN_LOCK_BASE_MS * Math.pow(2, exponent));
  }
  loginAttemptsByIp.set(ip, { failedCount, lockUntil });
}

function clearAttempts(ip) { loginAttemptsByIp.delete(ip); }

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

async function sendEmail({ to, subject, text }) {
  if (!nodemailer || !SMTP_HOST) {
    console.log(`\n[EMAIL - no SMTP configured]\nTo: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  await transporter.sendMail({ from: SMTP_FROM, to, subject, text });
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
  });
});

app.post('/api/auth/login', async (req, res) => {
  const ip = getClientIp(req);
  const lock = getLockState(ip);
  if (lock.locked) {
    res.status(429).json({ ok: false, error: 'Too many failed attempts.', lockedForSeconds: lock.lockedForSeconds });
    return;
  }

  const { email, password } = req.body || {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    res.status(400).json({ ok: false, error: 'Invalid login payload.' });
    return;
  }

  try {
    const user = await db.findUserByEmail(email.trim());
    const fail = () => {
      registerFailedAttempt(ip);
      const state = getLockState(ip);
      res.status(401).json({ ok: false, error: 'Invalid credentials.', lockedForSeconds: state.locked ? state.lockedForSeconds : 0 });
    };

    if (!user || !user.verified) { fail(); return; }
    if (!(await verifyPassword(password, user))) { fail(); return; }

    clearAttempts(ip);
    req.session.user = { userId: user.id, email: user.email, username: user.username, tier: user.tier };
    res.json({ ok: true, email: user.email, username: user.username, tier: user.tier });
  } catch {
    res.status(500).json({ ok: false, error: 'Authentication failed.' });
  }
});

app.post('/api/auth/logout', (req, res) => {
  req.session.destroy(() => { res.clearCookie('ai_chats_sid'); res.json({ ok: true }); });
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

  try {
    const existing = await db.findUserByEmail(emailNorm);
    if (existing && existing.verified) { res.json({ ok: true }); return; }

    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derivePasswordHash(password, salt);
    const code = generateVerificationCode();

    pendingVerifications.set(emailNorm, { code, username: usernameTrim, salt, hash, expires: Date.now() + VERIFICATION_TTL_MS });

    await sendEmail({
      to: emailNorm,
      subject: 'Your AI Chats verification code',
      text: `Your verification code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not register for AI Chats, ignore this email.`,
    });
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'Registration failed. Please try again.' });
  }
});

app.post('/api/auth/verify-email', async (req, res) => {
  const { email, code } = req.body || {};
  if (typeof email !== 'string' || typeof code !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }

  const emailNorm = email.trim().toLowerCase();
  const pending = pendingVerifications.get(emailNorm);

  if (!pending || pending.expires < Date.now()) {
    pendingVerifications.delete(emailNorm);
    res.status(400).json({ ok: false, error: 'Verification code expired or not found. Please register again.' }); return;
  }
  if (pending.code !== code.trim()) { res.status(400).json({ ok: false, error: 'Incorrect verification code.' }); return; }

  try {
    const newUser = await db.createUser({
      email: emailNorm,
      username: pending.username,
      salt: pending.salt,
      hash: pending.hash,
      verified: true,
      role: 'user',
    });
    pendingVerifications.delete(emailNorm);

    req.session.user = { userId: newUser.id, email: newUser.email, username: newUser.username };
    res.json({ ok: true, email: newUser.email, username: newUser.username });
  } catch {
    res.status(500).json({ ok: false, error: 'Verification failed. Please try again.' });
  }
});

app.post('/api/auth/resend-verification', async (req, res) => {
  const { email } = req.body || {};
  if (typeof email !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  const emailNorm = email.trim().toLowerCase();
  const pending = pendingVerifications.get(emailNorm);
  res.json({ ok: true });
  if (!pending) return;

  const code = generateVerificationCode();
  pendingVerifications.set(emailNorm, { ...pending, code, expires: Date.now() + VERIFICATION_TTL_MS });
  try {
    await sendEmail({ to: emailNorm, subject: 'Your AI Chats verification code', text: `Your new verification code is: ${code}\n\nThis code expires in 15 minutes.` });
  } catch {}
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
    passwordResetTokens.set(token, { email: emailNorm, userId: user.id, expires: Date.now() + RESET_TTL_MS });
    await sendEmail({
      to: emailNorm, subject: 'Reset your AI Chats password',
      text: `Click the link below to reset your password. This link expires in 1 hour.\n\n${APP_URL}/?reset=${token}\n\nIf you did not request this, ignore this email.`,
    });
  } catch {}
});

app.post('/api/auth/reset-password', async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== 'string' || typeof newPassword !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  if (newPassword.length < 12) { res.status(400).json({ ok: false, error: 'Password must be at least 12 characters.' }); return; }

  const entry = passwordResetTokens.get(token);
  if (!entry || entry.expires < Date.now()) {
    passwordResetTokens.delete(token);
    res.status(400).json({ ok: false, error: 'Reset link expired or invalid. Please request a new one.' }); return;
  }

  try {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = await derivePasswordHash(newPassword, salt);
    await db.updateUserPassword(entry.userId, salt, hash);
    passwordResetTokens.delete(token);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false, error: 'Password reset failed. Please try again.' });
  }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') { res.status(400).json({ ok: false, error: 'Invalid payload.' }); return; }
  if (newPassword.length < 12) { res.status(400).json({ ok: false, error: 'New password must be at least 12 characters.' }); return; }
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
      } catch {}
      // Deactivate any stale/pending/expired plan before creating fresh
      try { await xendit.deactivatePlan(user.xendit_plan_id); } catch {}
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

  const user = await db.findUserByApiKey(apiKey);
  if (!user) { res.status(401).json({ ok: false, error: 'Invalid API key. Check Settings for your key.' }); return; }

  const { id, title, platform, url, captured, messages, attachments } = req.body || {};
  if (!id || !title || !Array.isArray(messages) || !messages.length) {
    res.status(400).json({ ok: false, error: 'Missing required fields: id, title, messages[].' }); return;
  }

  try {
    const result = await db.upsertConversation({
      userId: user.id, id, title,
      platform: platform || 'unknown',
      url: url || null,
      captured: captured || new Date().toISOString(),
      messages,
    });

    // Process attachments if present
    let savedAttachments = 0;
    const skippedAttachments = [];
    let addedBytes = 0;

    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        if (!att.fileName || !att.mimeType || !att.data) continue;

        // Tier enforcement: free users can only upload text files
        if (user.tier === 'free' && !storage.isFreeAllowed(att.mimeType)) {
          skippedAttachments.push({ fileName: att.fileName, reason: 'free_tier' });
          continue;
        }

        // Storage quota check (tracks bytes added in this request to avoid stale data)
        // Note: pg returns BIGINT as strings, so cast to Number for comparison
        const storageLimit = Number(user.storage_limit_bytes) || 0;
        if (storageLimit > 0) {
          const storageUsed = Number(user.storage_used_bytes) || 0;
          const estimatedSize = Buffer.byteLength(att.data, 'base64');
          if (storageUsed + addedBytes + estimatedSize > storageLimit) {
            skippedAttachments.push({ fileName: att.fileName, reason: 'quota_exceeded' });
            continue;
          }
        }

        const buffer = Buffer.from(att.data, 'base64');
        const { storagePath, fileSize, fileCategory } = await storage.uploadFile({
          userId: user.id, conversationId: id,
          fileName: att.fileName, mimeType: att.mimeType, buffer,
        });

        await db.createAttachment({
          conversationId: id, userId: user.id,
          messageIndex: att.messageIndex ?? 0,
          fileName: att.fileName, fileType: att.mimeType,
          fileCategory, fileSize, storagePath,
        });

        await db.addStorageUsed(user.id, fileSize);
        addedBytes += fileSize;
        savedAttachments++;
      }
    }

    const response = { ok: true, ...result, savedAttachments };
    if (skippedAttachments.length > 0) {
      response.skippedAttachments = skippedAttachments;
      const quotaSkipped = skippedAttachments.filter(s => s.reason === 'quota_exceeded');
      if (quotaSkipped.length > 0) {
        response.quotaWarning = `${quotaSkipped.length} file(s) skipped — storage quota exceeded. Upgrade your storage in Settings.`;
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
    res.set('Content-Disposition', `inline; filename="${attachment.file_name}"`);
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

// ─── Static + SPA ─────────────────────────────────────────────────────────────

app.use(express.static(path.join(process.cwd(), 'app')));
app.get('*', (_req, res) => res.sendFile(path.join(process.cwd(), 'app', 'index.html')));

// ─── Start ────────────────────────────────────────────────────────────────────

db.migrate()
  .then(() => seedAdmin())
  .then(() => {
    app.listen(PORT, () => console.log(`AI Chats server running on port ${PORT}`));
  })
  .catch((error) => {
    console.error('Failed to start:', error);
    process.exit(1);
  });
