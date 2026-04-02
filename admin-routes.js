// Admin API routes — all endpoints behind requireAdmin middleware
// Mounted at /api/admin in server.js

const express = require('express');
const path = require('node:path');
const adminDb = require('./admin-db');
const storage = require('./storage');

const router = express.Router();

// ─── Admin Auth Middleware ──────────────────────────────────────────────────────

function requireAdmin(req, res, next) {
  if (!req.session?.user) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  if (req.session.user.role !== 'admin') {
    return res.status(403).json({ ok: false, error: 'Forbidden — admin access required.' });
  }
  next();
}

router.use(requireAdmin);

// ─── Dashboard ──────────────────────────────────────────────────────────────────

router.get('/dashboard', async (_req, res) => {
  try {
    const stats = await adminDb.getDashboardStats();
    res.json({ ok: true, ...stats });
  } catch (e) {
    console.error('Admin dashboard error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to load dashboard.' });
  }
});

// ─── User Management ────────────────────────────────────────────────────────────

router.get('/users', async (req, res) => {
  try {
    const { search, tier, status, sort, order, limit, offset } = req.query;
    const result = await adminDb.adminListUsers({
      search, tier, status, sort, order,
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Admin list users error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to list users.' });
  }
});

router.get('/users/:id', async (req, res) => {
  try {
    const user = await adminDb.adminGetUserDetail(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
    res.json({ ok: true, user });
  } catch (e) {
    console.error('Admin get user error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to get user details.' });
  }
});

router.patch('/users/:id', async (req, res) => {
  try {
    const { role, tier, verified } = req.body || {};
    const updates = {};
    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) return res.status(400).json({ ok: false, error: 'Invalid role.' });
      updates.role = role;
    }
    if (tier !== undefined) {
      if (!['free', 'premium'].includes(tier)) return res.status(400).json({ ok: false, error: 'Invalid tier.' });
      updates.tier = tier;
    }
    if (verified !== undefined) updates.verified = Boolean(verified);

    const user = await adminDb.adminUpdateUser(req.params.id, updates);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found or no changes.' });
    res.json({ ok: true, user });
  } catch (e) {
    console.error('Admin update user error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to update user.' });
  }
});

router.post('/users/:id/grant-premium', async (req, res) => {
  try {
    const { months, storageTier } = req.body || {};
    const m = Number(months);
    if (!m || m < 1 || m > 120) {
      return res.status(400).json({ ok: false, error: 'Months must be between 1 and 120.' });
    }
    const tier = Number(storageTier) || 1;
    if (tier < 1 || tier > 20) {
      return res.status(400).json({ ok: false, error: 'Storage tier must be between 1 and 20.' });
    }
    const user = await adminDb.adminGrantPremium(req.params.id, { months: m, storageTier: tier });
    if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
    res.json({ ok: true, user });
  } catch (e) {
    console.error('Admin grant premium error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to grant premium.' });
  }
});

router.post('/users/:id/revoke-premium', async (req, res) => {
  try {
    const user = await adminDb.adminRevokePremium(req.params.id);
    if (!user) return res.status(404).json({ ok: false, error: 'User not found.' });
    res.json({ ok: true, user });
  } catch (e) {
    console.error('Admin revoke premium error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to revoke premium.' });
  }
});

router.post('/deduplicate-attachments', async (req, res) => {
  try {
    const { userId, conversationId } = req.body || {};
    const result = await adminDb.deduplicateAttachments(userId || null, conversationId || null);
    // Delete orphaned S3 files
    for (const path of result.paths) {
      try { await storage.deleteFile(path); } catch { /* already gone */ }
    }
    res.json({ ok: true, removed: result.removed });
  } catch (e) {
    console.error('Deduplicate error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to deduplicate.' });
  }
});

// ─── Tickets (Admin View) ───────────────────────────────────────────────────────

router.get('/tickets', async (req, res) => {
  try {
    const { status, priority, userId, limit, offset } = req.query;
    const result = await adminDb.listTickets({
      status, priority, userId,
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    });
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('Admin list tickets error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to list tickets.' });
  }
});

router.get('/tickets/:id', async (req, res) => {
  try {
    const ticket = await adminDb.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found.' });
    const messages = await adminDb.getTicketMessages(req.params.id);
    const attachments = await adminDb.getTicketAttachments(req.params.id);
    res.json({ ok: true, ticket, messages, attachments });
  } catch (e) {
    console.error('Admin get ticket error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to get ticket.' });
  }
});

router.patch('/tickets/:id', async (req, res) => {
  try {
    const { status, priority, assignedTo } = req.body || {};
    const updates = {};
    if (status !== undefined) {
      if (!['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ ok: false, error: 'Invalid status.' });
      }
      updates.status = status;
    }
    if (priority !== undefined) {
      if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
        return res.status(400).json({ ok: false, error: 'Invalid priority.' });
      }
      updates.priority = priority;
    }
    if (assignedTo !== undefined) updates.assignedTo = assignedTo;

    const ticket = await adminDb.updateTicket(req.params.id, updates);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found.' });
    res.json({ ok: true, ticket });
  } catch (e) {
    console.error('Admin update ticket error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to update ticket.' });
  }
});

router.post('/tickets/:id/messages', async (req, res) => {
  try {
    const { message, attachments: atts } = req.body || {};
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ ok: false, error: 'Message is required.' });
    }

    const ticket = await adminDb.getTicket(req.params.id);
    if (!ticket) return res.status(404).json({ ok: false, error: 'Ticket not found.' });

    const ticketMsg = await adminDb.addTicketMessage(req.params.id, req.session.user.userId, {
      message, isAdmin: true,
    });

    // Process screenshot attachments (base64)
    const savedAttachments = [];
    if (Array.isArray(atts)) {
      for (const att of atts.slice(0, 5)) {
        if (!att.fileName || !att.data) continue;
        const safeName = path.basename(att.fileName).slice(0, 255) || 'screenshot.png';
        const buffer = Buffer.from(att.data, 'base64');
        if (buffer.length > 10 * 1024 * 1024) continue; // 10MB max per file

        const storagePath = storage.buildTicketStoragePath(req.params.id, safeName);
        await storage.uploadTicketFile({ storagePath, buffer, mimeType: att.mimeType || 'image/png', fileName: safeName });

        const attachment = await adminDb.createTicketAttachment({
          ticketId: req.params.id,
          ticketMessageId: ticketMsg.id,
          userId: req.session.user.userId,
          fileName: safeName,
          fileType: att.mimeType || 'image/png',
          fileSize: buffer.length,
          storagePath,
        });
        savedAttachments.push(attachment);
      }
    }

    res.json({ ok: true, message: ticketMsg, attachments: savedAttachments });
  } catch (e) {
    console.error('Admin ticket reply error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to reply to ticket.' });
  }
});

// ─── Reports ────────────────────────────────────────────────────────────────────

router.get('/reports/revenue', async (req, res) => {
  try {
    const { period, start, end } = req.query;
    const report = await adminDb.getRevenueReport({
      period: period || 'daily',
      startDate: start || undefined,
      endDate: end || undefined,
    });
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('Revenue report error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to generate revenue report.' });
  }
});

router.get('/reports/users', async (_req, res) => {
  try {
    const report = await adminDb.getUserAnalytics();
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('User analytics error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to generate user report.' });
  }
});

router.get('/reports/platforms', async (_req, res) => {
  try {
    const report = await adminDb.getPlatformAnalytics();
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('Platform analytics error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to generate platform report.' });
  }
});

router.get('/reports/storage', async (_req, res) => {
  try {
    const report = await adminDb.getStorageAnalytics();
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('Storage analytics error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to generate storage report.' });
  }
});

router.get('/reports/conversations', async (_req, res) => {
  try {
    const report = await adminDb.getConversationAnalytics();
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('Conversation analytics error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to generate conversation report.' });
  }
});

router.get('/reports/system', async (_req, res) => {
  try {
    const report = await adminDb.getSystemHealth();
    res.json({ ok: true, ...report });
  } catch (e) {
    console.error('System health error:', e.message);
    res.status(500).json({ ok: false, error: 'Failed to generate system report.' });
  }
});

// ─── Ticket File Serving ────────────────────────────────────────────────────────

router.get('/ticket-files/:attachmentId', async (req, res) => {
  try {
    const attachment = await adminDb.getTicketAttachment(req.params.attachmentId);
    if (!attachment) return res.status(404).json({ ok: false, error: 'File not found.' });

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

module.exports = router;
