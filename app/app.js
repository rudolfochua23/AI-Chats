const PLATFORM_GROUPS = {
  claude: ['claudeai', 'claude-code'],
  chatgpt: ['chatgpt'],
  uncategorized: ['codex', 'copilot', 'cline', 'unknown'],
};

const AUTH_FALLBACK_PORTS = ['4173', '53173'];

const state = {
  dataset: null,
  filteredConversations: [],
  filteredCodeSnippets: [],
  selectedConversationId: null,
  globalQuery: '',
  platformFilter: 'all',
  exportTarget: 'chatgpt',
  chatQuery: '',
  codeQuery: '',
  appInitialized: false,
  activeRightTab: 'code',
  bookmarkQuery: '',
  pendingEmail: null,
  pendingResetToken: null,
  searchResults: {
    matches: [],
    currentIndex: 0,
    total: 0
  }
};

const els = {
  globalSearch: document.querySelector('#globalSearch'),
  platformFilter: document.querySelector('#platformFilter'),
  conversationList: document.querySelector('#conversationList'),
  chatTitle: document.querySelector('#chatTitle'),
  chatSearch: document.querySelector('#chatSearch'),
  exportTarget: document.querySelector('#exportTarget'),
  copyExportBtn: document.querySelector('#copyExportBtn'),
  downloadExportBtn: document.querySelector('#downloadExportBtn'),
  exportStatus: document.querySelector('#exportStatus'),
  searchResultsBar: document.querySelector('#searchResultsBar'),
  chatContent: document.querySelector('#chatContent'),
  codeList: document.querySelector('#codeList'),
  codeSearch: document.querySelector('#codeSearch'),
  bookmarkSearch: document.querySelector('#bookmarkSearch'),
  rightPanelTabs: document.querySelector('#rightPanelTabs'),
  bookmarkList: document.querySelector('#bookmarkList'),
  stats: document.querySelector('#stats'),
  // Login
  loginOverlay: document.querySelector('#loginOverlay'),
  loginForm: document.querySelector('#loginForm'),
  loginEmail: document.querySelector('#loginEmail'),
  loginPassword: document.querySelector('#loginPassword'),
  loginSubmit: document.querySelector('#loginSubmit'),
  loginStatus: document.querySelector('#loginStatus'),
  showRegisterBtn: document.querySelector('#showRegisterBtn'),
  showForgotBtn: document.querySelector('#showForgotBtn'),
  // Register
  registerOverlay: document.querySelector('#registerOverlay'),
  registerForm: document.querySelector('#registerForm'),
  regEmail: document.querySelector('#regEmail'),
  regUsername: document.querySelector('#regUsername'),
  regPassword: document.querySelector('#regPassword'),
  regConfirm: document.querySelector('#regConfirm'),
  registerSubmit: document.querySelector('#registerSubmit'),
  registerStatus: document.querySelector('#registerStatus'),
  showLoginFromRegisterBtn: document.querySelector('#showLoginFromRegisterBtn'),
  // Verify email
  verifyOverlay: document.querySelector('#verifyOverlay'),
  verifyForm: document.querySelector('#verifyForm'),
  verifyCode: document.querySelector('#verifyCode'),
  verifySubmit: document.querySelector('#verifySubmit'),
  verifyStatus: document.querySelector('#verifyStatus'),
  verifyEmailHint: document.querySelector('#verifyEmailHint'),
  resendCodeBtn: document.querySelector('#resendCodeBtn'),
  // Forgot password
  forgotOverlay: document.querySelector('#forgotOverlay'),
  forgotForm: document.querySelector('#forgotForm'),
  forgotEmail: document.querySelector('#forgotEmail'),
  forgotSubmit: document.querySelector('#forgotSubmit'),
  forgotStatus: document.querySelector('#forgotStatus'),
  showLoginFromForgotBtn: document.querySelector('#showLoginFromForgotBtn'),
  // Reset password
  resetOverlay: document.querySelector('#resetOverlay'),
  resetForm: document.querySelector('#resetForm'),
  resetPassword: document.querySelector('#resetPassword'),
  resetConfirm: document.querySelector('#resetConfirm'),
  resetSubmit: document.querySelector('#resetSubmit'),
  resetStatus: document.querySelector('#resetStatus'),
  showLoginFromResetBtn: document.querySelector('#showLoginFromResetBtn'),
  // Landing page
  landingPage: document.querySelector('#landingPage'),
  headerSignInBtn: document.querySelector('#headerSignInBtn'),
  mainLayout: document.querySelector('.layout'),
  // Settings
  settingsBtn: document.querySelector('#settingsBtn'),
  logoutBtn: document.querySelector('#logoutBtn'),
  settingsOverlay: document.querySelector('#settingsOverlay'),
  changePasswordForm: document.querySelector('#changePasswordForm'),
  currentPassword: document.querySelector('#currentPassword'),
  newPassword: document.querySelector('#newPassword'),
  confirmPassword: document.querySelector('#confirmPassword'),
  savePasswordBtn: document.querySelector('#savePasswordBtn'),
  closeSettingsBtn: document.querySelector('#closeSettingsBtn'),
  settingsStatus: document.querySelector('#settingsStatus'),
};

// =======================
// BOOKMARKS (localStorage)
// =======================
const BOOKMARKS_KEY = 'ai_chats_bookmarks';

function loadAllBookmarks() {
  try { return JSON.parse(localStorage.getItem(BOOKMARKS_KEY) || '{}'); } catch { return {}; }
}

function saveAllBookmarks(data) {
  localStorage.setItem(BOOKMARKS_KEY, JSON.stringify(data));
}

function getConversationBookmarks(conversationId) {
  return loadAllBookmarks()[conversationId] ?? [];
}

function isMessageBookmarked(conversationId, source, messageIndex, snapshotIndex) {
  return getConversationBookmarks(conversationId).some(
    (b) => b.source === source &&
           b.messageIndex === messageIndex &&
           (b.snapshotIndex ?? null) === (snapshotIndex ?? null)
  );
}

function toggleMessageBookmark(conversationId, bookmark) {
  const all = loadAllBookmarks();
  const list = all[conversationId] ?? [];
  const idx = list.findIndex(
    (b) => b.source === bookmark.source &&
           b.messageIndex === bookmark.messageIndex &&
           (b.snapshotIndex ?? null) === (bookmark.snapshotIndex ?? null)
  );
  if (idx >= 0) {
    list.splice(idx, 1);
  } else {
    // Globally unique default name: count all bookmarks across every conversation
    const globalTotal = Object.values(all).reduce((sum, arr) => sum + arr.length, 0);
    list.push({ ...bookmark, name: `Bookmark ${globalTotal + 1}`, createdAt: new Date().toISOString() });
  }
  if (list.length === 0) { delete all[conversationId]; } else { all[conversationId] = list; }
  saveAllBookmarks(all);
}

function renameBookmark(conversationId, bookmark, newName) {
  const all = loadAllBookmarks();
  const list = all[conversationId] ?? [];
  const idx = list.findIndex(
    (b) => b.source === bookmark.source &&
           b.messageIndex === bookmark.messageIndex &&
           (b.snapshotIndex ?? null) === (bookmark.snapshotIndex ?? null)
  );
  if (idx >= 0) {
    list[idx] = { ...list[idx], name: newName };
    all[conversationId] = list;
    saveAllBookmarks(all);
  }
}

bootstrap();

async function bootstrap() {
  try {
    bindAuthEvents();
  } catch (e) {
    console.error('bindAuthEvents failed:', e);
  }
  const session = await getAuthSession();
  if (!session.authenticated) {
    lockApp();
    return;
  }

  await unlockAndInitApp();
}

async function unlockAndInitApp() {
  unlockApp();
  if (state.appInitialized) return;

  const response = await fetch('./data/conversations.json');
  const rawDataset = await response.json();
  state.dataset = normalizeDataset(rawDataset);
  state.filteredConversations = [...state.dataset.conversations];
  state.filteredCodeSnippets = state.dataset.codeSnippets;
  renderStats();
  renderConversationList();
  renderCodeList();
  renderBookmarkList();
  bindEvents();
  state.appInitialized = true;
}

const AUTH_OVERLAY_KEYS = ['loginOverlay', 'registerOverlay', 'verifyOverlay', 'forgotOverlay', 'resetOverlay'];

function showAuthOverlay(overlayKey) {
  AUTH_OVERLAY_KEYS.forEach((key) => {
    if (els[key]) els[key].hidden = key !== overlayKey;
  });
}

function hideAllAuthOverlays() {
  AUTH_OVERLAY_KEYS.forEach((key) => {
    if (els[key]) els[key].hidden = true;
  });
}

function setAuthStatus(element, message, type) {
  element.textContent = message;
  element.classList.remove('error', 'success');
  if (type === 'error' || type === 'success') element.classList.add(type);
}

function bindAuthEvents() {
  // ── Login ──────────────────────────────────────────────────────────────────
  els.loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    els.loginSubmit.disabled = true;
    const email = els.loginEmail.value.trim();
    const password = els.loginPassword.value;

    try {
      const response = await apiPost('/api/auth/login', { email, password });
      if (!response.ok) {
        if (response.status === 0) {
          setAuthStatus(els.loginStatus, 'Auth API unavailable. Start the backend with npm start.', 'error');
          return;
        }
        const wait = response.lockedForSeconds ? ` Try again in ${response.lockedForSeconds}s.` : '';
        setAuthStatus(els.loginStatus, `${response.error || 'Invalid credentials.'}${wait}`, 'error');
        els.loginPassword.value = '';
        els.loginPassword.focus();
        return;
      }
      setAuthStatus(els.loginStatus, 'Login successful.', 'success');
      await unlockAndInitApp();
    } catch {
      setAuthStatus(els.loginStatus, 'Login failed. Please try again.', 'error');
    } finally {
      els.loginSubmit.disabled = false;
    }
  });

  els.showRegisterBtn.addEventListener('click', () => {
    els.registerForm.reset();
    setAuthStatus(els.registerStatus, '', '');
    showAuthOverlay('registerOverlay');
    els.regEmail.focus();
  });

  els.showForgotBtn.addEventListener('click', () => {
    els.forgotForm.reset();
    setAuthStatus(els.forgotStatus, '', '');
    showAuthOverlay('forgotOverlay');
    els.forgotEmail.focus();
  });

  // ── Register ───────────────────────────────────────────────────────────────
  els.registerForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = els.regEmail.value.trim();
    const username = els.regUsername.value.trim();
    const password = els.regPassword.value;
    const confirm = els.regConfirm.value;

    if (password !== confirm) {
      setAuthStatus(els.registerStatus, 'Passwords do not match.', 'error');
      return;
    }

    els.registerSubmit.disabled = true;
    try {
      const response = await apiPost('/api/auth/register', { email, username, password });
      if (!response.ok) {
        setAuthStatus(els.registerStatus, response.error || 'Registration failed.', 'error');
        return;
      }
      state.pendingEmail = email;
      els.verifyEmailHint.textContent = email;
      els.verifyForm.reset();
      setAuthStatus(els.verifyStatus, '', '');
      showAuthOverlay('verifyOverlay');
      els.verifyCode.focus();
    } catch {
      setAuthStatus(els.registerStatus, 'Registration failed. Please try again.', 'error');
    } finally {
      els.registerSubmit.disabled = false;
    }
  });

  els.showLoginFromRegisterBtn.addEventListener('click', () => {
    showAuthOverlay('loginOverlay');
    els.loginEmail.focus();
  });

  // ── Verify email ───────────────────────────────────────────────────────────
  els.verifyForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const code = els.verifyCode.value.trim();
    const email = state.pendingEmail;

    if (!email) {
      setAuthStatus(els.verifyStatus, 'Session expired. Please register again.', 'error');
      return;
    }

    els.verifySubmit.disabled = true;
    try {
      const response = await apiPost('/api/auth/verify-email', { email, code });
      if (!response.ok) {
        setAuthStatus(els.verifyStatus, response.error || 'Verification failed.', 'error');
        return;
      }
      state.pendingEmail = null;
      setAuthStatus(els.verifyStatus, 'Email verified! Welcome.', 'success');
      await unlockAndInitApp();
    } catch {
      setAuthStatus(els.verifyStatus, 'Verification failed. Please try again.', 'error');
    } finally {
      els.verifySubmit.disabled = false;
    }
  });

  els.resendCodeBtn.addEventListener('click', async () => {
    const email = state.pendingEmail;
    if (!email) return;
    try {
      await apiPost('/api/auth/resend-verification', { email });
      setAuthStatus(els.verifyStatus, 'A new code has been sent to your email.', 'success');
    } catch {
      setAuthStatus(els.verifyStatus, 'Failed to resend. Please try again.', 'error');
    }
  });

  // ── Forgot password ────────────────────────────────────────────────────────
  els.forgotForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = els.forgotEmail.value.trim();
    els.forgotSubmit.disabled = true;
    try {
      await apiPost('/api/auth/forgot-password', { email });
      setAuthStatus(els.forgotStatus, 'If that email has an account, a reset link has been sent.', 'success');
      els.forgotForm.reset();
    } catch {
      setAuthStatus(els.forgotStatus, 'Request failed. Please try again.', 'error');
    } finally {
      els.forgotSubmit.disabled = false;
    }
  });

  els.showLoginFromForgotBtn.addEventListener('click', () => {
    showAuthOverlay('loginOverlay');
    els.loginEmail.focus();
  });

  // ── Reset password ─────────────────────────────────────────────────────────
  els.resetForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const newPassword = els.resetPassword.value;
    const confirm = els.resetConfirm.value;
    const token = state.pendingResetToken;

    if (newPassword !== confirm) {
      setAuthStatus(els.resetStatus, 'Passwords do not match.', 'error');
      return;
    }

    if (!token) {
      setAuthStatus(els.resetStatus, 'Invalid reset link. Please request a new one.', 'error');
      return;
    }

    els.resetSubmit.disabled = true;
    try {
      const response = await apiPost('/api/auth/reset-password', { token, newPassword });
      if (!response.ok) {
        setAuthStatus(els.resetStatus, response.error || 'Password reset failed.', 'error');
        return;
      }
      state.pendingResetToken = null;
      setAuthStatus(els.resetStatus, 'Password reset! Redirecting to sign in…', 'success');
      setTimeout(() => {
        showAuthOverlay('loginOverlay');
        els.loginEmail.focus();
      }, 2000);
    } catch {
      setAuthStatus(els.resetStatus, 'Password reset failed. Please try again.', 'error');
    } finally {
      els.resetSubmit.disabled = false;
    }
  });

  els.showLoginFromResetBtn.addEventListener('click', () => {
    state.pendingResetToken = null;
    showAuthOverlay('loginOverlay');
    els.loginEmail.focus();
  });

  // ── Settings ───────────────────────────────────────────────────────────────
  els.settingsBtn.addEventListener('click', () => {
    els.changePasswordForm.reset();
    setAuthStatus(els.settingsStatus, '', '');
    els.settingsOverlay.hidden = false;
    els.currentPassword.focus();
  });

  els.closeSettingsBtn.addEventListener('click', () => {
    els.settingsOverlay.hidden = true;
  });

  els.changePasswordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const currentPassword = els.currentPassword.value;
    const newPassword = els.newPassword.value;
    const confirmPassword = els.confirmPassword.value;

    if (newPassword !== confirmPassword) {
      setAuthStatus(els.settingsStatus, 'New password and confirmation do not match.', 'error');
      return;
    }

    if (newPassword.length < 12) {
      setAuthStatus(els.settingsStatus, 'New password must be at least 12 characters.', 'error');
      return;
    }

    els.savePasswordBtn.disabled = true;
    try {
      const response = await apiPost('/api/auth/change-password', { currentPassword, newPassword });
      if (!response.ok) {
        setAuthStatus(els.settingsStatus, response.error || 'Unable to change password.', 'error');
        return;
      }
      setAuthStatus(els.settingsStatus, 'Password changed successfully.', 'success');
      els.changePasswordForm.reset();
    } catch {
      setAuthStatus(els.settingsStatus, 'Password update failed. Please try again.', 'error');
    } finally {
      els.savePasswordBtn.disabled = false;
    }
  });

  els.logoutBtn.addEventListener('click', () => {
    void logout();
  });

  // ── Landing page CTAs ──────────────────────────────────────────────────
  const showLogin = () => { showAuthOverlay('loginOverlay'); els.loginEmail.focus(); };
  const showRegister = () => {
    els.registerForm.reset();
    setAuthStatus(els.registerStatus, '', '');
    showAuthOverlay('registerOverlay');
    els.regEmail.focus();
  };

  els.headerSignInBtn.addEventListener('click', showLogin);
  document.getElementById('heroSignInBtn')?.addEventListener('click', showLogin);
  document.getElementById('heroGetStartedBtn')?.addEventListener('click', showRegister);
  document.querySelectorAll('.landing-signin-btn').forEach(b => b.addEventListener('click', showLogin));
  document.querySelectorAll('.landing-register-btn').forEach(b => b.addEventListener('click', showRegister));

  // Close auth overlays → back to landing page
  document.querySelectorAll('[data-close-overlay]').forEach(btn => {
    btn.addEventListener('click', () => hideAllAuthOverlays());
  });

  // Click outside auth card (on the dark backdrop) to close
  AUTH_OVERLAY_KEYS.forEach(key => {
    const overlay = els[key];
    if (!overlay) return;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) hideAllAuthOverlays();
    });
  });
}

async function logout() {
  try {
    await apiPost('/api/auth/logout', {});
  } finally {
    lockApp();
  }
}

function lockApp() {
  document.body.classList.add('auth-locked');
  els.settingsOverlay.hidden = true;
  els.settingsBtn.hidden = true;
  els.logoutBtn.hidden = true;
  els.headerSignInBtn.hidden = false;
  els.landingPage.hidden = false;
  els.mainLayout.hidden = true;

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('reset');

  if (resetToken) {
    state.pendingResetToken = resetToken;
    els.resetForm.reset();
    setAuthStatus(els.resetStatus, '', '');
    showAuthOverlay('resetOverlay');
  } else {
    hideAllAuthOverlays();
  }
}

function unlockApp() {
  document.body.classList.remove('auth-locked');
  hideAllAuthOverlays();
  els.settingsBtn.hidden = false;
  els.logoutBtn.hidden = false;
  els.headerSignInBtn.hidden = true;
  els.landingPage.hidden = true;
  els.mainLayout.hidden = false;

  const params = new URLSearchParams(window.location.search);
  if (params.has('reset')) {
    params.delete('reset');
    const newUrl = params.toString() ? `${window.location.pathname}?${params}` : window.location.pathname;
    window.history.replaceState({}, '', newUrl);
  }
}


async function getAuthSession() {
  try {
    const response = await authFetch('/api/auth/session', { method: 'GET' });
    if (!response) return { authenticated: false };
    if (!response.ok) return { authenticated: false };
    return await response.json();
  } catch {
    return { authenticated: false };
  }
}

async function apiPost(url, payload) {
  const response = await authFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response) {
    return {
      ok: false,
      status: 0,
      error: 'Auth service unavailable.',
    };
  }

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  return {
    ok: response.ok,
    status: response.status,
    ...body,
  };
}

function getAuthApiBases() {
  const bases = [window.location.origin];
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const canUsePortFallback = window.location.protocol === 'http:' && isLocalhost;

  if (canUsePortFallback) {
    AUTH_FALLBACK_PORTS.forEach((port) => {
      if (window.location.port !== port) {
        bases.push(`${window.location.protocol}//${window.location.hostname}:${port}`);
      }
    });
  }

  return Array.from(new Set(bases));
}

async function authFetch(path, options) {
  const bases = getAuthApiBases();

  for (const base of bases) {
    try {
      const response = await fetch(`${base}${path}`, {
        ...options,
        credentials: 'include',
      });

      if (response.status === 404) {
        continue;
      }

      return response;
    } catch {
      // Try the next base when network/CORS issues occur.
    }
  }

  return null;
}

function toEpoch(value) {
  const parsed = Date.parse(value ?? '');
  return Number.isNaN(parsed) ? 0 : parsed;
}

function sortByCapturedDesc(items) {
  return [...items].sort((a, b) => toEpoch(b.captured) - toEpoch(a.captured));
}

function toSnapshotEntry(conversation) {
  return {
    id: conversation.id,
    title: conversation.title,
    platform: conversation.platform,
    captured: conversation.captured,
    url: conversation.url ?? null,
    sourcePath: conversation.sourcePath,
    messages: [...(conversation.messages ?? [])],
    codeSnippets: [...(conversation.codeSnippets ?? [])],
  };
}

function dedupeSnapshots(snapshots) {
  const seen = new Set();
  return snapshots.filter((snapshot) => {
    const key = `${snapshot.id}::${snapshot.captured ?? 'unknown'}::${snapshot.sourcePath ?? ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCodeSnippetsFromConversations(conversations) {
  const snippets = [];

  conversations.forEach((conversation) => {
    (conversation.codeSnippets ?? []).forEach((snippet, snippetIndex) => {
      snippets.push({
        id: `${conversation.platform}::${conversation.id}::${snippetIndex}`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        platform: conversation.platform,
        captured: conversation.captured,
        ...snippet,
      });
    });

    (conversation.snapshots ?? []).forEach((snapshot, snapshotIndex) => {
      (snapshot.codeSnippets ?? []).forEach((snippet, snippetIndex) => {
        snippets.push({
          id: `${conversation.platform}::${snapshot.id}::snapshot::${snippetIndex}::${snapshot.captured ?? 'unknown'}`,
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          platform: conversation.platform,
          captured: snapshot.captured ?? conversation.captured,
          fromSnapshot: true,
          snapshotCaptured: snapshot.captured,
          snapshotIndex,
          ...snippet,
        });
      });
    });
  });

  return sortByCapturedDesc(snippets);
}

function normalizeDataset(dataset) {
  const byConversationId = new Map();
  let autoLinkedEntries = 0;

  (dataset.conversations ?? []).forEach((rawConversation) => {
    const normalized = {
      ...rawConversation,
      messages: [...(rawConversation.messages ?? [])],
      codeSnippets: [...(rawConversation.codeSnippets ?? [])],
      snapshots: [...(rawConversation.snapshots ?? [])],
    };

    const existing = byConversationId.get(normalized.id);
    if (!existing) {
      byConversationId.set(normalized.id, normalized);
      return;
    }

    if (toEpoch(normalized.captured) > toEpoch(existing.captured)) {
      normalized.snapshots = dedupeSnapshots([
        ...normalized.snapshots,
        ...existing.snapshots,
        toSnapshotEntry(existing),
      ]);
      autoLinkedEntries += 1;
      byConversationId.set(normalized.id, normalized);
      return;
    }

    existing.snapshots = dedupeSnapshots([
      ...existing.snapshots,
      ...normalized.snapshots,
      toSnapshotEntry(normalized),
    ]);
    autoLinkedEntries += 1;
  });

  const conversations = Array.from(byConversationId.values())
    .map((conversation) => ({
      ...conversation,
      snapshots: sortByCapturedDesc(dedupeSnapshots(conversation.snapshots ?? [])),
    }))
    .sort((a, b) => getLatestDate(b) - getLatestDate(a));

  const codeSnippets = buildCodeSnippetsFromConversations(conversations);
  const snapshotCount = conversations.reduce((sum, conversation) => sum + conversation.snapshots.length, 0);

  return {
    ...dataset,
    conversations,
    codeSnippets,
    stats: {
      conversations: conversations.length,
      snapshots: snapshotCount,
      codeSnippets: codeSnippets.length,
      autoLinkedEntries: autoLinkedEntries,
    },
  };
}

function bindEvents() {
  els.globalSearch.addEventListener('input', (event) => {
    state.globalQuery = event.target.value.trim().toLowerCase();
    applyConversationFilter();
    applyCodeFilter();
  });

  els.platformFilter.addEventListener('click', (event) => {
    const btn = event.target.closest('.filter-btn');
    if (!btn) return;
    state.platformFilter = btn.dataset.platform;
    els.platformFilter.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
    applyConversationFilter();
  });

  els.chatSearch.addEventListener('input', (event) => {
    state.chatQuery = event.target.value.trim().toLowerCase();
    renderChat();
  });

  els.exportTarget.addEventListener('change', (event) => {
    state.exportTarget = event.target.value;
    els.exportStatus.textContent = '';
  });

  els.copyExportBtn.addEventListener('click', async () => {
    const conversation = getCurrentConversation();
    if (!conversation) return;

    const payload = buildExportPayload(conversation, state.exportTarget);
    const copied = await copyTextToClipboard(payload);
    els.exportStatus.textContent = copied ? 'Export prompt copied to clipboard.' : 'Copy failed. Your browser blocked clipboard access.';
  });

  els.downloadExportBtn.addEventListener('click', () => {
    const conversation = getCurrentConversation();
    if (!conversation) return;

    const payload = buildExportPayload(conversation, state.exportTarget);
    const filename = `${slugify(conversation.title)}__for-${state.exportTarget}.md`;
    downloadTextFile(filename, payload);
    els.exportStatus.textContent = `Downloaded ${filename}`;
  });

  els.codeSearch.addEventListener('input', (event) => {
    state.codeQuery = event.target.value.trim().toLowerCase();
    applyCodeFilter();
  });

  els.bookmarkSearch.addEventListener('input', (event) => {
    state.bookmarkQuery = event.target.value.trim().toLowerCase();
    renderBookmarkList();
  });

  // Right panel tab switching (Code / Bookmarks)
  els.rightPanelTabs.addEventListener('click', (e) => {
    const tab = e.target.closest('.panel-tab');
    if (!tab) return;
    switchRightTab(tab.dataset.tab);
  });

  // Bookmark toggle — delegated on chat content so it survives re-renders
  els.chatContent.addEventListener('click', (e) => {
    const btn = e.target.closest('.bookmark-btn');
    if (!btn) return;
    const convId = btn.dataset.convId;
    const source = btn.dataset.source;
    const messageIndex = Number(btn.dataset.msgIndex);
    const snapshotIndex = btn.dataset.snapshotIndex !== '' ? Number(btn.dataset.snapshotIndex) : null;
    toggleMessageBookmark(convId, {
      source, messageIndex, snapshotIndex,
      role: btn.dataset.role,
      preview: btn.dataset.preview,
    });
    const nowBookmarked = isMessageBookmarked(convId, source, messageIndex, snapshotIndex);
    btn.classList.toggle('active', nowBookmarked);
    btn.title = nowBookmarked ? 'Remove bookmark' : 'Bookmark this message';
    renderBookmarkList();
  });

  // Add keyboard navigation for search results
  document.addEventListener('keydown', (e) => {
    if (!state.chatQuery) return;
    
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      moveSearchResult(-1);
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      moveSearchResult(1);
    }
  });
}

function switchRightTab(tabName) {
  state.activeRightTab = tabName;
  els.rightPanelTabs.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabName));
  const isCode = tabName === 'code';
  els.codeSearch.hidden = !isCode;
  els.bookmarkSearch.hidden = isCode;
  els.codeList.hidden = !isCode;
  els.bookmarkList.hidden = isCode;
}

function updateBookmarkTabCount() {
  const count = getConversationBookmarks(state.selectedConversationId ?? '').length;
  const tab = els.rightPanelTabs.querySelector('[data-tab="bookmarks"]');
  if (tab) tab.textContent = count > 0 ? `Bookmarks (${count})` : 'Bookmarks';
}

function moveSearchResult(step) {
  if (!state.searchResults.total) return;
  const nextIndex = Math.min(
    state.searchResults.total,
    Math.max(1, state.searchResults.currentIndex + step)
  );

  if (nextIndex === state.searchResults.currentIndex) return;

  state.searchResults.currentIndex = nextIndex;
  renderChat();
  scrollToCurrentResult();
}

function scrollToCurrentResult() {
  const targetId = state.searchResults.matches[state.searchResults.currentIndex - 1];
  if (targetId) {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function getBlockDomId(block) {
  if (block.source === 'main') {
    return `message-${block.index}`;
  }

  if (block.source === 'snapshot') {
    return `snapshot-${block.snapshotIndex}-message-${block.index}`;
  }

  return '';
}

function renderStats() {
  const { conversations, snapshots, codeSnippets } = state.dataset.stats;
  const autoLinkedEntries = Number(state.dataset.stats.autoLinkedEntries ?? 0);
  const generatedAt = new Date(state.dataset.generatedAt).toLocaleString();

  const parts = [
    `${conversations} chats`,
    `${snapshots} snapshots`,
    `${codeSnippets} code snippets`,
  ];

  if (autoLinkedEntries > 0) {
    parts.push(`${autoLinkedEntries} auto-linked entries`);
  }

  parts.push(`generated ${generatedAt}`);
  els.stats.textContent = parts.join(' · ');
}

function getLatestDate(conversation) {
  const dates = [new Date(conversation.captured)];
  conversation.snapshots.forEach((s) => dates.push(new Date(s.captured)));
  return Math.max(...dates);
}

function applyConversationFilter() {
  const query = state.globalQuery;
  const platformGroup = state.platformFilter !== 'all' ? PLATFORM_GROUPS[state.platformFilter] : null;
  state.filteredConversations = state.dataset.conversations
    .filter((conversation) => {
      if (platformGroup && !platformGroup.includes(conversation.platform)) return false;
      if (!query) return true;
      const haystack = [
        conversation.title,
        conversation.platform,
        ...conversation.messages.map((message) => `${message.role} ${message.text}`),
        ...conversation.snapshots.flatMap((snapshot) => snapshot.messages.map((message) => message.text)),
      ].join(' ').toLowerCase();

      return haystack.includes(query);
    })
    .sort((a, b) => getLatestDate(b) - getLatestDate(a));

  if (state.selectedConversationId && !state.filteredConversations.some((item) => item.id === state.selectedConversationId)) {
    state.selectedConversationId = null;
    state.chatQuery = '';
    els.chatSearch.value = '';
  }

  renderConversationList();
  renderChat();
  renderCodeList();
  renderBookmarkList();
}

function applyCodeFilter() {
  const combinedQuery = `${state.globalQuery} ${state.codeQuery}`.trim();
  state.filteredCodeSnippets = state.dataset.codeSnippets.filter((snippet) => {
    if (!combinedQuery) return true;
    const haystack = [
      snippet.conversationTitle,
      snippet.language,
      snippet.code,
      snippet.role,
      snippet.platform,
    ].join(' ').toLowerCase();

    return haystack.includes(combinedQuery);
  });

  renderCodeList();
}

function renderConversationList() {
  els.conversationList.innerHTML = '';

  state.filteredConversations.forEach((conversation) => {
    const li = document.createElement('li');
    li.className = conversation.id === state.selectedConversationId ? 'active' : '';
    li.innerHTML = `
      <div class="title-row">
        <span class="badge ${conversation.platform}">${conversation.platform}</span>
        <strong>${highlightText(conversation.title, state.globalQuery)}</strong>
      </div>
      <div class="meta">${formatDate(conversation.captured)} · ${conversation.messages.length} msgs · ${conversation.snapshots.length} snapshots</div>
    `;

    li.addEventListener('click', () => {
      state.selectedConversationId = conversation.id;
      state.exportTarget = getDefaultExportTarget(conversation.platform);
      els.exportTarget.value = state.exportTarget;
      state.chatQuery = '';
      els.chatSearch.value = '';
      els.exportStatus.textContent = '';
      renderConversationList();
      renderChat();
      renderCodeList();
      renderBookmarkList();
    });

    els.conversationList.appendChild(li);
  });
}

function renderChat() {
  const conversation = state.dataset.conversations.find((item) => item.id === state.selectedConversationId);

  if (!conversation) {
    els.chatTitle.textContent = 'Select a conversation';
    els.chatContent.innerHTML = '<p class="meta">Pick a chat on the left to view the full conversation + snapshots.</p>';
    els.chatSearch.disabled = true;
    els.exportTarget.disabled = true;
    els.copyExportBtn.disabled = true;
    els.downloadExportBtn.disabled = true;
    els.exportStatus.textContent = '';
    els.searchResultsBar.innerHTML = '';
    return;
  }

  els.chatTitle.textContent = `${conversation.title} (${conversation.platform})`;
  els.chatSearch.disabled = false;
  els.exportTarget.disabled = false;
  els.copyExportBtn.disabled = false;
  els.downloadExportBtn.disabled = false;

  const allBlocks = [];
  allBlocks.push(...conversation.messages.map((msg, index) => ({
    ...msg,
    index,
    source: 'main'
  })));

  conversation.snapshots.forEach((snapshot, snapshotIndex) => {
    allBlocks.push({
      role: `Snapshot · ${formatDate(snapshot.captured)}`,
      text: '',
      snapshotHeader: true,
    });
    allBlocks.push(...snapshot.messages.map((message, index) => ({
      ...message,
      index,
      snapshotIndex,
      source: 'snapshot'
    })));
  });

  const query = state.chatQuery;
  const matchingBlocks = allBlocks.filter((message) => {
    if (!query) return true;
    return `${message.role} ${message.text}`.toLowerCase().includes(query);
  });

  const previousTargetId = state.searchResults.matches[state.searchResults.currentIndex - 1] || '';
  state.searchResults.matches = matchingBlocks
    .filter((block) => !block.snapshotHeader)
    .map((block) => getBlockDomId(block))
    .filter(Boolean);
  state.searchResults.total = state.searchResults.matches.length;

  if (!state.searchResults.total) {
    state.searchResults.currentIndex = 0;
  } else {
    const previousIndex = state.searchResults.matches.indexOf(previousTargetId);
    state.searchResults.currentIndex = previousIndex >= 0 ? previousIndex + 1 : 1;
  }

  const activeResultId = state.searchResults.matches[state.searchResults.currentIndex - 1] || '';

  const rendered = matchingBlocks
    .map((message) => {
      if (message.snapshotHeader) {
        return `<div class="snapshot-group"><div class="snapshot-title">${escapeHtml(message.role)}</div></div>`;
      }

      const domId = getBlockDomId(message);
      const isCurrentResult = !!domId && domId === activeResultId;
      const roleNorm = (message.role || '').toLowerCase();
      const roleClass = roleNorm === 'user'
        ? 'role-user'
        : (roleNorm === 'assistant' || roleNorm === 'message' || roleNorm === 'conversation')
          ? 'role-assistant'
          : '';
      const bookmarked = isMessageBookmarked(
        state.selectedConversationId,
        message.source,
        message.index,
        message.snapshotIndex ?? null
      );
      return `
        <article class="message ${roleClass} ${isCurrentResult ? 'current-result' : ''}" id="${domId}">
          <div class="message-header">
            <h3>${escapeHtml(message.role)}</h3>
            <button class="bookmark-btn${bookmarked ? ' active' : ''}"
              data-conv-id="${escapeHtml(state.selectedConversationId)}"
              data-source="${message.source}"
              data-msg-index="${message.index}"
              data-snapshot-index="${message.snapshotIndex ?? ''}"
              data-role="${escapeHtml(message.role)}"
              data-preview="${escapeHtml(message.text.slice(0, 200))}"
              title="${bookmarked ? 'Remove bookmark' : 'Bookmark this message'}"
            >★</button>
          </div>
          <div>${renderText(message.text, query)}</div>
        </article>
      `;
    })
    .join('');

  const resultCount = query ? 
    `<div class="search-results">
      <span class="result-count">${state.searchResults.total} results</span>
      ${state.searchResults.total > 0 ? 
        `<span class="result-position">${state.searchResults.currentIndex} of ${state.searchResults.total}</span>
         <button class="nav-btn prev-btn" ${state.searchResults.currentIndex <= 1 ? 'disabled' : ''}>↑ Previous</button>
         <button class="nav-btn next-btn" ${state.searchResults.currentIndex >= state.searchResults.total ? 'disabled' : ''}>↓ Next</button>` : ''}
    </div>` : '';

  els.searchResultsBar.innerHTML = resultCount;
  els.chatContent.innerHTML = rendered || '<p class="meta">No matching content in this chat.</p>';

  // Bind navigation events
  if (query) {
    els.searchResultsBar.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.classList.contains('prev-btn')) {
          moveSearchResult(-1);
        } else {
          moveSearchResult(1);
        }
      });
    });
  }

  // Auto-scroll to bottom (latest messages) when selecting a conversation
  if (!query) {
    els.chatContent.scrollTop = els.chatContent.scrollHeight;
  }
}

function renderCodeList() {
  els.codeList.innerHTML = '';

  if (!state.selectedConversationId) {
    els.codeList.innerHTML = '<li class="empty-state">Select a conversation to view its code snippets.</li>';
    return;
  }

  const snippets = state.filteredCodeSnippets
    .filter((s) => s.conversationId === state.selectedConversationId)
    .slice(0, 300);

  if (!snippets.length) {
    els.codeList.innerHTML = '<li class="empty-state">No code snippets in this conversation.</li>';
    return;
  }

  snippets.forEach((snippet) => {
    const convId = state.selectedConversationId;
    const source = snippet.fromSnapshot ? 'snapshot' : 'main';
    const snapshotIndex = snippet.snapshotIndex ?? null;
    const bookmarked = isMessageBookmarked(convId, source, snippet.messageIndex, snapshotIndex);

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title-row">
        <span class="lang-badge lang-${escapeHtml(snippet.language)}">${escapeHtml(snippet.language)}</span>
        <button class="bookmark-btn${bookmarked ? ' active' : ''}"
          title="${bookmarked ? 'Remove bookmark' : 'Bookmark this message'}"
          data-conv-id="${escapeHtml(convId)}"
          data-source="${source}"
          data-msg-index="${snippet.messageIndex}"
          data-snapshot-index="${snapshotIndex ?? ''}"
          data-role="${escapeHtml(snippet.role)}"
          data-preview="${escapeHtml(snippet.code.slice(0, 200))}"
        >★</button>
      </div>
      <div class="meta">${formatDate(snippet.captured)}</div>
      <pre>${escapeHtml(snippet.code.slice(0, 250))}</pre>
    `;

    const targetId = snippet.fromSnapshot && snippet.snapshotIndex !== undefined
      ? `snapshot-${snippet.snapshotIndex}-message-${snippet.messageIndex}`
      : `message-${snippet.messageIndex}`;

    // Navigate to the message when clicking the card body
    li.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-btn')) return;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.style.outline = '2px solid var(--accent)';
        setTimeout(() => { target.style.outline = 'none'; }, 1200);
      }
    });

    // Bookmark toggle directly on the code card
    li.querySelector('.bookmark-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const btn = e.currentTarget;
      toggleMessageBookmark(convId, {
        source, messageIndex: snippet.messageIndex, snapshotIndex,
        role: snippet.role,
        preview: snippet.code.slice(0, 200),
      });
      const nowBookmarked = isMessageBookmarked(convId, source, snippet.messageIndex, snapshotIndex);
      btn.classList.toggle('active', nowBookmarked);
      btn.title = nowBookmarked ? 'Remove bookmark' : 'Bookmark this message';
      // Sync the star on the chat message too
      const article = document.getElementById(targetId);
      if (article) {
        const starBtn = article.querySelector('.bookmark-btn');
        if (starBtn) {
          starBtn.classList.toggle('active', nowBookmarked);
          starBtn.title = nowBookmarked ? 'Remove bookmark' : 'Bookmark this message';
        }
      }
      renderBookmarkList();
      // Auto-switch to Bookmarks tab so the user sees the new entry
      if (nowBookmarked) switchRightTab('bookmarks');
    });

    els.codeList.appendChild(li);
  });
}

function renderBookmarkList() {
  els.bookmarkList.innerHTML = '';
  const conversationId = state.selectedConversationId;

  if (!conversationId) {
    els.bookmarkList.innerHTML = '<li class="empty-state">Select a conversation to view bookmarks.</li>';
    updateBookmarkTabCount();
    return;
  }

  const allBookmarks = getConversationBookmarks(conversationId);

  if (!allBookmarks.length) {
    els.bookmarkList.innerHTML = '<li class="empty-state">No bookmarks yet — click ★ on any message or code snippet to save it here.</li>';
    updateBookmarkTabCount();
    return;
  }

  const query = state.bookmarkQuery;
  const bookmarks = query
    ? allBookmarks.filter((b) => {
        const haystack = `${b.name ?? ''} ${b.role ?? ''} ${b.preview ?? ''}`.toLowerCase();
        return haystack.includes(query);
      })
    : allBookmarks;

  if (!bookmarks.length) {
    els.bookmarkList.innerHTML = `<li class="empty-state">No bookmarks match "${escapeHtml(query)}".</li>`;
    updateBookmarkTabCount();
    return;
  }

  bookmarks.forEach((bookmark) => {
    const targetId = bookmark.source === 'snapshot' && bookmark.snapshotIndex !== null && bookmark.snapshotIndex !== undefined
      ? `snapshot-${bookmark.snapshotIndex}-message-${bookmark.messageIndex}`
      : `message-${bookmark.messageIndex}`;

    const li = document.createElement('li');
    li.innerHTML = `
      <div class="bookmark-name-row">
        <span class="bookmark-name">${escapeHtml(bookmark.name ?? 'Bookmark')}</span>
        <button class="rename-btn" title="Rename">✏</button>
        <button class="bookmark-remove" title="Remove">×</button>
      </div>
      <div class="title-row">
        <span class="role-badge ${escapeHtml((bookmark.role || '').toLowerCase())}">${escapeHtml(bookmark.role)}</span>
        <span class="meta">${formatDate(bookmark.createdAt)}</span>
      </div>
      <p class="bookmark-preview">${escapeHtml(bookmark.preview)}${(bookmark.preview ?? '').length >= 200 ? '…' : ''}</p>
    `;

    // Navigate to message on card click
    li.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-remove, .rename-btn, .rename-input')) return;
      const target = document.getElementById(targetId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('bookmark-flash');
        setTimeout(() => target.classList.remove('bookmark-flash'), 1200);
      }
    });

    // Inline rename
    li.querySelector('.rename-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      const nameSpan = li.querySelector('.bookmark-name');
      const renameBtn = li.querySelector('.rename-btn');
      const input = document.createElement('input');
      input.className = 'rename-input';
      input.value = bookmark.name ?? 'Bookmark';
      input.maxLength = 60;
      nameSpan.replaceWith(input);
      renameBtn.hidden = true;
      input.focus();
      input.select();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const newName = input.value.trim() || bookmark.name;
        renameBookmark(conversationId, bookmark, newName);
        bookmark.name = newName;
        const span = document.createElement('span');
        span.className = 'bookmark-name';
        span.textContent = newName;
        input.replaceWith(span);
        renameBtn.hidden = false;
        updateBookmarkTabCount();
      };
      const cancel = () => {
        if (committed) return;
        committed = true;
        const span = document.createElement('span');
        span.className = 'bookmark-name';
        span.textContent = bookmark.name ?? 'Bookmark';
        input.replaceWith(span);
        renameBtn.hidden = false;
      };

      input.addEventListener('keydown', (ke) => {
        if (ke.key === 'Enter') { ke.preventDefault(); commit(); }
        if (ke.key === 'Escape') { ke.preventDefault(); cancel(); }
      });
      input.addEventListener('blur', commit);
    });

    // Remove bookmark
    li.querySelector('.bookmark-remove').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMessageBookmark(conversationId, bookmark);
      const article = document.getElementById(targetId);
      if (article) {
        const starBtn = article.querySelector('.bookmark-btn');
        if (starBtn) { starBtn.classList.remove('active'); starBtn.title = 'Bookmark this message'; }
      }
      renderBookmarkList();
    });

    els.bookmarkList.appendChild(li);
  });

  updateBookmarkTabCount();
}

function renderText(text, highlightQuery) {
  const escaped = escapeHtml(text);
  const codeTransformed = escaped.replace(/```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g, (_, lang, code) => {
    return `<pre><code data-language="${lang || 'plaintext'}">${code.trim()}</code></pre>`;
  });

  if (!highlightQuery) return codeTransformed.replace(/\n/g, '<br>');

  const pattern = escapeRegex(highlightQuery);
  return codeTransformed
    .replace(/\n/g, '<br>')
    .replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}

function getCurrentConversation() {
  return state.dataset.conversations.find((item) => item.id === state.selectedConversationId) ?? null;
}

function getDefaultExportTarget(sourcePlatform) {
  if (sourcePlatform === 'chatgpt') return 'claude';
  if (sourcePlatform === 'claudeai' || sourcePlatform === 'claude-code') return 'chatgpt';
  return 'generic';
}

function normalizePlatformName(platform) {
  if (platform === 'chatgpt') return 'ChatGPT';
  if (platform === 'claudeai' || platform === 'claude-code') return 'Claude';
  return platform;
}

function buildExportPrompt(conversation, targetPlatform) {
  const sourceName = normalizePlatformName(conversation.platform);
  const targetName = targetPlatform === 'chatgpt'
    ? 'ChatGPT'
    : targetPlatform === 'claude'
      ? 'Claude'
      : 'a general-purpose LLM assistant';
  const snapshotCount = conversation.snapshots.length;
  const targetOpening = targetPlatform === 'generic'
    ? 'You are a general-purpose AI assistant.'
    : `You are ${targetName}.`;

  return [
    targetOpening,
    `I am importing a conversation exported from ${sourceName}.`,
    'Read the full context below carefully before replying.',
    'Treat all previous messages as prior context in the same ongoing thread.',
    'Do not summarize unless I ask; continue from the latest user intent.',
    `Conversation title: ${conversation.title}`,
    `Captured: ${formatDate(conversation.captured)}`,
    `Included snapshots: ${snapshotCount}`,
    '',
    '--- BEGIN IMPORTED CONTEXT ---',
  ].join('\n');
}

function formatMessagesBlock(messages) {
  return messages
    .map((message) => `## ${message.role}\n\n${message.text}`)
    .join('\n\n');
}

function buildExportPayload(conversation, targetPlatform) {
  const header = buildExportPrompt(conversation, targetPlatform);
  const mainConversation = [
    '# Main Conversation',
    formatMessagesBlock(conversation.messages),
  ].join('\n\n');

  const snapshots = conversation.snapshots
    .map((snapshot, index) => {
      return [
        `# Snapshot ${index + 1} (${formatDate(snapshot.captured)})`,
        formatMessagesBlock(snapshot.messages),
      ].join('\n\n');
    })
    .join('\n\n');

  const footer = '\n\n--- END IMPORTED CONTEXT ---\n';
  return [header, mainConversation, snapshots].filter(Boolean).join('\n\n') + footer;
}

async function copyTextToClipboard(value) {
  if (!navigator.clipboard?.writeText) {
    return false;
  }

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'conversation-export';
}

function formatDate(value) {
  if (!value) return 'Unknown date';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function escapeHtml(value = '') {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function highlightText(text, query) {
  const escaped = escapeHtml(text);
  if (!query) return escaped;
  const pattern = escapeRegex(query);
  return escaped.replace(new RegExp(`(${pattern})`, 'gi'), '<mark>$1</mark>');
}
