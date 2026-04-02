// Admin Panel — dynamically loaded for admin users only
// Injects its own overlay into the DOM and manages all admin views

(function () {
  'use strict';

  const TABS = ['dashboard', 'users', 'tickets', 'revenue', 'analytics', 'system'];

  let currentTab = 'dashboard';
  let overlay = null;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function fmt(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
    return String(n);
  }

  function fmtBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  }

  function fmtCents(cents) {
    return '$' + (cents / 100).toFixed(2);
  }

  function fmtDate(d) {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function fmtDateTime(d) {
    if (!d) return '-';
    return new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function escHtml(s) {
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  async function adminFetch(path, opts = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `HTTP ${res.status}`);
    }
    return res.json();
  }

  async function adminPost(path, body) {
    return adminFetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  async function adminPatch(path, body) {
    return adminFetch(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  // ─── Build Overlay ──────────────────────────────────────────────────────────

  function buildOverlay() {
    const el = document.createElement('div');
    el.id = 'adminOverlay';
    el.className = 'admin-overlay';
    el.hidden = true;
    el.innerHTML = `
      <div class="admin-header">
        <h1>Admin Panel</h1>
        <button class="admin-close-btn" id="adminCloseBtn">Close</button>
      </div>
      <nav class="admin-nav" id="adminNav">
        ${TABS.map(t => `<button class="admin-nav-btn${t === 'dashboard' ? ' active' : ''}" data-tab="${t}">${t.charAt(0).toUpperCase() + t.slice(1)}</button>`).join('')}
      </nav>
      <div class="admin-content" id="adminContent">
        <div class="admin-section active" data-section="dashboard" id="adminDashboard"></div>
        <div class="admin-section" data-section="users" id="adminUsers"></div>
        <div class="admin-section" data-section="tickets" id="adminTickets"></div>
        <div class="admin-section" data-section="revenue" id="adminRevenue"></div>
        <div class="admin-section" data-section="analytics" id="adminAnalytics"></div>
        <div class="admin-section" data-section="system" id="adminSystem"></div>
      </div>
    `;
    document.body.appendChild(el);
    overlay = el;

    el.querySelector('#adminCloseBtn').addEventListener('click', closeAdmin);
    el.querySelector('#adminNav').addEventListener('click', (e) => {
      const btn = e.target.closest('.admin-nav-btn');
      if (!btn) return;
      switchTab(btn.dataset.tab);
    });

    return el;
  }

  function switchTab(tab) {
    currentTab = tab;
    overlay.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    overlay.querySelectorAll('.admin-section').forEach(s => s.classList.toggle('active', s.dataset.section === tab));
    loadTabData(tab);
  }

  function loadTabData(tab) {
    switch (tab) {
      case 'dashboard': loadDashboard(); break;
      case 'users': loadUsers(); break;
      case 'tickets': loadTickets(); break;
      case 'revenue': loadRevenue(); break;
      case 'analytics': loadAnalytics(); break;
      case 'system': loadSystem(); break;
    }
  }

  // ─── Dashboard ──────────────────────────────────────────────────────────────

  async function loadDashboard() {
    const section = overlay.querySelector('#adminDashboard');
    section.innerHTML = '<p class="admin-empty">Loading...</p>';

    try {
      const data = await adminFetch('/api/admin/dashboard');
      section.innerHTML = `
        <h2 class="admin-section-title">Dashboard Overview</h2>
        <div class="admin-cards">
          <div class="admin-card">
            <div class="admin-card-label">Total Users</div>
            <div class="admin-card-value">${fmt(data.totalUsers)}</div>
            <div class="admin-card-sub">${data.verifiedUsers} verified, ${data.newUsers30d} new (30d)</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Premium Users</div>
            <div class="admin-card-value">${fmt(data.premiumUsers)}</div>
            <div class="admin-card-sub">${data.totalUsers > 0 ? Math.round(data.premiumUsers / data.totalUsers * 100) : 0}% conversion</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Monthly Recurring Revenue</div>
            <div class="admin-card-value">${fmtCents(data.mrrCents)}</div>
            <div class="admin-card-sub">ARR: ${fmtCents(data.mrrCents * 12)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Open Tickets</div>
            <div class="admin-card-value">${data.openTickets}</div>
            <div class="admin-card-sub">Needs attention</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Conversations</div>
            <div class="admin-card-value">${fmt(data.totalConversations)}</div>
            <div class="admin-card-sub">${fmt(data.totalMessages)} messages</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Code Snippets</div>
            <div class="admin-card-value">${fmt(data.totalSnippets)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">File Attachments</div>
            <div class="admin-card-value">${fmt(data.totalAttachments)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Total Storage</div>
            <div class="admin-card-value">${fmtBytes(data.totalStorageBytes)}</div>
          </div>
        </div>
      `;
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load dashboard: ${escHtml(e.message)}</p>`;
    }
  }

  // ─── Users ──────────────────────────────────────────────────────────────────

  let usersState = { search: '', tier: '', offset: 0, limit: 30 };

  async function loadUsers() {
    const section = overlay.querySelector('#adminUsers');
    const params = new URLSearchParams();
    if (usersState.search) params.set('search', usersState.search);
    if (usersState.tier) params.set('tier', usersState.tier);
    params.set('limit', usersState.limit);
    params.set('offset', usersState.offset);

    try {
      const data = await adminFetch(`/api/admin/users?${params}`);
      const totalPages = Math.ceil(data.total / usersState.limit);
      const currentPage = Math.floor(usersState.offset / usersState.limit) + 1;

      section.innerHTML = `
        <h2 class="admin-section-title">User Management (${data.total} total)</h2>
        <div class="admin-toolbar">
          <input type="search" id="adminUserSearch" placeholder="Search email or username..." value="${escHtml(usersState.search)}" />
          <select id="adminUserTierFilter">
            <option value="">All Tiers</option>
            <option value="free"${usersState.tier === 'free' ? ' selected' : ''}>Free</option>
            <option value="premium"${usersState.tier === 'premium' ? ' selected' : ''}>Premium</option>
          </select>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr>
              <th>User</th><th>Email</th><th>Role</th><th>Tier</th><th>Storage</th><th>Subscription</th><th>Conversations</th><th>Tickets</th><th>Joined</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${data.users.length === 0 ? '<tr><td colspan="10" class="admin-empty">No users found</td></tr>' : ''}
              ${data.users.map(u => `
                <tr>
                  <td><strong>${escHtml(u.username)}</strong>${!u.verified ? ' <span style="color:var(--muted);font-size:0.7rem;">(unverified)</span>' : ''}</td>
                  <td>${escHtml(u.email)}</td>
                  <td><span class="admin-badge ${u.role}">${u.role}</span></td>
                  <td><span class="admin-badge ${u.tier}">${u.tier}</span></td>
                  <td>${fmtBytes(Number(u.storage_used_bytes))} / ${fmtBytes(Number(u.storage_limit_bytes))}</td>
                  <td><span class="admin-badge ${u.subscription_status}">${u.subscription_status}</span></td>
                  <td>${u.conversation_count}</td>
                  <td>${u.ticket_count}</td>
                  <td>${fmtDate(u.created_at)}</td>
                  <td>
                    <select class="admin-inline-select" data-user-id="${u.id}" data-field="role" title="Change role">
                      <option value="user"${u.role === 'user' ? ' selected' : ''}>User</option>
                      <option value="admin"${u.role === 'admin' ? ' selected' : ''}>Admin</option>
                    </select>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
          <div class="admin-pagination">
            <button class="admin-btn secondary" data-page="prev" ${currentPage <= 1 ? 'disabled' : ''}>Prev</button>
            <span>Page ${currentPage} of ${totalPages}</span>
            <button class="admin-btn secondary" data-page="next" ${currentPage >= totalPages ? 'disabled' : ''}>Next</button>
          </div>
        ` : ''}
      `;

      // Bind search
      const searchInput = section.querySelector('#adminUserSearch');
      let searchTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        searchTimer = setTimeout(() => {
          usersState.search = searchInput.value.trim();
          usersState.offset = 0;
          loadUsers();
        }, 300);
      });

      // Bind tier filter
      section.querySelector('#adminUserTierFilter').addEventListener('change', (e) => {
        usersState.tier = e.target.value;
        usersState.offset = 0;
        loadUsers();
      });

      // Bind role change
      section.querySelectorAll('[data-field="role"]').forEach(sel => {
        sel.addEventListener('change', async (e) => {
          try {
            await adminPatch(`/api/admin/users/${sel.dataset.userId}`, { role: e.target.value });
          } catch (err) {
            alert('Failed to update role: ' + err.message);
            loadUsers();
          }
        });
      });

      // Bind pagination
      section.querySelectorAll('[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
          if (btn.dataset.page === 'prev') usersState.offset = Math.max(0, usersState.offset - usersState.limit);
          else usersState.offset += usersState.limit;
          loadUsers();
        });
      });
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load users: ${escHtml(e.message)}</p>`;
    }
  }

  // ─── Tickets ────────────────────────────────────────────────────────────────

  let ticketsState = { status: '', priority: '', offset: 0, limit: 30, viewingTicketId: null };

  async function loadTickets() {
    if (ticketsState.viewingTicketId) {
      await loadTicketDetail(ticketsState.viewingTicketId);
      return;
    }

    const section = overlay.querySelector('#adminTickets');
    const params = new URLSearchParams();
    if (ticketsState.status) params.set('status', ticketsState.status);
    if (ticketsState.priority) params.set('priority', ticketsState.priority);
    params.set('limit', ticketsState.limit);
    params.set('offset', ticketsState.offset);

    try {
      const data = await adminFetch(`/api/admin/tickets?${params}`);

      section.innerHTML = `
        <h2 class="admin-section-title">Support Tickets (${data.total} total)</h2>
        <div class="admin-toolbar">
          <select id="adminTicketStatusFilter">
            <option value="">All Statuses</option>
            <option value="open"${ticketsState.status === 'open' ? ' selected' : ''}>Open</option>
            <option value="in-progress"${ticketsState.status === 'in-progress' ? ' selected' : ''}>In Progress</option>
            <option value="resolved"${ticketsState.status === 'resolved' ? ' selected' : ''}>Resolved</option>
            <option value="closed"${ticketsState.status === 'closed' ? ' selected' : ''}>Closed</option>
          </select>
          <select id="adminTicketPriorityFilter">
            <option value="">All Priorities</option>
            <option value="critical"${ticketsState.priority === 'critical' ? ' selected' : ''}>Critical</option>
            <option value="high"${ticketsState.priority === 'high' ? ' selected' : ''}>High</option>
            <option value="medium"${ticketsState.priority === 'medium' ? ' selected' : ''}>Medium</option>
            <option value="low"${ticketsState.priority === 'low' ? ' selected' : ''}>Low</option>
          </select>
        </div>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr>
              <th>Subject</th><th>User</th><th>Priority</th><th>Status</th><th>Messages</th><th>Created</th><th>Updated</th>
            </tr></thead>
            <tbody>
              ${data.tickets.length === 0 ? '<tr><td colspan="7" class="admin-empty">No tickets found</td></tr>' : ''}
              ${data.tickets.map(t => `
                <tr class="clickable" data-ticket-id="${t.id}">
                  <td><strong>${escHtml(t.subject)}</strong></td>
                  <td>${escHtml(t.user_username)} (${escHtml(t.user_email)})</td>
                  <td><span class="admin-badge ${t.priority}">${t.priority}</span></td>
                  <td><span class="admin-badge ${t.status}">${t.status}</span></td>
                  <td>${t.message_count}</td>
                  <td>${fmtDateTime(t.created_at)}</td>
                  <td>${fmtDateTime(t.updated_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      // Filters
      section.querySelector('#adminTicketStatusFilter').addEventListener('change', (e) => {
        ticketsState.status = e.target.value;
        ticketsState.offset = 0;
        loadTickets();
      });
      section.querySelector('#adminTicketPriorityFilter').addEventListener('change', (e) => {
        ticketsState.priority = e.target.value;
        ticketsState.offset = 0;
        loadTickets();
      });

      // Click to view ticket
      section.querySelectorAll('[data-ticket-id]').forEach(row => {
        row.addEventListener('click', () => {
          ticketsState.viewingTicketId = row.dataset.ticketId;
          loadTickets();
        });
      });
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load tickets: ${escHtml(e.message)}</p>`;
    }
  }

  async function loadTicketDetail(ticketId) {
    const section = overlay.querySelector('#adminTickets');

    try {
      const data = await adminFetch(`/api/admin/tickets/${ticketId}`);
      const t = data.ticket;
      const msgs = data.messages || [];
      const atts = data.attachments || [];

      // Map attachments to their messages
      const attsByMsg = {};
      atts.forEach(a => {
        const key = a.ticket_message_id || '__initial';
        if (!attsByMsg[key]) attsByMsg[key] = [];
        attsByMsg[key].push(a);
      });

      section.innerHTML = `
        <div style="margin-bottom:1rem;">
          <button class="admin-btn secondary" id="adminTicketBack">Back to Tickets</button>
        </div>
        <div class="admin-ticket-thread">
          <div class="admin-ticket-meta">
            <h3>${escHtml(t.subject)}</h3>
            <p><span class="admin-badge ${t.priority}">${t.priority}</span> <span class="admin-badge ${t.status}">${t.status}</span></p>
            <p>Created: ${fmtDateTime(t.created_at)} | Updated: ${fmtDateTime(t.updated_at)}</p>
            <p style="margin-top:0.5rem;color:var(--text);white-space:pre-wrap;">${escHtml(t.description)}</p>
            ${renderAttachments(attsByMsg['__initial'] || [])}
            <div style="margin-top:0.75rem;display:flex;gap:0.5rem;align-items:center;">
              <label style="color:var(--muted);font-size:0.78rem;">Status:</label>
              <select class="admin-inline-select" id="adminTicketStatusChange">
                ${['open', 'in-progress', 'resolved', 'closed'].map(s => `<option value="${s}"${t.status === s ? ' selected' : ''}>${s}</option>`).join('')}
              </select>
              <label style="color:var(--muted);font-size:0.78rem;margin-left:0.5rem;">Priority:</label>
              <select class="admin-inline-select" id="adminTicketPriorityChange">
                ${['low', 'medium', 'high', 'critical'].map(p => `<option value="${p}"${t.priority === p ? ' selected' : ''}>${p}</option>`).join('')}
              </select>
            </div>
          </div>

          ${msgs.map(m => `
            <div class="admin-ticket-msg ${m.is_admin ? 'admin-msg' : 'user-msg'}">
              <div class="admin-ticket-msg-header">
                <strong>${escHtml(m.username)}</strong>
                ${m.is_admin ? '<span class="admin-badge admin">Admin</span>' : ''}
                <span>${fmtDateTime(m.created_at)}</span>
              </div>
              <div class="admin-ticket-msg-body">${escHtml(m.message)}</div>
              ${renderAttachments(attsByMsg[m.id] || [])}
            </div>
          `).join('')}

          <div class="admin-reply-form">
            <textarea id="adminTicketReply" placeholder="Type your reply..."></textarea>
            <div class="admin-reply-actions">
              <button class="admin-btn" id="adminTicketSendReply">Send Reply</button>
              <label class="admin-btn secondary" style="cursor:pointer;">
                Attach Screenshot
                <input type="file" id="adminTicketFile" accept="image/*" multiple hidden />
              </label>
              <span id="adminTicketFileNames" style="color:var(--muted);font-size:0.75rem;"></span>
            </div>
            <p id="adminTicketReplyStatus" style="color:var(--muted);font-size:0.78rem;"></p>
          </div>
        </div>
      `;

      // Back button
      section.querySelector('#adminTicketBack').addEventListener('click', () => {
        ticketsState.viewingTicketId = null;
        loadTickets();
      });

      // Status/priority change
      section.querySelector('#adminTicketStatusChange').addEventListener('change', async (e) => {
        try {
          await adminPatch(`/api/admin/tickets/${ticketId}`, { status: e.target.value });
        } catch (err) { alert('Failed: ' + err.message); }
      });
      section.querySelector('#adminTicketPriorityChange').addEventListener('change', async (e) => {
        try {
          await adminPatch(`/api/admin/tickets/${ticketId}`, { priority: e.target.value });
        } catch (err) { alert('Failed: ' + err.message); }
      });

      // File attachment
      let pendingFiles = [];
      section.querySelector('#adminTicketFile').addEventListener('change', (e) => {
        pendingFiles = Array.from(e.target.files).slice(0, 5);
        const names = pendingFiles.map(f => f.name).join(', ');
        section.querySelector('#adminTicketFileNames').textContent = names;
      });

      // Send reply
      section.querySelector('#adminTicketSendReply').addEventListener('click', async () => {
        const textarea = section.querySelector('#adminTicketReply');
        const message = textarea.value.trim();
        if (!message) return;

        const statusEl = section.querySelector('#adminTicketReplyStatus');
        const btn = section.querySelector('#adminTicketSendReply');
        btn.disabled = true;
        statusEl.textContent = 'Sending...';

        try {
          const attachments = [];
          for (const file of pendingFiles) {
            const data = await fileToBase64(file);
            attachments.push({ fileName: file.name, mimeType: file.type, data });
          }

          await adminPost(`/api/admin/tickets/${ticketId}/messages`, { message, attachments });
          pendingFiles = [];
          loadTicketDetail(ticketId);
        } catch (err) {
          statusEl.textContent = 'Failed: ' + err.message;
          btn.disabled = false;
        }
      });
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load ticket: ${escHtml(e.message)}</p>`;
    }
  }

  function renderAttachments(atts) {
    if (!atts || atts.length === 0) return '';
    return `<div class="admin-attachment-list">${atts.map(a => {
      const isImage = a.file_type && a.file_type.startsWith('image/');
      if (isImage) {
        return `<img class="admin-attachment-thumb" src="/api/admin/ticket-files/${a.id}" alt="${escHtml(a.file_name)}" title="${escHtml(a.file_name)}" onclick="window.open('/api/admin/ticket-files/${a.id}', '_blank')" />`;
      }
      return `<a class="admin-attachment-file" href="/api/admin/ticket-files/${a.id}" target="_blank">${escHtml(a.file_name)}</a>`;
    }).join('')}</div>`;
  }

  function fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ─── Revenue ────────────────────────────────────────────────────────────────

  let revenueState = { period: 'daily', start: '', end: '' };

  async function loadRevenue() {
    const section = overlay.querySelector('#adminRevenue');
    const params = new URLSearchParams();
    params.set('period', revenueState.period);
    if (revenueState.start) params.set('start', revenueState.start);
    if (revenueState.end) params.set('end', revenueState.end);

    try {
      const data = await adminFetch(`/api/admin/reports/revenue?${params}`);

      section.innerHTML = `
        <h2 class="admin-section-title">Revenue Reports</h2>
        <div class="admin-report-controls">
          <label>Period:</label>
          <select id="adminRevenuePeriod">
            ${['daily', 'weekly', 'monthly', 'annually'].map(p => `<option value="${p}"${revenueState.period === p ? ' selected' : ''}>${p.charAt(0).toUpperCase() + p.slice(1)}</option>`).join('')}
          </select>
          <label>From:</label>
          <input type="date" id="adminRevenueStart" value="${revenueState.start}" />
          <label>To:</label>
          <input type="date" id="adminRevenueEnd" value="${revenueState.end}" />
          <button class="admin-btn secondary" id="adminRevenueApply">Apply</button>
        </div>

        <div class="admin-cards">
          <div class="admin-card">
            <div class="admin-card-label">Total Revenue</div>
            <div class="admin-card-value">${fmtCents(data.summary.totalRevenueCents)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">New Subscriptions</div>
            <div class="admin-card-value">${data.summary.newSubscriptions}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Cancellations</div>
            <div class="admin-card-value">${data.summary.cancellations}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Upgrades</div>
            <div class="admin-card-value">${data.summary.upgrades}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Failed Payments</div>
            <div class="admin-card-value">${data.summary.failedPayments}</div>
          </div>
        </div>

        ${data.data.length > 0 ? `
          <div class="admin-chart-wrap">
            <div class="admin-chart-title">Revenue Trend (${revenueState.period})</div>
            ${renderBarChart(data.data.reverse(), d => d.revenueCents, d => fmtDate(d.periodStart), { valueLabel: v => fmtCents(v) })}
          </div>
        ` : ''}

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Period</th><th>Transactions</th><th>Revenue</th><th>Unique Users</th></tr></thead>
            <tbody>
              ${data.data.length === 0 ? '<tr><td colspan="4" class="admin-empty">No data for this range</td></tr>' : ''}
              ${data.data.map(d => `
                <tr>
                  <td>${fmtDate(d.periodStart)}</td>
                  <td>${d.transactions}</td>
                  <td>${fmtCents(d.revenueCents)}</td>
                  <td>${d.uniqueUsers}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;

      section.querySelector('#adminRevenuePeriod').addEventListener('change', (e) => { revenueState.period = e.target.value; });
      section.querySelector('#adminRevenueStart').addEventListener('change', (e) => { revenueState.start = e.target.value; });
      section.querySelector('#adminRevenueEnd').addEventListener('change', (e) => { revenueState.end = e.target.value; });
      section.querySelector('#adminRevenueApply').addEventListener('click', () => loadRevenue());
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load revenue: ${escHtml(e.message)}</p>`;
    }
  }

  // ─── Analytics ──────────────────────────────────────────────────────────────

  async function loadAnalytics() {
    const section = overlay.querySelector('#adminAnalytics');
    section.innerHTML = '<p class="admin-empty">Loading analytics...</p>';

    try {
      const [users, platforms, storage, conversations] = await Promise.all([
        adminFetch('/api/admin/reports/users'),
        adminFetch('/api/admin/reports/platforms'),
        adminFetch('/api/admin/reports/storage'),
        adminFetch('/api/admin/reports/conversations'),
      ]);

      section.innerHTML = `
        <h2 class="admin-section-title">Analytics</h2>

        <!-- User Analytics -->
        <h3 style="color:var(--text);font-size:0.9rem;margin-bottom:0.75rem;">User Breakdown</h3>
        <div class="admin-cards">
          <div class="admin-card">
            <div class="admin-card-label">Free Users</div>
            <div class="admin-card-value">${users.tiers.freeUsers}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Premium Users</div>
            <div class="admin-card-value">${users.tiers.premiumUsers}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Active Subscriptions</div>
            <div class="admin-card-value">${users.tiers.activeSubscriptions}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Cancelled</div>
            <div class="admin-card-value">${users.tiers.cancelledSubscriptions}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Past Due</div>
            <div class="admin-card-value">${users.tiers.pastDueSubscriptions}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Unverified</div>
            <div class="admin-card-value">${users.tiers.unverifiedUsers}</div>
          </div>
        </div>

        ${users.registrationTrend.length > 0 ? `
          <div class="admin-chart-wrap">
            <div class="admin-chart-title">User Registrations (30 days)</div>
            ${renderBarChart(users.registrationTrend, d => d.count, d => fmtDate(d.day))}
          </div>
        ` : ''}

        <!-- Platform Analytics -->
        <h3 style="color:var(--text);font-size:0.9rem;margin:1.5rem 0 0.75rem;">Platform Breakdown</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Platform</th><th>Conversations</th><th>Messages</th></tr></thead>
            <tbody>
              ${platforms.byPlatform.map(p => `
                <tr>
                  <td><strong>${escHtml(p.platform)}</strong></td>
                  <td>${fmt(p.conversations)}</td>
                  <td>${fmt(p.messages)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Storage Analytics -->
        <h3 style="color:var(--text);font-size:0.9rem;margin:1.5rem 0 0.75rem;">Storage</h3>
        <div class="admin-cards">
          <div class="admin-card">
            <div class="admin-card-label">Total Used</div>
            <div class="admin-card-value">${fmtBytes(storage.aggregate.totalUsed)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Total Allocated</div>
            <div class="admin-card-value">${fmtBytes(storage.aggregate.totalAllocated)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Avg Per User</div>
            <div class="admin-card-value">${fmtBytes(storage.aggregate.avgUsed)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Users w/ Storage</div>
            <div class="admin-card-value">${storage.aggregate.usersWithStorage}</div>
          </div>
        </div>

        ${storage.byCategory.length > 0 ? `
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>Category</th><th>Files</th><th>Total Size</th></tr></thead>
              <tbody>
                ${storage.byCategory.map(c => `
                  <tr><td>${escHtml(c.category)}</td><td>${fmt(c.fileCount)}</td><td>${fmtBytes(c.totalBytes)}</td></tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        ${storage.topUsers.length > 0 ? `
          <h4 style="color:var(--muted);font-size:0.82rem;margin:1rem 0 0.5rem;">Top Storage Consumers</h4>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>User</th><th>Used</th><th>Limit</th><th>Tier</th></tr></thead>
              <tbody>
                ${storage.topUsers.map(u => `
                  <tr>
                    <td>${escHtml(u.username)} (${escHtml(u.email)})</td>
                    <td>${fmtBytes(u.usedBytes)}</td>
                    <td>${fmtBytes(u.limitBytes)}</td>
                    <td><span class="admin-badge ${u.tier}">${u.tier}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <!-- Conversation Analytics -->
        <h3 style="color:var(--text);font-size:0.9rem;margin:1.5rem 0 0.75rem;">Conversation Activity</h3>
        <div class="admin-cards">
          <div class="admin-card">
            <div class="admin-card-label">Total Conversations</div>
            <div class="admin-card-value">${fmt(conversations.totals.conversations)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Total Messages</div>
            <div class="admin-card-value">${fmt(conversations.totals.messages)}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Active Users (7d)</div>
            <div class="admin-card-value">${conversations.totals.activeUsers7d}</div>
          </div>
          <div class="admin-card">
            <div class="admin-card-label">Active Users (30d)</div>
            <div class="admin-card-value">${conversations.totals.activeUsers30d}</div>
          </div>
        </div>

        ${conversations.dailyIngestion.length > 0 ? `
          <div class="admin-chart-wrap">
            <div class="admin-chart-title">Daily Conversation Ingestion (30 days)</div>
            ${renderBarChart(conversations.dailyIngestion, d => d.conversations, d => fmtDate(d.day))}
          </div>
        ` : ''}
      `;
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load analytics: ${escHtml(e.message)}</p>`;
    }
  }

  // ─── System ─────────────────────────────────────────────────────────────────

  async function loadSystem() {
    const section = overlay.querySelector('#adminSystem');
    section.innerHTML = '<p class="admin-empty">Loading...</p>';

    try {
      const data = await adminFetch('/api/admin/reports/system');

      section.innerHTML = `
        <h2 class="admin-section-title">System Health</h2>
        <div class="admin-cards">
          <div class="admin-card">
            <div class="admin-card-label">Database Size</div>
            <div class="admin-card-value">${fmtBytes(data.databaseSizeBytes)}</div>
          </div>
        </div>

        <h3 style="color:var(--text);font-size:0.9rem;margin:1rem 0 0.75rem;">Subscription Events (24h)</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Event Type</th><th>Count</th><th>Last Occurred</th></tr></thead>
            <tbody>
              ${data.subscriptionEvents24h.length === 0 ? '<tr><td colspan="3" class="admin-empty">No events in last 24h</td></tr>' : ''}
              ${data.subscriptionEvents24h.map(e => `
                <tr><td>${escHtml(e.eventType)}</td><td>${e.count}</td><td>${fmtDateTime(e.lastAt)}</td></tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <h3 style="color:var(--text);font-size:0.9rem;margin:1.5rem 0 0.75rem;">Ticket Resolution Stats</h3>
        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>Status</th><th>Count</th><th>Avg Resolution Time</th></tr></thead>
            <tbody>
              ${data.ticketStats.map(t => {
                let resTime = '-';
                if (t.avgResolutionSeconds && t.status === 'resolved') {
                  const hrs = Math.round(t.avgResolutionSeconds / 3600);
                  resTime = hrs > 24 ? `${Math.round(hrs / 24)}d` : `${hrs}h`;
                }
                return `<tr><td><span class="admin-badge ${t.status}">${t.status}</span></td><td>${t.count}</td><td>${resTime}</td></tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    } catch (e) {
      section.innerHTML = `<p class="admin-empty">Failed to load system data: ${escHtml(e.message)}</p>`;
    }
  }

  // ─── SVG Bar Chart ──────────────────────────────────────────────────────────

  function renderBarChart(data, valueFn, labelFn, { valueLabel, width = 700, height = 180 } = {}) {
    if (!data || data.length === 0) return '<p class="admin-empty">No data</p>';

    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;
    const max = Math.max(...data.map(valueFn), 1);
    const barW = Math.max(4, Math.min(30, chartW / data.length - 2));
    const gap = (chartW - barW * data.length) / (data.length + 1);

    let svg = `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;

    // Grid lines
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + chartH - (chartH / 4) * i;
      const val = Math.round(max / 4 * i);
      svg += `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" class="chart-grid"/>`;
      svg += `<text x="${padding.left - 8}" y="${y + 3}" text-anchor="end">${valueLabel ? valueLabel(val) : val}</text>`;
    }

    // Bars
    data.forEach((d, i) => {
      const val = valueFn(d);
      const barH = (val / max) * chartH;
      const x = padding.left + gap + i * (barW + gap);
      const y = padding.top + chartH - barH;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" class="chart-bar" rx="2">
        <title>${labelFn(d)}: ${valueLabel ? valueLabel(val) : val}</title>
      </rect>`;

      // Labels (show every Nth to avoid overlap)
      const labelEvery = Math.ceil(data.length / 12);
      if (i % labelEvery === 0) {
        const label = labelFn(d).replace(/,?\s*\d{4}$/, '');
        svg += `<text x="${x + barW / 2}" y="${height - 5}" text-anchor="middle" style="font-size:9px">${label}</text>`;
      }
    });

    svg += '</svg>';
    return svg;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  function openAdmin() {
    if (!overlay) buildOverlay();
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';
    loadTabData(currentTab);
  }

  function closeAdmin() {
    if (overlay) overlay.hidden = true;
    document.body.style.overflow = '';
  }

  // Expose globally so app.js can call it
  window.openAdminPanel = openAdmin;
  window.closeAdminPanel = closeAdmin;
})();
