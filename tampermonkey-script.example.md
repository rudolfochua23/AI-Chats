// ==UserScript==
// @name         AI Chats Logger → GitHub (ChatGPT + Claude, Hybrid Title Sync, Draggable)
// @namespace    jerlan-project
// @version      3.2.0
// @description  Save ChatGPT and Claude conversations to GitHub as Markdown. Hybrid title lock with manual sync, snapshots, autosave, platform folders, source suffix, and draggable panel.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
// @match        https://gemini.google.com/*
// @match        https://copilot.microsoft.com/*
// @match        https://www.perplexity.ai/*
// @match        https://perplexity.ai/*
// @match        https://chat.deepseek.com/*
// @match        https://grok.com/*
// @match        https://x.com/i/grok*
// @match        https://chat.mistral.ai/*
// @match        https://huggingface.co/chat/*
// @match        https://poe.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_deleteValue
// @grant        GM_xmlhttpRequest
// @connect      api.github.com
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  // =======================
  // CONFIG
  // =======================
  const GH_OWNER = "YOUR_GITHUB_USERNAME";       // ← Replace with your GitHub username
  const GH_REPO = "YOUR_REPO_NAME";              // ← Replace with your repository name
  const GH_PATH_PREFIX = "logs/conversations";
  const SNAPSHOT_SUBFOLDER = "snapshots";
  const BRANCH = "main";

  const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

  // =======================
  // STORAGE KEYS
  // =======================
  const K_TOKEN = "jerlan_gh_token";
  const K_AUTOSAVE = "jerlan_autosave_enabled";
  const K_LAST_HASH_BY_CONV = "jerlan_last_saved_hash_by_conv";
  const K_LAST_SAVED_AT_BY_CONV = "jerlan_last_saved_at_by_conv";
  const K_COLLAPSED = "jerlan_logger_collapsed";
  const K_LOCKED_TITLE_BY_KEY = "jerlan_locked_title_by_key";
  const K_LOCKED_PATH_BY_KEY = "jerlan_locked_path_by_key";
  const K_PANEL_POS = "jerlan_logger_panel_pos";

  // =======================
  // HELPERS
  // =======================
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowISO = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, "0");

  const dateStamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}__${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
  };

  function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return String(h);
  }

  function slugifyTitle(title) {
    return String(title || "untitled-chat")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
      .replace(/&/g, " and ")
      .replace(/[\s\/\\:|*?"<>#%]+/g, "-")
      .replace(/[^a-z0-9._-]+/g, "")
      .replace(/-+/g, "-")
      .replace(/^[-._]+|[-._]+$/g, "")
      .slice(0, 100) || "untitled-chat";
  }

  function b64encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }

  function toast(msg, ms = 3400) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 999999;
      background: rgba(0,0,0,.88);
      color: #fff;
      padding: 10px 12px;
      border-radius: 10px;
      font: 12px/1.35 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      box-shadow: 0 6px 18px rgba(0,0,0,.3);
      max-width: 420px;
      white-space: pre-wrap;
    `;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), ms);
  }

  function getToken() { return GM_getValue(K_TOKEN, ""); }
  function setToken(v) { GM_setValue(K_TOKEN, v); }
  function clearToken() { GM_deleteValue(K_TOKEN); }

  function getAutosave() { return !!GM_getValue(K_AUTOSAVE, false); }
  function setAutosave(v) { GM_setValue(K_AUTOSAVE, !!v); }

  function getMap(key) {
    const v = GM_getValue(key, "{}");
    try {
      return JSON.parse(v) || {};
    } catch {
      return {};
    }
  }

  function setMap(key, obj) {
    GM_setValue(key, JSON.stringify(obj || {}));
  }

  function getLastHash(convKey) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    return m[convKey] || "";
  }

  function setLastHash(convKey, hash) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    m[convKey] = hash;
    setMap(K_LAST_HASH_BY_CONV, m);
  }

  function getLastSavedAt(convKey) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    return m[convKey] || 0;
  }

  function setLastSavedAt(convKey, ts) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    m[convKey] = ts;
    setMap(K_LAST_SAVED_AT_BY_CONV, m);
  }

  function getLockedTitle(convKey) {
    const m = getMap(K_LOCKED_TITLE_BY_KEY);
    return m[convKey] || "";
  }

  function setLockedTitle(convKey, title) {
    const m = getMap(K_LOCKED_TITLE_BY_KEY);
    m[convKey] = title;
    setMap(K_LOCKED_TITLE_BY_KEY, m);
  }

  function getLockedPath(convKey) {
    const m = getMap(K_LOCKED_PATH_BY_KEY);
    return m[convKey] || "";
  }

  function setLockedPath(convKey, path) {
    const m = getMap(K_LOCKED_PATH_BY_KEY);
    m[convKey] = path;
    setMap(K_LOCKED_PATH_BY_KEY, m);
  }

  function getPanelPos() {
    const v = GM_getValue(K_PANEL_POS, "");
    try {
      return v ? JSON.parse(v) : null;
    } catch {
      return null;
    }
  }

  function setPanelPos(pos) {
    GM_setValue(K_PANEL_POS, JSON.stringify(pos || {}));
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function detectPlatform() {
    const host = location.hostname;
    if (host.includes("claude.ai")) return "claudeai";
    return "chatgpt";
  }

  function getConversationIdFromUrl() {
    const p = location.pathname || "";
    const host = location.hostname;

    if (host.includes("claude.ai")) {
      const mClaude = p.match(/\/chat\/([^\/?#]+)/i);
      if (mClaude && mClaude[1]) return mClaude[1];
    }

    const m1 = p.match(/\/c\/([^\/?#]+)/i);
    if (m1 && m1[1]) return m1[1];

    const m2 = p.match(/\/chat\/([^\/?#]+)/i);
    if (m2 && m2[1]) return m2[1];

    return "url_" + simpleHash(location.href);
  }

  function getConversationKey(platform, convId) {
    return `${platform}::${convId}`;
  }

  function getBestTitle() {
    const platform = detectPlatform();

    const titleFromDocument = (document.title || "")
      .replace(/\s*-\s*ChatGPT\s*$/i, "")
      .replace(/\s*-\s*Claude\s*$/i, "")
      .trim();

    if (
      titleFromDocument &&
      !/^chatgpt$/i.test(titleFromDocument) &&
      !/^claude$/i.test(titleFromDocument)
    ) {
      return titleFromDocument;
    }

    const selectorsByPlatform = platform === "claudeai"
      ? [
          "main h1",
          "header h1",
          "[data-testid='chat-title']",
          "[contenteditable='true']",
          "title"
        ]
      : [
          "main h1",
          "header h1",
          "nav a[aria-current='page']",
          "[data-testid='conversation-title']"
        ];

    for (const sel of selectorsByPlatform) {
      const el = document.querySelector(sel);
      const text = (el?.textContent || "").trim();
      if (text && !/^chatgpt$/i.test(text) && !/^claude$/i.test(text)) {
        return text;
      }
    }

    return platform === "claudeai" ? "Untitled Claude Chat" : "Untitled ChatGPT Chat";
  }

  function getOrLockTitle(convKey, currentTitle) {
    const locked = getLockedTitle(convKey);
    if (locked) return locked;

    setLockedTitle(convKey, currentTitle);
    return currentTitle;
  }

  function getPlatformBaseFolder(platform) {
    return `${GH_PATH_PREFIX}/${platform}`;
  }

  function getPlatformSnapshotFolder(platform) {
    return `${getPlatformBaseFolder(platform)}/${SNAPSHOT_SUBFOLDER}`;
  }

  function enableDrag(wrap, handle) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startLeft = 0;
    let startTop = 0;

    const onMove = (e) => {
      if (!dragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      const maxLeft = Math.max(0, window.innerWidth - wrap.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - wrap.offsetHeight);

      const nextLeft = clamp(startLeft + dx, 0, maxLeft);
      const nextTop = clamp(startTop + dy, 0, maxTop);

      wrap.style.left = `${nextLeft}px`;
      wrap.style.top = `${nextTop}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";
    };

    const onUp = () => {
      if (!dragging) return;
      dragging = false;

      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);

      setPanelPos({
        left: parseInt(wrap.style.left, 10) || 0,
        top: parseInt(wrap.style.top, 10) || 0
      });
    };

    handle.addEventListener("mousedown", (e) => {
      if (e.target.closest("button, input, label")) return;

      dragging = true;
      startX = e.clientX;
      startY = e.clientY;

      const rect = wrap.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;

      wrap.style.left = `${rect.left}px`;
      wrap.style.top = `${rect.top}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);

      e.preventDefault();
    });

    window.addEventListener("resize", () => {
      const rect = wrap.getBoundingClientRect();
      const maxLeft = Math.max(0, window.innerWidth - wrap.offsetWidth);
      const maxTop = Math.max(0, window.innerHeight - wrap.offsetHeight);

      const nextLeft = clamp(rect.left, 0, maxLeft);
      const nextTop = clamp(rect.top, 0, maxTop);

      wrap.style.left = `${nextLeft}px`;
      wrap.style.top = `${nextTop}px`;
      wrap.style.right = "auto";
      wrap.style.bottom = "auto";

      setPanelPos({ left: nextLeft, top: nextTop });
    });
  }

  // =======================
  // EXTRACT CONVERSATION
  // =======================
  function extractChatGPTMarkdown() {
    const rawTitle = getBestTitle();
    const convId = getConversationIdFromUrl();
    const platform = detectPlatform();
    const convKey = getConversationKey(platform, convId);
    const roleNodes = document.querySelectorAll("[data-message-author-role]");
    const messages = [];

    if (roleNodes && roleNodes.length) {
      roleNodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role") || "unknown";
        const mdNode = node.querySelector(".markdown, .prose, [class*='markdown'], [class*='prose']") || node;
        const text = (mdNode.innerText || "").trim();
        if (text) messages.push({ role, text });
      });
    } else {
      const main = document.querySelector("main");
      const text = main ? (main.innerText || "").trim() : "";
      if (text) messages.push({ role: "conversation", text });
    }

    let md = `# Conversation Log\n\n`;
    md += `- Platform: ${platform}\n`;
    md += `- Conversation ID: ${convId}\n`;
    md += `- Title: ${rawTitle}\n`;
    md += `- Captured: ${nowISO()}\n`;
    md += `- URL: ${location.href}\n\n---\n\n`;

    if (!messages.length) {
      md += `_No messages detected. The UI may have changed._\n`;
      return { convId, convKey, title: rawTitle, md, platform };
    }

    for (const m of messages) {
      const who =
        m.role === "user" ? "User" :
        m.role === "assistant" ? "Assistant" :
        m.role ? m.role : "Unknown";

      md += `## ${who}\n\n${m.text}\n\n`;
    }

    return { convId, convKey, title: rawTitle, md, platform };
  }

  // Scroll the Claude conversation to load all messages into the DOM,
  // then restore the original scroll position.
  async function scrollToLoadAllClaudeMessages() {
    const scroller =
      document.querySelector('[class*="overflow-y-auto"]') ||
      document.querySelector("main") ||
      document.documentElement;

    const originalScrollTop = scroller.scrollTop;

    // Scroll to top first
    scroller.scrollTop = 0;
    await sleep(500);

    // Scroll down in steps to trigger rendering of all virtualized messages
    const step = Math.max(window.innerHeight * 0.8, 400);
    let pos = 0;
    while (pos < scroller.scrollHeight) {
      pos += step;
      scroller.scrollTop = pos;
      await sleep(250);
    }

    // Final pause at bottom, then restore position
    await sleep(400);
    scroller.scrollTop = originalScrollTop;
    await sleep(200);
  }

  function extractClaudeMarkdown() {
    const rawTitle = getBestTitle();
    const convId = getConversationIdFromUrl();
    const platform = detectPlatform();
    const convKey = getConversationKey(platform, convId);
    const messages = [];

    // Strategy 1: data-testid="user-message" + sibling AI turns (most reliable)
    // Claude marks human turns with this testid; AI turns are adjacent siblings.
    const userNodes = [...document.querySelectorAll('[data-testid="user-message"]')];

    if (userNodes.length > 0) {
      // Walk up to find the per-turn wrapper, then get all sibling turn wrappers
      // in DOM order to reconstruct the full conversation.
      const firstTurnWrapper = userNodes[0].closest('[class*="group"], article, [data-testid]')
        ?.parentElement;

      if (firstTurnWrapper) {
        const turns = [...firstTurnWrapper.children];
        for (const turn of turns) {
          const userMsg = turn.querySelector('[data-testid="user-message"]');
          if (userMsg) {
            const text = (userMsg.innerText || "").trim();
            if (text) messages.push({ role: "user", text });
          } else {
            // AI turn — find prose container and strip all interactive chrome before reading text
            const proseEl =
              turn.querySelector(".font-claude-message") ||
              turn.querySelector('[class*="prose"]') ||
              turn.querySelector('[class*="response"]');

            const targetEl = proseEl || turn;
            const clone = targetEl.cloneNode(true);
            // Remove buttons, vote controls, copy-code widgets, SVG icons, toolbars
            clone.querySelectorAll(
              'button, [role="button"], svg, form, ' +
              '[class*="action"], [class*="toolbar"], [class*="copy"], ' +
              '[class*="vote"], [class*="footer"], [class*="controls"]'
            ).forEach((el) => el.remove());
            const text = (clone.innerText || "").trim();
            // Only record if there is meaningful content (not just stray UI labels)
            if (text && text.length > 10) messages.push({ role: "assistant", text });
          }
        }
      }

      // If wrapper walk failed, fall back to pairing user nodes with their
      // nearest following sibling AI node
      if (!messages.length) {
        userNodes.forEach((node) => {
          const text = (node.innerText || "").trim();
          if (text) messages.push({ role: "user", text });

          // Look for the AI response that immediately follows this human turn
          let sibling = node.closest("div, article")?.nextElementSibling;
          while (sibling) {
            const aiText = (sibling.innerText || "").trim();
            if (aiText && aiText !== text) {
              messages.push({ role: "assistant", text: aiText });
              break;
            }
            sibling = sibling.nextElementSibling;
          }
        });
      }
    }

    // Strategy 2: main article elements in DOM order (fallback)
    if (!messages.length) {
      const articles = [...document.querySelectorAll("main article")];
      articles.forEach((article, i) => {
        const text = (article.innerText || "").trim();
        if (!text) return;
        // Claude articles alternate: human first, then AI
        const role = i % 2 === 0 ? "user" : "assistant";
        messages.push({ role, text });
      });
    }

    // Strategy 3: broad attribute search sorted by DOM order (last resort)
    if (!messages.length) {
      const seen = new Set();
      const nodes = [
        ...document.querySelectorAll('[data-testid*="human"], [data-testid*="user"]'),
        ...document.querySelectorAll('[data-testid*="assistant"], [data-testid*="claude"]'),
        ...document.querySelectorAll('[class*="human-turn"], [class*="assistant-turn"]'),
      ].sort((a, b) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

      for (const node of nodes) {
        const text = (node.innerText || "").trim();
        if (!text || seen.has(text)) continue;
        seen.add(text);

        const lower = `${node.getAttribute("data-testid") || ""} ${node.className || ""}`.toLowerCase();
        const role =
          lower.includes("user") || lower.includes("human") ? "user" :
          lower.includes("assistant") || lower.includes("claude") ? "assistant" :
          "message";
        messages.push({ role, text });
      }
    }

    // Final fallback: dump all of main
    if (!messages.length) {
      const main = document.querySelector("main");
      const text = main ? (main.innerText || "").trim() : "";
      if (text) messages.push({ role: "conversation", text });
    }

    let md = `# Conversation Log\n\n`;
    md += `- Platform: ${platform}\n`;
    md += `- Conversation ID: ${convId}\n`;
    md += `- Title: ${rawTitle}\n`;
    md += `- Captured: ${nowISO()}\n`;
    md += `- URL: ${location.href}\n\n---\n\n`;

    if (!messages.length) {
      md += `_No messages detected. The UI may have changed._\n`;
      return { convId, convKey, title: rawTitle, md, platform };
    }

    for (const m of messages) {
      const who =
        m.role === "user" ? "User" :
        m.role === "assistant" ? "Assistant" :
        "Message";
      md += `## ${who}\n\n${m.text}\n\n`;
    }

    return { convId, convKey, title: rawTitle, md, platform };
  }

  function extractConversationMarkdown() {
    return detectPlatform() === "claudeai"
      ? extractClaudeMarkdown()
      : extractChatGPTMarkdown();
  }

  function buildMainFilePath(title, convId, platform) {
    const shortId = convId.slice(0, 8);
    const stableName = `${slugifyTitle(title)}__${shortId}__${platform}.md`;
    return `${getPlatformBaseFolder(platform)}/${stableName}`;
  }

  function buildSnapshotFilePath(title, convId, platform) {
    const stamp = dateStamp();
    const shortId = convId.slice(0, 8);
    const snapName = `${stamp}__${slugifyTitle(title)}__${shortId}__${platform}.md`;
    return `${getPlatformSnapshotFolder(platform)}/${snapName}`;
  }

  // =======================
  // GITHUB API
  // =======================
  function ghRequest(url, token, method = "GET", bodyObj = null) {
    return new Promise((resolve, reject) => {
      const headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
      };

      const data = bodyObj ? JSON.stringify(bodyObj) : null;

      GM_xmlhttpRequest({
        method,
        url,
        headers: {
          ...headers,
          ...(bodyObj ? { "Content-Type": "application/json" } : {})
        },
        data,
        timeout: 30000,
        onload: (res) => {
          let parsed = null;
          try {
            parsed = res.responseText ? JSON.parse(res.responseText) : {};
          } catch {
            parsed = { raw: res.responseText };
          }

          if (res.status >= 200 && res.status < 300) {
            resolve(parsed);
          } else {
            const msg = parsed && parsed.message ? parsed.message : `HTTP ${res.status}`;
            reject(new Error(`GitHub API error: ${msg}`));
          }
        },
        onerror: () => reject(new Error("Network error contacting GitHub")),
        ontimeout: () => reject(new Error("Timeout contacting GitHub")),
      });
    });
  }

  async function getExistingFileMeta(token, path) {
    const urlPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}?ref=${encodeURIComponent(BRANCH)}&_=${Date.now()}`;

    try {
      const existing = await ghRequest(url, token, "GET");
      return existing || null;
    } catch (e) {
      if (String(e.message).includes("Not Found")) return null;
      throw e;
    }
  }

  async function upsertFileToGitHub({ token, path, content, message }) {
    const urlPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const baseUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}`;

    const buildPayload = (sha) => ({
      message,
      content: b64encode(content),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    });

    const existing = await getExistingFileMeta(token, path);
    const sha = existing && existing.sha ? existing.sha : null;

    try {
      return await ghRequest(baseUrl, token, "PUT", buildPayload(sha));
    } catch (e) {
      // SHA conflict — the file was updated on GitHub between our GET and PUT.
      // Re-fetch the latest SHA and retry once.
      if (String(e.message).includes("does not match")) {
        const retryExisting = await getExistingFileMeta(token, path);
        const retrySha = retryExisting && retryExisting.sha ? retryExisting.sha : null;
        return await ghRequest(baseUrl, token, "PUT", buildPayload(retrySha));
      }
      throw e;
    }
  }

  async function deleteFileFromGitHub({ token, path, message }) {
    const urlPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const baseUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}`;

    const existing = await getExistingFileMeta(token, path);
    if (!existing || !existing.sha) return;

    const payload = {
      message,
      sha: existing.sha,
      branch: BRANCH
    };

    return ghRequest(baseUrl, token, "DELETE", payload);
  }

  async function testGitHubConnection() {
    const token = getToken();
    if (!token) {
      toast("No GitHub token set.");
      return;
    }

    try {
      const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}`;
      const repo = await ghRequest(url, token, "GET");
      toast(`GitHub OK:\n${repo.full_name}`);
    } catch (e) {
      console.error(e);
      toast(`GitHub test failed:\n${e.message}`, 5000);
    }
  }

  // =======================
  // SAVE ACTIONS
  // =======================
  let saving = false;

  async function saveMainFile({ auto = false } = {}) {
    if (saving) return;
    saving = true;

    try {
      const token = getToken();
      if (!token) {
        toast("No GitHub token set.\nClick Set Token first.");
        return;
      }

      // For Claude: scroll through the conversation first so all messages
      // are rendered into the DOM before we extract.
      // This applies to both manual saves and autosaves — without it, long
      // Claude conversations get captured partially because virtualized turns
      // are not yet in the DOM.
      if (detectPlatform() === "claudeai") {
        if (!auto) toast("Scrolling to load all messages…", 2000);
        await scrollToLoadAllClaudeMessages();
      }

      const { convId, convKey, title, md, platform } = extractConversationMarkdown();
      const hash = simpleHash(md);

      if (auto && hash === getLastHash(convKey)) return;

      const lockedTitle = getOrLockTitle(convKey, title);
      const fullPath = getLockedPath(convKey) || buildMainFilePath(lockedTitle, convId, platform);

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: `${auto ? "Auto-save" : "Save"} conversation: ${lockedTitle}`
      });

      setLockedPath(convKey, fullPath);
      setLastHash(convKey, hash);
      setLastSavedAt(convKey, Date.now());

      toast(`Saved:\n${fullPath}`);
    } catch (e) {
      console.error(e);
      toast(`Save failed:\n${e.message}`, 5000);
    } finally {
      saving = false;
    }
  }

  async function saveSnapshotFile() {
    if (saving) return;
    saving = true;

    try {
      const token = getToken();
      if (!token) {
        toast("No GitHub token set.\nClick Set Token first.");
        return;
      }

      const { convId, convKey, title, md, platform } = extractConversationMarkdown();
      const lockedTitle = getOrLockTitle(convKey, title);
      const fullPath = buildSnapshotFilePath(lockedTitle, convId, platform);

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: `Snapshot conversation: ${lockedTitle}`
      });

      toast(`Snapshot saved:\n${fullPath}`);
    } catch (e) {
      console.error(e);
      toast(`Snapshot failed:\n${e.message}`, 5000);
    } finally {
      saving = false;
    }
  }

  async function syncTitle() {
    if (saving) return;
    saving = true;

    try {
      const token = getToken();
      if (!token) {
        toast("No GitHub token set.\nClick Set Token first.");
        return;
      }

      const { convId, convKey, title: currentTitle, md, platform } = extractConversationMarkdown();
      const oldLockedTitle = getLockedTitle(convKey);
      const oldPath = getLockedPath(convKey);

      if (!oldLockedTitle || !oldPath) {
        toast("No locked title yet.\nSave this conversation once first.");
        return;
      }

      if (oldLockedTitle === currentTitle) {
        toast("Title already matches the locked title.");
        return;
      }

      const newPath = buildMainFilePath(currentTitle, convId, platform);

      await upsertFileToGitHub({
        token,
        path: newPath,
        content: md,
        message: `Rename conversation to: ${currentTitle}`
      });

      if (oldPath !== newPath) {
        await deleteFileFromGitHub({
          token,
          path: oldPath,
          message: `Remove old conversation file after title sync: ${oldLockedTitle}`
        });
      }

      setLockedTitle(convKey, currentTitle);
      setLockedPath(convKey, newPath);
      setLastHash(convKey, simpleHash(md));
      setLastSavedAt(convKey, Date.now());

      toast(`Title synced:\n${oldLockedTitle}\n→ ${currentTitle}`);
    } catch (e) {
      console.error(e);
      toast(`Sync Title failed:\n${e.message}`, 5000);
    } finally {
      saving = false;
    }
  }

  // =======================
  // UI
  // =======================
  function makeButton(label) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.style.cssText = `
      width: 100%;
      padding: 8px;
      border-radius: 10px;
      border: 1px solid rgba(0,0,0,.15);
      background: #fff;
      cursor: pointer;
      margin-bottom: 8px;
      color: #111;
    `;
    btn.onmouseenter = () => { btn.style.background = "#f4f4f4"; };
    btn.onmouseleave = () => { btn.style.background = "#fff"; };
    return btn;
  }

  function mountUI() {
    if (document.getElementById("jerlan-gh-logger")) return;
    if (!document.body) return;

    const isCollapsed = GM_getValue(K_COLLAPSED, false);
    const platformLabel = detectPlatform() === "claudeai" ? "Claude Logger" : "ChatGPT Logger";
    const savedPos = getPanelPos();

    const wrap = document.createElement("div");
    wrap.id = "jerlan-gh-logger";
    wrap.style.cssText = `
      position: fixed;
      ${savedPos ? `left: ${savedPos.left}px; top: ${savedPos.top}px; right: auto; bottom: auto;` : `left: 16px; bottom: 16px;`}
      z-index: 999999;
      background: rgba(255,255,255,.95);
      border: 1px solid rgba(0,0,0,.12);
      border-radius: 12px;
      padding: 10px;
      font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      box-shadow: 0 10px 24px rgba(0,0,0,.12);
      color: #111;
      width: 260px;
      backdrop-filter: blur(8px);
      transition: all 0.2s ease;
    `;

    const header = document.createElement("div");
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; cursor:move;";
    header.title = "Drag to move";

    const title = document.createElement("div");
    title.textContent = platformLabel;
    title.style.cssText = "font-weight:700;";

    const toggleBtn = document.createElement("button");
    toggleBtn.textContent = isCollapsed ? "+" : "–";
    toggleBtn.style.cssText = `
      width: 26px;
      height: 26px;
      border-radius: 8px;
      border: 1px solid rgba(0,0,0,.15);
      background: #fff;
      cursor: pointer;
      color: #111;
      flex: 0 0 auto;
    `;

    header.appendChild(title);
    header.appendChild(toggleBtn);
    wrap.appendChild(header);

    const content = document.createElement("div");
    content.id = "jerlan-logger-content";
    wrap.appendChild(content);

    const btnSave = makeButton("Save");
    btnSave.onclick = () => saveMainFile({ auto: false });
    content.appendChild(btnSave);

    const btnSnap = makeButton("Snapshot");
    btnSnap.onclick = () => saveSnapshotFile();
    content.appendChild(btnSnap);

    const btnSync = makeButton("Sync Title");
    btnSync.onclick = () => syncTitle();
    content.appendChild(btnSync);

    const autoRow = document.createElement("label");
    autoRow.style.cssText = "display:flex; gap:8px; align-items:center; margin-bottom:8px; user-select:none;";

    const autoCb = document.createElement("input");
    autoCb.type = "checkbox";
    autoCb.checked = getAutosave();
    autoCb.onchange = () => {
      setAutosave(autoCb.checked);
      toast(`Auto-save ${autoCb.checked ? "enabled" : "disabled"}`);
    };

    const autoTxt = document.createElement("span");
    autoTxt.textContent = "Auto-save";

    autoRow.appendChild(autoCb);
    autoRow.appendChild(autoTxt);
    content.appendChild(autoRow);

    const btnToken = makeButton("Set Token");
    btnToken.onclick = () => {
      const current = getToken();
      const v = prompt("Paste GitHub Token:", current || "");
      if (v && v.trim()) {
        setToken(v.trim());
        toast("Token saved.");
      }
    };
    content.appendChild(btnToken);

    const btnTest = makeButton("Test GitHub");
    btnTest.onclick = () => testGitHubConnection();
    content.appendChild(btnTest);

    const btnClear = makeButton("Clear Token");
    btnClear.onclick = () => {
      const ok = confirm("Clear the saved GitHub token from Tampermonkey storage?");
      if (ok) {
        clearToken();
        toast("Token cleared.");
      }
    };
    content.appendChild(btnClear);

    const info = document.createElement("div");
    info.style.cssText = "font-size:11px; opacity:.75; margin-top:2px;";
    info.textContent = "Hybrid lock title • Manual sync • Platform folders • Draggable";
    content.appendChild(info);

    function applyCollapseState(collapsed) {
      if (collapsed) {
        content.style.display = "none";
        wrap.style.width = "150px";
        toggleBtn.textContent = "+";
      } else {
        content.style.display = "block";
        wrap.style.width = "260px";
        toggleBtn.textContent = "–";
      }
    }

    toggleBtn.onclick = () => {
      const collapsed = !GM_getValue(K_COLLAPSED, false);
      GM_setValue(K_COLLAPSED, collapsed);
      applyCollapseState(collapsed);
    };

    applyCollapseState(isCollapsed);
    document.body.appendChild(wrap);
    enableDrag(wrap, header);
  }

  // =======================
  // AUTOSAVE LOOP
  // =======================
  async function autosaveLoop() {
    while (true) {
      await sleep(AUTOSAVE_INTERVAL_MS);

      if (!getAutosave()) continue;
      if (!document.querySelector("main")) continue;

      const platform = detectPlatform();
      const convId = getConversationIdFromUrl();
      const convKey = getConversationKey(platform, convId);
      const lastAt = getLastSavedAt(convKey);

      if (Date.now() - lastAt < AUTOSAVE_INTERVAL_MS * 0.9) continue;

      await saveMainFile({ auto: true });
    }
  }

  // =======================
  // INIT
  // =======================
  function boot() {
    mountUI();
  }

  const obs = new MutationObserver(() => {
    if (document.querySelector("main")) {
      mountUI();
    }
  });

  obs.observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === "complete" || document.readyState === "interactive") {
    boot();
  } else {
    window.addEventListener("DOMContentLoaded", boot, { once: true });
  }

  autosaveLoop();
})();