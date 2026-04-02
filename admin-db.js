// Admin database module — tables, migrations, and queries for admin panel
// Separated from db.js to keep admin concerns isolated

const { pool } = require('./db');

// ─── Admin Migrations ──────────────────────────────────────────────────────────

async function migrateAdmin() {
  const client = await pool.connect();
  try {
    // Ticket system tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS tickets (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        subject TEXT NOT NULL,
        description TEXT NOT NULL,
        priority TEXT NOT NULL DEFAULT 'medium',
        status TEXT NOT NULL DEFAULT 'open',
        assigned_to UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMPTZ,
        closed_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS ticket_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        message TEXT NOT NULL,
        is_admin BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS ticket_attachments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
        ticket_message_id UUID REFERENCES ticket_messages(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        file_name TEXT NOT NULL,
        file_type TEXT NOT NULL,
        file_size BIGINT NOT NULL,
        storage_path TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
      CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
      CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON ticket_attachments(ticket_id);
    `);

    // Subscription event log for revenue tracking
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_events (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        storage_tier INTEGER,
        amount_cents INTEGER,
        currency TEXT DEFAULT 'PHP',
        metadata JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_sub_events_user ON subscription_events(user_id);
      CREATE INDEX IF NOT EXISTS idx_sub_events_type ON subscription_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_sub_events_created ON subscription_events(created_at);
    `);
  } finally {
    client.release();
  }
}

// ─── Subscription Event Logging ────────────────────────────────────────────────

async function logSubscriptionEvent(userId, { eventType, storageTier, amountCents, currency, metadata }) {
  await pool.query(
    `INSERT INTO subscription_events (user_id, event_type, storage_tier, amount_cents, currency, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [userId, eventType, storageTier || null, amountCents || null, currency || 'PHP', metadata ? JSON.stringify(metadata) : null]
  );
}

// ─── Ticket CRUD ───────────────────────────────────────────────────────────────

async function createTicket(userId, { subject, description, priority }) {
  const { rows } = await pool.query(
    `INSERT INTO tickets (user_id, subject, description, priority)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [userId, subject, description, priority || 'medium']
  );
  return rows[0];
}

async function getTicket(ticketId) {
  const { rows } = await pool.query('SELECT * FROM tickets WHERE id = $1', [ticketId]);
  return rows[0] || null;
}

async function listTickets({ status, priority, userId, limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (status) { conditions.push(`t.status = $${idx++}`); params.push(status); }
  if (priority) { conditions.push(`t.priority = $${idx++}`); params.push(priority); }
  if (userId) { conditions.push(`t.user_id = $${idx++}`); params.push(userId); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const { rows: tickets } = await pool.query(`
    SELECT t.*, u.email AS user_email, u.username AS user_username,
      (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) AS message_count,
      (SELECT COUNT(*) FROM ticket_attachments ta WHERE ta.ticket_id = t.id) AS attachment_count
    FROM tickets t
    JOIN users u ON u.id = t.user_id
    ${where}
    ORDER BY
      CASE t.priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
      t.created_at DESC
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) AS count FROM tickets t ${where}`, params
  );

  return { tickets, total: Number(count) };
}

async function listUserTickets(userId, { limit = 20, offset = 0 } = {}) {
  const { rows: tickets } = await pool.query(`
    SELECT t.*,
      (SELECT COUNT(*) FROM ticket_messages tm WHERE tm.ticket_id = t.id) AS message_count
    FROM tickets t
    WHERE t.user_id = $1
    ORDER BY t.created_at DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);
  return tickets;
}

async function updateTicket(ticketId, updates) {
  const sets = ['updated_at = NOW()'];
  const params = [];
  let idx = 1;

  if (updates.status !== undefined) {
    sets.push(`status = $${idx++}`);
    params.push(updates.status);
    if (updates.status === 'resolved') sets.push('resolved_at = NOW()');
    if (updates.status === 'closed') sets.push('closed_at = NOW()');
  }
  if (updates.priority !== undefined) { sets.push(`priority = $${idx++}`); params.push(updates.priority); }
  if (updates.assignedTo !== undefined) { sets.push(`assigned_to = $${idx++}`); params.push(updates.assignedTo); }

  params.push(ticketId);
  const { rows } = await pool.query(
    `UPDATE tickets SET ${sets.join(', ')} WHERE id = $${idx} RETURNING *`, params
  );
  return rows[0] || null;
}

async function addTicketMessage(ticketId, userId, { message, isAdmin }) {
  const { rows } = await pool.query(
    `INSERT INTO ticket_messages (ticket_id, user_id, message, is_admin)
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [ticketId, userId, message, isAdmin || false]
  );
  // Touch ticket updated_at
  await pool.query('UPDATE tickets SET updated_at = NOW() WHERE id = $1', [ticketId]);
  return rows[0];
}

async function getTicketMessages(ticketId) {
  const { rows } = await pool.query(`
    SELECT tm.*, u.username, u.email
    FROM ticket_messages tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.ticket_id = $1
    ORDER BY tm.created_at ASC
  `, [ticketId]);
  return rows;
}

async function createTicketAttachment({ ticketId, ticketMessageId, userId, fileName, fileType, fileSize, storagePath }) {
  const { rows } = await pool.query(
    `INSERT INTO ticket_attachments (ticket_id, ticket_message_id, user_id, file_name, file_type, file_size, storage_path)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [ticketId, ticketMessageId || null, userId, fileName, fileType, fileSize, storagePath]
  );
  return rows[0];
}

async function getTicketAttachments(ticketId) {
  const { rows } = await pool.query(
    `SELECT * FROM ticket_attachments WHERE ticket_id = $1 ORDER BY created_at`, [ticketId]
  );
  return rows;
}

async function getTicketAttachment(attachmentId) {
  const { rows } = await pool.query('SELECT * FROM ticket_attachments WHERE id = $1', [attachmentId]);
  return rows[0] || null;
}

// ─── Admin Dashboard Queries ───────────────────────────────────────────────────

async function getDashboardStats() {
  const { rows: [stats] } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM users) AS total_users,
      (SELECT COUNT(*) FROM users WHERE verified = true) AS verified_users,
      (SELECT COUNT(*) FROM users WHERE tier = 'premium') AS premium_users,
      (SELECT COUNT(*) FROM users WHERE created_at >= NOW() - INTERVAL '30 days') AS new_users_30d,
      (SELECT COUNT(*) FROM conversations) AS total_conversations,
      (SELECT COUNT(*) FROM messages) AS total_messages,
      (SELECT COUNT(*) FROM code_snippets) AS total_snippets,
      (SELECT COUNT(*) FROM attachments) AS total_attachments,
      (SELECT COALESCE(SUM(storage_used_bytes), 0) FROM users) AS total_storage_bytes,
      (SELECT COUNT(*) FROM tickets WHERE status IN ('open', 'in-progress')) AS open_tickets,
      (SELECT COALESCE(SUM(storage_tier * 200), 0) FROM users WHERE subscription_status = 'active') AS mrr_cents
  `);
  return {
    totalUsers: Number(stats.total_users),
    verifiedUsers: Number(stats.verified_users),
    premiumUsers: Number(stats.premium_users),
    newUsers30d: Number(stats.new_users_30d),
    totalConversations: Number(stats.total_conversations),
    totalMessages: Number(stats.total_messages),
    totalSnippets: Number(stats.total_snippets),
    totalAttachments: Number(stats.total_attachments),
    totalStorageBytes: Number(stats.total_storage_bytes),
    openTickets: Number(stats.open_tickets),
    mrrCents: Number(stats.mrr_cents),
  };
}

// ─── User Management ───────────────────────────────────────────────────────────

async function adminListUsers({ search, tier, status, sort = 'created_at', order = 'DESC', limit = 50, offset = 0 } = {}) {
  const conditions = [];
  const params = [];
  let idx = 1;

  if (search) {
    conditions.push(`(u.email ILIKE $${idx} OR u.username ILIKE $${idx + 1})`);
    params.push(`%${search}%`, `%${search}%`);
    idx += 2;
  }
  if (tier) { conditions.push(`u.tier = $${idx++}`); params.push(tier); }
  if (status) { conditions.push(`u.subscription_status = $${idx++}`); params.push(status); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const allowedSorts = ['created_at', 'email', 'username', 'storage_used_bytes', 'tier'];
  const safeSort = allowedSorts.includes(sort) ? sort : 'created_at';
  const safeOrder = order === 'ASC' ? 'ASC' : 'DESC';

  const { rows: users } = await pool.query(`
    SELECT u.id, u.email, u.username, u.verified, u.role, u.tier,
      u.storage_used_bytes, u.storage_limit_bytes, u.storage_tier,
      u.subscription_status, u.subscription_expires_at, u.created_at,
      (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversation_count,
      (SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.id) AS ticket_count
    FROM users u
    ${where}
    ORDER BY u.${safeSort} ${safeOrder}
    LIMIT $${idx} OFFSET $${idx + 1}
  `, [...params, limit, offset]);

  const { rows: [{ count }] } = await pool.query(
    `SELECT COUNT(*) AS count FROM users u ${where}`, params
  );

  return { users, total: Number(count) };
}

async function adminGetUserDetail(userId) {
  const { rows } = await pool.query(`
    SELECT u.id, u.email, u.username, u.verified, u.role, u.tier,
      u.storage_used_bytes, u.storage_limit_bytes, u.storage_tier,
      u.subscription_status, u.subscription_expires_at, u.xendit_plan_id,
      u.created_at, u.changed_at,
      (SELECT COUNT(*) FROM conversations c WHERE c.user_id = u.id) AS conversation_count,
      (SELECT COUNT(*) FROM messages m WHERE m.user_id = u.id) AS message_count,
      (SELECT COUNT(*) FROM code_snippets s WHERE s.user_id = u.id) AS snippet_count,
      (SELECT COUNT(*) FROM attachments a WHERE a.user_id = u.id) AS attachment_count,
      (SELECT COUNT(*) FROM tickets t WHERE t.user_id = u.id) AS ticket_count
    FROM users u WHERE u.id = $1
  `, [userId]);
  return rows[0] || null;
}

async function adminUpdateUser(userId, updates) {
  const sets = ['changed_at = NOW()'];
  const params = [];
  let idx = 1;

  if (updates.role !== undefined) { sets.push(`role = $${idx++}`); params.push(updates.role); }
  if (updates.tier !== undefined) { sets.push(`tier = $${idx++}`); params.push(updates.tier); }
  if (updates.verified !== undefined) { sets.push(`verified = $${idx++}`); params.push(updates.verified); }

  if (params.length === 0) return null;

  params.push(userId);
  const { rows } = await pool.query(
    `UPDATE users SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, email, username, role, tier, verified`, params
  );
  return rows[0] || null;
}

// ─── Revenue Reports ───────────────────────────────────────────────────────────

async function getRevenueReport({ period = 'daily', startDate, endDate } = {}) {
  const truncMap = { daily: 'day', weekly: 'week', monthly: 'month', annually: 'year' };
  const trunc = truncMap[period] || 'day';

  const conditions = ["event_type IN ('payment_succeeded', 'activated')"];
  const params = [];
  let idx = 1;

  if (startDate) { conditions.push(`created_at >= $${idx++}`); params.push(startDate); }
  if (endDate) { conditions.push(`created_at <= $${idx++}`); params.push(endDate); }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await pool.query(`
    SELECT
      date_trunc('${trunc}', created_at) AS period_start,
      COUNT(*) AS transactions,
      COALESCE(SUM(amount_cents), 0) AS revenue_cents,
      COUNT(DISTINCT user_id) AS unique_users
    FROM subscription_events
    ${where}
    GROUP BY period_start
    ORDER BY period_start DESC
    LIMIT 100
  `, params);

  // Summary stats for the range
  const { rows: [summary] } = await pool.query(`
    SELECT
      COALESCE(SUM(CASE WHEN event_type IN ('payment_succeeded', 'activated') THEN amount_cents ELSE 0 END), 0) AS total_revenue_cents,
      COUNT(CASE WHEN event_type = 'activated' THEN 1 END) AS new_subscriptions,
      COUNT(CASE WHEN event_type = 'cancelled' THEN 1 END) AS cancellations,
      COUNT(CASE WHEN event_type = 'upgraded' THEN 1 END) AS upgrades,
      COUNT(CASE WHEN event_type = 'payment_failed' THEN 1 END) AS failed_payments
    FROM subscription_events
    ${where.replace(/event_type IN \('payment_succeeded', 'activated'\)/, '1=1')}
  `, params);

  return {
    period,
    data: rows.map(r => ({
      periodStart: r.period_start,
      transactions: Number(r.transactions),
      revenueCents: Number(r.revenue_cents),
      uniqueUsers: Number(r.unique_users),
    })),
    summary: {
      totalRevenueCents: Number(summary.total_revenue_cents),
      newSubscriptions: Number(summary.new_subscriptions),
      cancellations: Number(summary.cancellations),
      upgrades: Number(summary.upgrades),
      failedPayments: Number(summary.failed_payments),
    },
  };
}

// ─── Analytics Reports ─────────────────────────────────────────────────────────

async function getUserAnalytics() {
  const { rows } = await pool.query(`
    SELECT
      date_trunc('day', created_at) AS day,
      COUNT(*) AS registrations
    FROM users
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day
  `);

  const { rows: [tiers] } = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE tier = 'free') AS free_users,
      COUNT(*) FILTER (WHERE tier = 'premium') AS premium_users,
      COUNT(*) FILTER (WHERE verified = true) AS verified_users,
      COUNT(*) FILTER (WHERE verified = false) AS unverified_users,
      COUNT(*) FILTER (WHERE subscription_status = 'active') AS active_subscriptions,
      COUNT(*) FILTER (WHERE subscription_status = 'cancelled') AS cancelled_subscriptions,
      COUNT(*) FILTER (WHERE subscription_status = 'past_due') AS past_due_subscriptions
    FROM users
  `);

  return {
    registrationTrend: rows.map(r => ({ day: r.day, count: Number(r.registrations) })),
    tiers: {
      freeUsers: Number(tiers.free_users),
      premiumUsers: Number(tiers.premium_users),
      verifiedUsers: Number(tiers.verified_users),
      unverifiedUsers: Number(tiers.unverified_users),
      activeSubscriptions: Number(tiers.active_subscriptions),
      cancelledSubscriptions: Number(tiers.cancelled_subscriptions),
      pastDueSubscriptions: Number(tiers.past_due_subscriptions),
    },
  };
}

async function getPlatformAnalytics() {
  const { rows: platforms } = await pool.query(`
    SELECT
      c.platform,
      COUNT(DISTINCT c.id) AS conversations,
      COUNT(m.id) AS messages
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id AND m.user_id = c.user_id
    GROUP BY c.platform
    ORDER BY conversations DESC
  `);

  const { rows: daily } = await pool.query(`
    SELECT
      date_trunc('day', c.created_at) AS day,
      c.platform,
      COUNT(*) AS conversations
    FROM conversations c
    WHERE c.created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day, c.platform
    ORDER BY day
  `);

  return {
    byPlatform: platforms.map(p => ({
      platform: p.platform,
      conversations: Number(p.conversations),
      messages: Number(p.messages),
    })),
    dailyTrend: daily.map(d => ({
      day: d.day,
      platform: d.platform,
      conversations: Number(d.conversations),
    })),
  };
}

async function getStorageAnalytics() {
  const { rows: topUsers } = await pool.query(`
    SELECT u.id, u.email, u.username, u.storage_used_bytes, u.storage_limit_bytes, u.storage_tier, u.tier
    FROM users u
    WHERE u.storage_used_bytes > 0
    ORDER BY u.storage_used_bytes DESC
    LIMIT 20
  `);

  const { rows: [agg] } = await pool.query(`
    SELECT
      COALESCE(SUM(storage_used_bytes), 0) AS total_used,
      COALESCE(SUM(storage_limit_bytes), 0) AS total_allocated,
      COALESCE(AVG(CASE WHEN storage_used_bytes > 0 THEN storage_used_bytes END), 0) AS avg_used,
      COUNT(*) FILTER (WHERE storage_used_bytes > 0) AS users_with_storage
    FROM users
  `);

  const { rows: byCategory } = await pool.query(`
    SELECT file_category, COUNT(*) AS file_count, COALESCE(SUM(file_size), 0) AS total_bytes
    FROM attachments
    GROUP BY file_category
    ORDER BY total_bytes DESC
  `);

  return {
    topUsers: topUsers.map(u => ({
      id: u.id, email: u.email, username: u.username,
      usedBytes: Number(u.storage_used_bytes), limitBytes: Number(u.storage_limit_bytes),
      tier: u.tier, storageTier: u.storage_tier,
    })),
    aggregate: {
      totalUsed: Number(agg.total_used),
      totalAllocated: Number(agg.total_allocated),
      avgUsed: Number(agg.avg_used),
      usersWithStorage: Number(agg.users_with_storage),
    },
    byCategory: byCategory.map(c => ({
      category: c.file_category, fileCount: Number(c.file_count), totalBytes: Number(c.total_bytes),
    })),
  };
}

async function getConversationAnalytics() {
  const { rows: daily } = await pool.query(`
    SELECT
      date_trunc('day', created_at) AS day,
      COUNT(*) AS conversations,
      (SELECT COUNT(*) FROM messages m
       JOIN conversations c2 ON c2.id = m.conversation_id AND c2.user_id = m.user_id
       WHERE date_trunc('day', c2.created_at) = date_trunc('day', c.created_at)) AS messages
    FROM conversations c
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY day
    ORDER BY day
  `);

  const { rows: [totals] } = await pool.query(`
    SELECT
      (SELECT COUNT(*) FROM conversations) AS conversations,
      (SELECT COUNT(*) FROM messages) AS messages,
      (SELECT COUNT(*) FROM code_snippets) AS snippets,
      (SELECT COUNT(*) FROM attachments) AS attachments,
      (SELECT COUNT(DISTINCT user_id) FROM conversations WHERE created_at >= NOW() - INTERVAL '7 days') AS active_users_7d,
      (SELECT COUNT(DISTINCT user_id) FROM conversations WHERE created_at >= NOW() - INTERVAL '30 days') AS active_users_30d
  `);

  return {
    dailyIngestion: daily.map(d => ({
      day: d.day, conversations: Number(d.conversations), messages: Number(d.messages),
    })),
    totals: {
      conversations: Number(totals.conversations),
      messages: Number(totals.messages),
      snippets: Number(totals.snippets),
      attachments: Number(totals.attachments),
      activeUsers7d: Number(totals.active_users_7d),
      activeUsers30d: Number(totals.active_users_30d),
    },
  };
}

async function getSystemHealth() {
  const { rows: recentEvents } = await pool.query(`
    SELECT event_type, COUNT(*) AS count, MAX(created_at) AS last_at
    FROM subscription_events
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY event_type
  `);

  const { rows: ticketStats } = await pool.query(`
    SELECT
      status,
      COUNT(*) AS count,
      AVG(EXTRACT(EPOCH FROM (
        COALESCE(resolved_at, NOW()) - created_at
      ))) AS avg_resolution_seconds
    FROM tickets
    GROUP BY status
  `);

  const { rows: [dbSize] } = await pool.query(`
    SELECT pg_database_size(current_database()) AS size_bytes
  `);

  return {
    subscriptionEvents24h: recentEvents.map(e => ({
      eventType: e.event_type, count: Number(e.count), lastAt: e.last_at,
    })),
    ticketStats: ticketStats.map(t => ({
      status: t.status, count: Number(t.count),
      avgResolutionSeconds: t.avg_resolution_seconds ? Number(t.avg_resolution_seconds) : null,
    })),
    databaseSizeBytes: Number(dbSize.size_bytes),
  };
}

module.exports = {
  migrateAdmin,
  logSubscriptionEvent,
  createTicket,
  getTicket,
  listTickets,
  listUserTickets,
  updateTicket,
  addTicketMessage,
  getTicketMessages,
  createTicketAttachment,
  getTicketAttachments,
  getTicketAttachment,
  getDashboardStats,
  adminListUsers,
  adminGetUserDetail,
  adminUpdateUser,
  getRevenueReport,
  getUserAnalytics,
  getPlatformAnalytics,
  getStorageAnalytics,
  getConversationAnalytics,
  getSystemHealth,
};
