# ChatGPT Conversation Log

- Conversation ID: 69be637f-b234-8322-913f-386cf1604e74
- Title: Tampermonkey Setup Chrome
- Captured: 2026-03-21T13:20:01.059Z
- URL: https://chatgpt.com/c/69be637f-b234-8322-913f-386cf1604e74

---

## User

i got tampermonkey installed on my firefox to save all ChatGPT prompt chats. but i forgot how to set it up. Here's my working tampermonkey script from my firefox and i want to setupin my google chrome too:

// ==UserScript==
// @name         ChatGPT → GitHub Logger (One file per conversation + Snapshot) [TM FIX]
// @namespace    jerlan-project
// @version      2.1.0
// @description  Save ChatGPT conversations to a GitHub repo as Markdown. One file per conversation + optional snapshot backups. Uses GM_xmlhttpRequest to bypass CSP.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
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
  // CONFIG (yours)
  // =======================
  const GH_OWNER = "rudolfochua23";
  const GH_REPO  = "ChatGPT-Project-Conversations";
  const GH_PATH_PREFIX = "logs/conversations"; // folder inside repo
  const SNAPSHOT_SUBFOLDER = "snapshots";
  const BRANCH = "main"; // change if your repo uses "master" or another branch

  // Autosave interval (recommended 2–5 minutes to avoid spam)
  const AUTOSAVE_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes

  // =======================
  // STORAGE KEYS
  // =======================
  const K_TOKEN = "jerlan_gh_token";
  const K_AUTOSAVE = "jerlan_autosave_enabled";
  const K_LAST_HASH_BY_CONV = "jerlan_last_saved_hash_by_conv"; // object map convId->hash
  const K_LAST_SAVED_AT_BY_CONV = "jerlan_last_saved_at_by_conv"; // object map convId->timestamp ms

  // =======================
  // HELPERS
  // =======================
  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const nowISO = () => new Date().toISOString();
  const pad = (n) => String(n).padStart(2, "0");

  const dateStamp = () => {
    const d = new Date();
    return ${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}__${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())};
  };

  const slugify = (s) => (s || "chat")
    .toLowerCase()
    .trim()
    .replace(/[\s\/\\:]+/g, "-")
    .replace(/[^a-z0-9\-]+/g, "")
    .replace(/\-+/g, "-")
    .slice(0, 80) || "chat";

  // UTF-8 safe base64
  const b64encode = (str) => btoa(unescape(encodeURIComponent(str)));

  function toast(msg) {
    const t = document.createElement("div");
    t.textContent = msg;
    t.style.cssText = 
      position: fixed; right: 16px; bottom: 16px; z-index: 999999;
      background: rgba(0,0,0,.85); color: #fff; padding: 10px 12px;
      border-radius: 10px; font: 12px/1.3 system-ui, -apple-system, Segoe UI, Roboto, Arial;
      box-shadow: 0 6px 18px rgba(0,0,0,.3);
      max-width: 360px;
      white-space: pre-wrap;
    ;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3400);
  }

  function getToken() { return GM_getValue(K_TOKEN, ""); }
  function setToken(v) { GM_setValue(K_TOKEN, v); }
  function clearToken() { GM_deleteValue(K_TOKEN); }

  function getAutosave() { return !!GM_getValue(K_AUTOSAVE, false); }
  function setAutosave(v) { GM_setValue(K_AUTOSAVE, !!v); }

  function getMap(key) {
    const v = GM_getValue(key, "{}");
    try { return JSON.parse(v) || {}; } catch { return {}; }
  }
  function setMap(key, obj) {
    GM_setValue(key, JSON.stringify(obj || {}));
  }

  function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return String(h);
  }

  function getConversationIdFromUrl() {
    // Most common patterns:
    // chatgpt.com/c/<id>
    // chat.openai.com/c/<id>
    const p = location.pathname || "";
    const m1 = p.match(/\/c\/([^\/?#]+)/i);
    if (m1 && m1[1]) return m1[1];

    const m2 = p.match(/\/chat\/([^\/?#]+)/i);
    if (m2 && m2[1]) return m2[1];

    // Fallback: stable ID derived from full URL
    return "url_" + simpleHash(location.href);
  }

  // =======================
  // EXTRACT CONVERSATION
  // =======================
  function extractConversationMarkdown() {
    const rawTitle = (document.title || "ChatGPT Conversation").replace(" - ChatGPT", "").trim();
    const convId = getConversationIdFromUrl();

    const roleNodes = document.querySelectorAll("[data-message-author-role]");
    const messages = [];

    if (roleNodes && roleNodes.length) {
      roleNodes.forEach(node => {
        const role = node.getAttribute("data-message-author-role") || "unknown";
        const mdNode = node.querySelector(".markdown, .prose") || node;
        const text = (mdNode.innerText || "").trim();
        if (text) messages.push({ role, text });
      });
    } else {
      const main = document.querySelector("main");
      const text = main ? (main.innerText || "").trim() : "";
      if (text) messages.push({ role: "conversation", text });
    }

    let md = # ChatGPT Conversation Log\n\n;
    md += - Conversation ID: ${convId}\n;
    md += - Title: ${rawTitle}\n;
    md += - Captured: ${nowISO()}\n;
    md += - URL: ${location.href}\n\n---\n\n;

    if (!messages.length) {
      md += _No messages detected. The ChatGPT UI may have changed._\n;
      return { convId, title: rawTitle, md };
    }

    for (const m of messages) {
      const who = m.role === "user" ? "User"
                : m.role === "assistant" ? "Assistant"
                : m.role ? m.role : "Unknown";
      md += ## ${who}\n\n${m.text}\n\n;
    }

    return { convId, title: rawTitle, md };
  }

  // =======================
  // GITHUB API (GM_xmlhttpRequest)
  // =======================
  function ghRequest(url, token, method = "GET", bodyObj = null) {
    return new Promise((resolve, reject) => {
      const headers = {
        "Accept": "application/vnd.github+json",
        "Authorization": Bearer ${token},
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
          try { parsed = res.responseText ? JSON.parse(res.responseText) : {}; }
          catch { parsed = { raw: res.responseText }; }

          if (res.status >= 200 && res.status < 300) {
            resolve(parsed);
          } else {
            const msg = parsed && parsed.message ? parsed.message : HTTP ${res.status};
            reject(new Error(GitHub API error: ${msg}));
          }
        },
        onerror: () => reject(new Error("NetworkError (blocked/offline)")),
        ontimeout: () => reject(new Error("Timeout contacting GitHub")),
      });
    });
  }

  async function upsertFileToGitHub({ token, path, content, message }) {
    const urlPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const baseUrl = https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath};

    // Try to get existing sha (if file exists)
    let sha = null;
    try {
      const existing = await ghRequest(${baseUrl}?ref=${encodeURIComponent(BRANCH)}, token, "GET");
      sha = existing && existing.sha ? existing.sha : null;
    } catch (e) {
      // If not found, create new; otherwise bubble up
      if (!String(e.message).includes("Not Found")) throw e;
    }

    const payload = {
      message,
      content: b64encode(content),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    };

    return ghRequest(baseUrl, token, "PUT", payload);
  }

  // =======================
  // SAVE ACTIONS
  // =======================
  let saving = false;

  function getLastHash(convId) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    return m[convId] || "";
  }
  function setLastHash(convId, hash) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    m[convId] = hash;
    setMap(K_LAST_HASH_BY_CONV, m);
  }

  function getLastSavedAt(convId) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    return m[convId] || 0;
  }
  function setLastSavedAt(convId, ts) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    m[convId] = ts;
    setMap(K_LAST_SAVED_AT_BY_CONV, m);
  }

  async function saveMainFile({ auto = false } = {}) {
    if (saving) return;
    saving = true;

    try {
      const token = getToken();
      if (!token) {
        toast("No GitHub token set.\nClick ‘Set Token’ first.");
        return;
      }

      const { convId, title, md } = extractConversationMarkdown();
      const hash = simpleHash(md);

      // Avoid committing if nothing changed (especially autosave)
      if (auto && hash === getLastHash(convId)) return;

      const shortId = convId.slice(0, 8);
      const stableName = ${slugify(title)}__${shortId}.md;
      const fullPath = ${GH_PATH_PREFIX}/${stableName};
      const commitMsg = ${auto ? "Auto-save" : "Save"} conversation: ${title};

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: commitMsg,
      });

      setLastHash(convId, hash);
      setLastSavedAt(convId, Date.now());

      toast(Saved (updated):\n${fullPath});
    } catch (e) {
      console.error(e);
      toast(Save failed:\n${e.message});
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
        toast("No GitHub token set.\nClick ‘Set Token’ first.");
        return;
      }

      const { convId, title, md } = extractConversationMarkdown();
      const stamp = dateStamp();
      const shortId = convId.slice(0, 8);
      const snapName = ${stamp}__${slugify(title)}__${shortId}.md;
      const fullPath = ${GH_PATH_PREFIX}/${SNAPSHOT_SUBFOLDER}/${snapName};
      const commitMsg = Snapshot conversation: ${title};

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: commitMsg,
      });

      toast(Snapshot saved:\n${fullPath});
    } catch (e) {
      console.error(e);
      toast(Snapshot failed:\n${e.message});
    } finally {
      saving = false;
    }
  }

  // =======================
  // UI
  // =======================
  function mountUI() {
  if (document.getElementById("jerlan-gh-logger")) return;

  const K_COLLAPSED = "jerlan_logger_collapsed";
  const isCollapsed = GM_getValue(K_COLLAPSED, false);

  const wrap = document.createElement("div");
  wrap.id = "jerlan-gh-logger";
  wrap.style.cssText = 
    position: fixed;
    left: 16px;
    bottom: 16px;
    z-index: 999999;
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(0,0,0,.12);
    border-radius: 12px;
    padding: 10px;
    font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial;
    box-shadow: 0 10px 24px rgba(0,0,0,.12);
    color: #111;
    width: 248px;
    backdrop-filter: blur(8px);
    transition: all 0.2s ease;
  ;

  // ===== HEADER WITH COLLAPSE BUTTON =====
  const header = document.createElement("div");
  header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;";

  const title = document.createElement("div");
  title.textContent = "Jerlan Logger";
  title.style.cssText = "font-weight:700;";

  const toggleBtn = document.createElement("button");
  toggleBtn.textContent = isCollapsed ? "+" : "–";
  toggleBtn.style.cssText = 
    width:26px; height:26px;
    border-radius:8px;
    border:1px solid rgba(0,0,0,.15);
    background:#fff;
    cursor:pointer;
  ;

  header.appendChild(title);
  header.appendChild(toggleBtn);
  wrap.appendChild(header);

  const content = document.createElement("div");
  content.id = "jerlan-logger-content";
  wrap.appendChild(content);

  // ===== BUTTONS =====
  const btnSave = document.createElement("button");
  btnSave.textContent = "Save";
  btnSave.style.cssText = "width:100%; padding:8px; border-radius:10px; border:1px solid rgba(0,0,0,.15); background:#fff; cursor:pointer; margin-bottom:8px;";
  btnSave.onclick = () => saveMainFile({ auto: false });
  content.appendChild(btnSave);

  const btnSnap = document.createElement("button");
  btnSnap.textContent = "Snapshot";
  btnSnap.style.cssText = "width:100%; padding:8px; border-radius:10px; border:1px solid rgba(0,0,0,.15); background:#fff; cursor:pointer; margin-bottom:8px;";
  btnSnap.onclick = () => saveSnapshotFile();
  content.appendChild(btnSnap);

  const autoRow = document.createElement("label");
  autoRow.style.cssText = "display:flex; gap:8px; align-items:center; margin-bottom:8px; user-select:none;";

  const autoCb = document.createElement("input");
  autoCb.type = "checkbox";
  autoCb.checked = getAutosave();
  autoCb.onchange = () => {
    setAutosave(autoCb.checked);
    toast(Auto-save ${autoCb.checked ? "enabled" : "disabled"});
  };

  const autoTxt = document.createElement("span");
  autoTxt.textContent = "Auto-save";
  autoRow.appendChild(autoCb);
  autoRow.appendChild(autoTxt);
  content.appendChild(autoRow);

  const btnToken = document.createElement("button");
  btnToken.textContent = "Set Token";
  btnToken.style.cssText = "width:100%; padding:8px; border-radius:10px; border:1px solid rgba(0,0,0,.15); background:#fff; cursor:pointer;";
  btnToken.onclick = () => {
    const current = getToken();
    const v = prompt("Paste GitHub Token:", current || "");
    if (v && v.trim()) { setToken(v.trim()); toast("Token saved."); }
  };
  content.appendChild(btnToken);

  // ===== COLLAPSE LOGIC =====
  function applyCollapseState(collapsed) {
    if (collapsed) {
      content.style.display = "none";
      wrap.style.width = "140px";
      toggleBtn.textContent = "+";
    } else {
      content.style.display = "block";
      wrap.style.width = "248px";
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
}

  // =======================
  // AUTOSAVE LOOP
  // =======================
  async function autosaveLoop() {
    while (true) {
      await sleep(AUTOSAVE_INTERVAL_MS);
      if (!getAutosave()) continue;
      if (!document.querySelector("main")) continue;

      const convId = getConversationIdFromUrl();
      const lastAt = getLastSavedAt(convId);

      // Extra throttle: prevent repeated commits if something triggers faster than expected
      if (Date.now() - lastAt < AUTOSAVE_INTERVAL_MS * 0.9) continue;

      await saveMainFile({ auto: true });
    }
  }

  // =======================
  // INIT
  // =======================
  const obs = new MutationObserver(() => {
    if (document.querySelector("main")) {
      mountUI();
      obs.disconnect();
    }
  });
  obs.observe(document.documentElement, { childList: true, subtree: true });

  autosaveLoop();
})();

## Assistant

Yes — you can set this up in Chrome with the same script. The main things are: install Tampermonkey in Chrome, enable Chrome’s extension developer mode, paste the script, then add your GitHub token inside the little on-page panel. Tampermonkey’s docs say you can create a new script from the dashboard, and recent Tampermonkey notes say Chrome now requires Developer mode for userscripts to run. GitHub recommends fine-grained personal access tokens, and the repo contents API your script uses needs repository Contents permission. 
GitHub Docs
+3
tampermonkey.net
+3
tampermonkey.net
+3

Do this in Chrome:

Install Tampermonkey for Chrome.

Open chrome://extensions/.

Turn on Developer mode at the top right. This is now needed for Tampermonkey userscripts in Chrome. 
tampermonkey.net
+1

Click the Tampermonkey icon, then Create a new script.

Delete the template code and paste your full script.

Save it.

Open https://chatgpt.com/ and reload the page.

You should see the Jerlan Logger box at the lower-left.

Then set up GitHub access:

In GitHub, create a fine-grained personal access token.

Limit it to the repo rudolfochua23/ChatGPT-Project-Conversations.

Give it repository Contents: Read and write permission, because your script reads the file first and then creates/updates it through the contents API. 
GitHub Docs
+1

Copy the token.

Back on ChatGPT in Chrome, click Set Token in your logger panel and paste it.

A few important notes:

Your Firefox Tampermonkey storage does not automatically carry over to Chrome, so the token and autosave setting need to be entered again in Chrome.

Your script already includes the important permissions for GitHub requests:

@grant GM_xmlhttpRequest

@connect api.github.com

Your @match lines already cover both old and current ChatGPT domains:

https://chat.openai.com/*

https://chatgpt.com/*

Quick test after setup:

Open any ChatGPT conversation in Chrome.

Click Save.

Check your GitHub repo for a file under logs/conversations/.

Then try Snapshot and confirm it appears under logs/conversations/snapshots/.

If it does not work, the usual causes are:

Chrome Developer mode is off.

The GitHub token is missing or has the wrong permissions.

The repo name, owner, or branch is wrong.

You are not on chatgpt.com / chat.openai.com.

ChatGPT changed its page structure and the script can’t find messages.

One small improvement I’d make before using it in Chrome: your token is stored in Tampermonkey storage and can be shown again in the prompt box. It works, but it is safer to use a fine-grained token restricted to just that one repo. GitHub explicitly recommends fine-grained tokens over classic tokens. 
GitHub Docs

If you want, I can turn your script into a slightly improved Chrome-ready version with a “Test GitHub connection” button and better error messages.

## User

yes make it Google Chrome ready and maintain a name for each saved chats based on the title of the chat

## Assistant

Here’s a Chrome-ready version that keeps each saved chat named from the chat title, with a stable filename per conversation:

main save file: your-chat-title__<conversationId>.md

snapshot file: YYYY-MM-DD__HHMMSS__your-chat-title__<conversationId>.md

It also adds:

a Test GitHub button

a Clear Token button

slightly safer filename cleanup

better title handling

better Chrome-friendly UI behavior

Replace your current Tampermonkey script with this:

JavaScript
// ==UserScript==
// @name         ChatGPT → GitHub Logger (Chrome Ready, Title-Based Files)
// @namespace    jerlan-project
// @version      2.2.0
// @description  Save ChatGPT conversations to a GitHub repo as Markdown. One file per conversation + optional snapshots. Chrome-ready via GM_xmlhttpRequest.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
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
  const GH_OWNER = "rudolfochua23";
  const GH_REPO = "ChatGPT-Project-Conversations";
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
      max-width: 380px;
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

  function getLastHash(convId) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    return m[convId] || "";
  }

  function setLastHash(convId, hash) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    m[convId] = hash;
    setMap(K_LAST_HASH_BY_CONV, m);
  }

  function getLastSavedAt(convId) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    return m[convId] || 0;
  }

  function setLastSavedAt(convId, ts) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    m[convId] = ts;
    setMap(K_LAST_SAVED_AT_BY_CONV, m);
  }

  function getConversationIdFromUrl() {
    const p = location.pathname || "";
    const m1 = p.match(/\/c\/([^\/?#]+)/i);
    if (m1 && m1[1]) return m1[1];

    const m2 = p.match(/\/chat\/([^\/?#]+)/i);
    if (m2 && m2[1]) return m2[1];

    return "url_" + simpleHash(location.href);
  }

  function getBestTitle() {
    const titleFromDocument = (document.title || "")
      .replace(/\s*-\s*ChatGPT\s*$/i, "")
      .trim();

    if (titleFromDocument && titleFromDocument.toLowerCase() !== "chatgpt") {
      return titleFromDocument;
    }

    const selectors = [
      "main h1",
      "header h1",
      "nav a[aria-current='page']",
      "[data-testid='conversation-title']"
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const text = (el?.textContent || "").trim();
      if (text) return text;
    }

    return "Untitled Chat";
  }

  // =======================
  // EXTRACT CONVERSATION
  // =======================
  function extractConversationMarkdown() {
    const rawTitle = getBestTitle();
    const convId = getConversationIdFromUrl();

    const roleNodes = document.querySelectorAll("[data-message-author-role]");
    const messages = [];

    if (roleNodes && roleNodes.length) {
      roleNodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role") || "unknown";
        const mdNode = node.querySelector(".markdown, .prose") || node;
        const text = (mdNode.innerText || "").trim();
        if (text) messages.push({ role, text });
      });
    } else {
      const main = document.querySelector("main");
      const text = main ? (main.innerText || "").trim() : "";
      if (text) messages.push({ role: "conversation", text });
    }

    let md = `# ChatGPT Conversation Log\n\n`;
    md += `- Conversation ID: ${convId}\n`;
    md += `- Title: ${rawTitle}\n`;
    md += `- Captured: ${nowISO()}\n`;
    md += `- URL: ${location.href}\n\n---\n\n`;

    if (!messages.length) {
      md += `_No messages detected. The ChatGPT UI may have changed._\n`;
      return { convId, title: rawTitle, md };
    }

    for (const m of messages) {
      const who =
        m.role === "user" ? "User" :
        m.role === "assistant" ? "Assistant" :
        m.role ? m.role : "Unknown";

      md += `## ${who}\n\n${m.text}\n\n`;
    }

    return { convId, title: rawTitle, md };
  }

  function buildMainFilePath(title, convId) {
    const shortId = convId.slice(0, 8);
    const stableName = `${slugifyTitle(title)}__${shortId}.md`;
    return `${GH_PATH_PREFIX}/${stableName}`;
  }

  function buildSnapshotFilePath(title, convId) {
    const stamp = dateStamp();
    const shortId = convId.slice(0, 8);
    const snapName = `${stamp}__${slugifyTitle(title)}__${shortId}.md`;
    return `${GH_PATH_PREFIX}/${SNAPSHOT_SUBFOLDER}/${snapName}`;
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

  async function getExistingFileSha(token, path) {
    const urlPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const baseUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}?ref=${encodeURIComponent(BRANCH)}`;

    try {
      const existing = await ghRequest(baseUrl, token, "GET");
      return existing && existing.sha ? existing.sha : null;
    } catch (e) {
      if (String(e.message).includes("Not Found")) return null;
      throw e;
    }
  }

  async function upsertFileToGitHub({ token, path, content, message }) {
    const urlPath = encodeURIComponent(path).replace(/%2F/g, "/");
    const baseUrl = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}`;

    const sha = await getExistingFileSha(token, path);

    const payload = {
      message,
      content: b64encode(content),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    };

    return ghRequest(baseUrl, token, "PUT", payload);
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

      const { convId, title, md } = extractConversationMarkdown();
      const hash = simpleHash(md);

      if (auto && hash === getLastHash(convId)) {
        return;
      }

      const fullPath = buildMainFilePath(title, convId);
      const commitMsg = `${auto ? "Auto-save" : "Save"} conversation: ${title}`;

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: commitMsg,
      });

      setLastHash(convId, hash);
      setLastSavedAt(convId, Date.now());

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

      const { convId, title, md } = extractConversationMarkdown();
      const fullPath = buildSnapshotFilePath(title, convId);
      const commitMsg = `Snapshot conversation: ${title}`;

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: commitMsg,
      });

      toast(`Snapshot saved:\n${fullPath}`);
    } catch (e) {
      console.error(e);
      toast(`Snapshot failed:\n${e.message}`, 5000);
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

    const wrap = document.createElement("div");
    wrap.id = "jerlan-gh-logger";
    wrap.style.cssText = `
      position: fixed;
      left: 16px;
      bottom: 16px;
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
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;";

    const title = document.createElement("div");
    title.textContent = "Jerlan Logger";
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
    info.textContent = "Saves chat as title-based Markdown files in GitHub";
    content.appendChild(info);

    function applyCollapseState(collapsed) {
      if (collapsed) {
        content.style.display = "none";
        wrap.style.width = "145px";
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
  }

  // =======================
  // AUTOSAVE LOOP
  // =======================
  async function autosaveLoop() {
    while (true) {
      await sleep(AUTOSAVE_INTERVAL_MS);

      if (!getAutosave()) continue;
      if (!document.querySelector("main")) continue;

      const convId = getConversationIdFromUrl();
      const lastAt = getLastSavedAt(convId);

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

How to set it up in Chrome:

Open Chrome.

Install Tampermonkey.

Go to chrome://extensions/

Turn on Developer mode.

Open Tampermonkey dashboard.

Create a new script.

Replace everything with the script above.

Save.

Open ChatGPT and refresh the page.

Click Set Token and paste your GitHub token.

Click Test GitHub.

Then click Save on a chat.

How naming works now:

If your chat title is How to build a website

and the conversation ID starts with abc12345

then the saved file becomes:

logs/conversations/how-to-build-a-website__abc12345.md

And a snapshot becomes something like:

logs/conversations/snapshots/2026-03-21__143522__how-to-build-a-website__abc12345.md

That means:

the file is named from the chat title

the same conversation keeps updating the same main file

snapshots still create separate history copies

A couple of practical notes:

If you rename the chat title in ChatGPT later, the main filename will also change on the next save, because the filename is based on the latest title.

That can leave the old file in GitHub and create a new one with the new title. If you want, I can make a smarter version that locks the first detected title and keeps using that same filename forever for that conversation.

The best option for you is probably that locked-title version, so your repo stays cleaner.

## User

ok i like your best option, to lock title version, can you show what with be the naming for that option?

## Assistant

Good call — the locked-title version is way cleaner long-term 👍

Here’s exactly how the naming will behave:

🔒 Locked Title Naming (Final Behavior)
1. First time you save a conversation

Let’s say your chat title is:

"How to build a website"

And your conversation ID starts with:

abc12345

👉 The script will lock this title permanently for that conversation.

✅ Main file name:
logs/conversations/how-to-build-a-website__abc12345.md
2. If you later rename the chat in ChatGPT

Example:

"How to build a website" → "Full Stack Guide"

👉 The script will IGNORE the new title and keep using the original locked one.

✅ Still saved as:
logs/conversations/how-to-build-a-website__abc12345.md
3. Snapshots (history backups)

Snapshots also use the locked title, not the updated one.

Example snapshot:
logs/conversations/snapshots/2026-03-21__143522__how-to-build-a-website__abc12345.md
🧠 Why this is better

Without locking:

❌ You get duplicate files when titles change

❌ Repo becomes messy over time

With locking:

✅ One conversation = one main file forever

✅ Clean GitHub history

✅ Snapshots stay consistent

✅ Easy to search later

🔑 Behind the scenes

The script stores:

convId → lockedTitle

It saves that in Tampermonkey storage (per browser)

So Chrome and Firefox will each maintain their own lock (important!)

⚠️ Important note

If you:

Clear Tampermonkey data

Reinstall browser

Or switch devices

👉 The lock is lost → it will re-lock using the current title

👍 Summary

Main file (always same):

<title-when-first-saved>__<conversationId>.md

Snapshots:

<timestamp>__<locked-title>__<conversationId>.md

If you want next-level upgrade later, I can also:

🔄 Sync the locked titles across devices (via GitHub JSON index)

🧠 Add tags or categories per conversation

📊 Build a mini dashboard from your logs

Just say the word.

## User

but is it possible that when I rename the chat title, the name in github repo will also be renamed as well?

## Assistant

Yes — it’s possible, but there’s an important catch:

👉 GitHub doesn’t have a simple “rename file” API
So the script must do this instead:

Create the new file with the new title

Delete the old file

That’s how a “rename” is simulated.

⚠️ Trade-off (you should know this)

If you enable rename syncing:

✅ Pros

Your GitHub filenames always match ChatGPT titles

Cleaner naming consistency

❌ Cons

Git history becomes split (old file → new file)

Slightly more API calls (create + delete)

If something fails mid-way → you may temporarily have duplicates

🧠 Recommended approach (best balance)

You have 3 options:

1. 🔒 Locked title (what you chose earlier)

Stable

Clean repo

No renaming

2. 🔄 Always follow title (rename on change)

Dynamic

Matches ChatGPT

Slightly messy history

3. ⭐ Hybrid (BEST)

Lock title initially

BUT allow manual rename sync button

👉 This is what I recommend for you

💡 How Hybrid Works

Default: locked title (safe)

If you rename chat in ChatGPT:

Click “Sync Title” button

Script:

renames file in GitHub

updates stored locked title

🧾 Example Flow
Step 1 (original)
how-to-build-a-website__abc12345.md
Step 2 (you rename chat)

ChatGPT title → "Full Stack Guide"

Step 3 (click Sync Title)

👉 GitHub becomes:

full-stack-guide__abc12345.md

(old file is deleted automatically)

🔧 If you want FULL AUTO rename

I can modify your script to:

Detect title change

Automatically rename file

Update stored title

⚡ My honest recommendation

For your use case (logging conversations long-term):

👉 Go with Hybrid (manual sync button)

Because:

You stay in control

No accidental repo mess

Still flexible when needed

👉 Next step

Tell me which one you want:

🔒 Keep locked only

🔄 Fully automatic rename

⭐ Hybrid (recommended)

…and I’ll upgrade your script accordingly.

## User

- ok, I go with the Hybrid
- one question, if i do sync title, will all the previous chat conversations will still be included?
- i want this to be working on claude.ai as well
- then save the chats or converations names with a "chatgpt" or "claudeai" at the end of the file name to separate from which AI agents that chat was.

## Assistant

Yes — with the Hybrid version, when you click Sync Title, the full conversation content is still preserved.

What happens is:

the script reads the current full conversation on the page

creates the new GitHub filename with the new title

copies the latest full conversation content into that new file

deletes the old main file

updates the stored locked title

So your previous messages are still included, because the saved file is based on the full conversation currently visible in ChatGPT or Claude, not only the newest messages.

A small caveat: if either site fails to render older parts of a very long chat on the page, the script can only save what is currently loaded in the DOM. That limitation already exists in your current version too.

Below is your upgraded Hybrid + ChatGPT + Claude + source suffix version.

Naming will look like this:

Main files:

logs/conversations/how-to-build-a-website__abc12345__chatgpt.md
logs/conversations/marketing-plan-for-q2__xyz98765__claudeai.md

Snapshots:

logs/conversations/snapshots/2026-03-21__143522__how-to-build-a-website__abc12345__chatgpt.md
logs/conversations/snapshots/2026-03-21__143700__marketing-plan-for-q2__xyz98765__claudeai.md

This version adds:

Hybrid lock title

Sync Title button

ChatGPT + Claude support

source suffix in filenames: __chatgpt or __claudeai

shared GitHub logging behavior for both sites

Use this as your full Tampermonkey script in Chrome:

JavaScript
// ==UserScript==
// @name         Chat Logger → GitHub (ChatGPT + Claude, Hybrid Title Sync)
// @namespace    jerlan-project
// @version      3.0.0
// @description  Save ChatGPT and Claude conversations to GitHub as Markdown. Hybrid title lock with manual sync, snapshots, autosave, and source suffix.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
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
  const GH_OWNER = "rudolfochua23";
  const GH_REPO = "ChatGPT-Project-Conversations";
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
  const K_LOCKED_TITLE_BY_CONV = "jerlan_locked_title_by_conv";
  const K_LOCKED_PATH_BY_CONV = "jerlan_locked_path_by_conv";

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

  function getLastHash(convId) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    return m[convId] || "";
  }

  function setLastHash(convId, hash) {
    const m = getMap(K_LAST_HASH_BY_CONV);
    m[convId] = hash;
    setMap(K_LAST_HASH_BY_CONV, m);
  }

  function getLastSavedAt(convId) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    return m[convId] || 0;
  }

  function setLastSavedAt(convId, ts) {
    const m = getMap(K_LAST_SAVED_AT_BY_CONV);
    m[convId] = ts;
    setMap(K_LAST_SAVED_AT_BY_CONV, m);
  }

  function getLockedTitle(convId) {
    const m = getMap(K_LOCKED_TITLE_BY_CONV);
    return m[convId] || "";
  }

  function setLockedTitle(convId, title) {
    const m = getMap(K_LOCKED_TITLE_BY_CONV);
    m[convId] = title;
    setMap(K_LOCKED_TITLE_BY_CONV, m);
  }

  function getLockedPath(convId) {
    const m = getMap(K_LOCKED_PATH_BY_CONV);
    return m[convId] || "";
  }

  function setLockedPath(convId, path) {
    const m = getMap(K_LOCKED_PATH_BY_CONV);
    m[convId] = path;
    setMap(K_LOCKED_PATH_BY_CONV, m);
  }

  function clearLockedPath(convId) {
    const m = getMap(K_LOCKED_PATH_BY_CONV);
    delete m[convId];
    setMap(K_LOCKED_PATH_BY_CONV, m);
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

  function getOrLockTitle(convId, currentTitle) {
    const locked = getLockedTitle(convId);
    if (locked) return locked;

    setLockedTitle(convId, currentTitle);
    return currentTitle;
  }

  // =======================
  // EXTRACT CONVERSATION
  // =======================
  function extractChatGPTMarkdown() {
    const rawTitle = getBestTitle();
    const convId = getConversationIdFromUrl();
    const platform = detectPlatform();
    const roleNodes = document.querySelectorAll("[data-message-author-role]");
    const messages = [];

    if (roleNodes && roleNodes.length) {
      roleNodes.forEach((node) => {
        const role = node.getAttribute("data-message-author-role") || "unknown";
        const mdNode = node.querySelector(".markdown, .prose") || node;
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
      return { convId, title: rawTitle, md, platform };
    }

    for (const m of messages) {
      const who =
        m.role === "user" ? "User" :
        m.role === "assistant" ? "Assistant" :
        m.role ? m.role : "Unknown";

      md += `## ${who}\n\n${m.text}\n\n`;
    }

    return { convId, title: rawTitle, md, platform };
  }

  function extractClaudeMarkdown() {
    const rawTitle = getBestTitle();
    const convId = getConversationIdFromUrl();
    const platform = detectPlatform();
    const messages = [];

    const possibleMessageNodes = [
      ...document.querySelectorAll('[data-testid*="message"]'),
      ...document.querySelectorAll('[class*="message"]'),
      ...document.querySelectorAll('main article'),
      ...document.querySelectorAll('main section')
    ];

    const seen = new Set();

    for (const node of possibleMessageNodes) {
      const text = (node.innerText || "").trim();
      if (!text) continue;
      if (text.length < 10) continue;
      if (seen.has(text)) continue;
      seen.add(text);

      let role = "message";
      const lower = (node.getAttribute("data-testid") || "" + " " + (node.className || "")).toLowerCase();
      if (lower.includes("user")) role = "user";
      else if (lower.includes("assistant")) role = "assistant";

      messages.push({ role, text });
    }

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
      return { convId, title: rawTitle, md, platform };
    }

    for (const m of messages) {
      const who =
        m.role === "user" ? "User" :
        m.role === "assistant" ? "Assistant" :
        "Message";

      md += `## ${who}\n\n${m.text}\n\n`;
    }

    return { convId, title: rawTitle, md, platform };
  }

  function extractConversationMarkdown() {
    return detectPlatform() === "claudeai"
      ? extractClaudeMarkdown()
      : extractChatGPTMarkdown();
  }

  function buildMainFilePath(title, convId, platform) {
    const shortId = convId.slice(0, 8);
    const stableName = `${slugifyTitle(title)}__${shortId}__${platform}.md`;
    return `${GH_PATH_PREFIX}/${stableName}`;
  }

  function buildSnapshotFilePath(title, convId, platform) {
    const stamp = dateStamp();
    const shortId = convId.slice(0, 8);
    const snapName = `${stamp}__${slugifyTitle(title)}__${shortId}__${platform}.md`;
    return `${GH_PATH_PREFIX}/${SNAPSHOT_SUBFOLDER}/${snapName}`;
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
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}?ref=${encodeURIComponent(BRANCH)}`;

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

    const existing = await getExistingFileMeta(token, path);
    const sha = existing && existing.sha ? existing.sha : null;

    const payload = {
      message,
      content: b64encode(content),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    };

    return ghRequest(baseUrl, token, "PUT", payload);
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

      const { convId, title, md, platform } = extractConversationMarkdown();
      const hash = simpleHash(md);

      if (auto && hash === getLastHash(convId)) return;

      const lockedTitle = getOrLockTitle(convId, title);
      const fullPath = getLockedPath(convId) || buildMainFilePath(lockedTitle, convId, platform);

      await upsertFileToGitHub({
        token,
        path: fullPath,
        content: md,
        message: `${auto ? "Auto-save" : "Save"} conversation: ${lockedTitle}`
      });

      setLockedPath(convId, fullPath);
      setLastHash(convId, hash);
      setLastSavedAt(convId, Date.now());

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

      const { convId, title, md, platform } = extractConversationMarkdown();
      const lockedTitle = getOrLockTitle(convId, title);
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

      const { convId, title: currentTitle, md, platform } = extractConversationMarkdown();
      const oldLockedTitle = getLockedTitle(convId);
      const oldPath = getLockedPath(convId);

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

      setLockedTitle(convId, currentTitle);
      setLockedPath(convId, newPath);
      setLastHash(convId, simpleHash(md));
      setLastSavedAt(convId, Date.now());

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

    const wrap = document.createElement("div");
    wrap.id = "jerlan-gh-logger";
    wrap.style.cssText = `
      position: fixed;
      left: 16px;
      bottom: 16px;
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
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;";

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
    info.textContent = "Hybrid lock title • Manual sync • ChatGPT + Claude";
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
  }

  // =======================
  // AUTOSAVE LOOP
  // =======================
  async function autosaveLoop() {
    while (true) {
      await sleep(AUTOSAVE_INTERVAL_MS);

      if (!getAutosave()) continue;
      if (!document.querySelector("main")) continue;

      const convId = getConversationIdFromUrl();
      const lastAt = getLastSavedAt(convId);

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

A few important notes for this version:

Save once first before using Sync Title.
That first save creates the locked title and remembers the original GitHub file path.

Yes, Sync Title keeps the conversation content because it writes the current full conversation into the new file before deleting the old one.

Claude support may need selector tweaks later if Claude changes its UI. ChatGPT selectors are more predictable; Claude tends to change frontend structure more often.

Your suffix request is now built in:

__chatgpt.md

__claudeai.md

Since you now log both platforms, you may want to rename your repo later from ChatGPT-Project-Conversations to something broader, but the script works fine as-is.

Your setup flow in Chrome is now:

install Tampermonkey

enable Chrome Developer mode in chrome://extensions

paste this script

save

open ChatGPT or Claude

click Set Token

click Test GitHub

click Save

Then later, if you rename a chat title and want GitHub to match, click Sync Title.

The one upgrade I’d recommend next is adding a platform subfolder too, like:

logs/conversations/chatgpt/...
logs/conversations/claudeai/...

That would make the repo even cleaner.

## User

yes i would love that. and i renamed the repo as AI-Chats (link: https://github.com/rudolfochua23/AI-Chats) respectively. also i already made the folders you asks, the chatgpt and claudeai folders

## Assistant

Perfect — here’s the updated version for your renamed repo AI-Chats, and it now saves into:

logs/conversations/chatgpt/

logs/conversations/claudeai/

with snapshots in:

logs/conversations/chatgpt/snapshots/

logs/conversations/claudeai/snapshots/

So your filenames will look like:

logs/conversations/chatgpt/how-to-build-a-website__abc12345__chatgpt.md

logs/conversations/claudeai/marketing-plan__xyz98765__claudeai.md

And snapshots like:

logs/conversations/chatgpt/snapshots/2026-03-21__143522__how-to-build-a-website__abc12345__chatgpt.md

Use this full replacement script:

JavaScript
// ==UserScript==
// @name         AI Chats Logger → GitHub (ChatGPT + Claude, Hybrid Title Sync)
// @namespace    jerlan-project
// @version      3.1.0
// @description  Save ChatGPT and Claude conversations to GitHub as Markdown. Hybrid title lock with manual sync, snapshots, autosave, platform folders, and source suffix.
// @match        https://chat.openai.com/*
// @match        https://chatgpt.com/*
// @match        https://claude.ai/*
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
  const GH_OWNER = "rudolfochua23";
  const GH_REPO = "AI-Chats";
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
        const mdNode = node.querySelector(".markdown, .prose") || node;
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

  function extractClaudeMarkdown() {
    const rawTitle = getBestTitle();
    const convId = getConversationIdFromUrl();
    const platform = detectPlatform();
    const convKey = getConversationKey(platform, convId);
    const messages = [];

    const possibleMessageNodes = [
      ...document.querySelectorAll('[data-testid*="message"]'),
      ...document.querySelectorAll('[class*="message"]'),
      ...document.querySelectorAll("main article"),
      ...document.querySelectorAll("main section")
    ];

    const seen = new Set();

    for (const node of possibleMessageNodes) {
      const text = (node.innerText || "").trim();
      if (!text) continue;
      if (text.length < 10) continue;
      if (seen.has(text)) continue;
      seen.add(text);

      let role = "message";
      const lower = `${node.getAttribute("data-testid") || ""} ${node.className || ""}`.toLowerCase();
      if (lower.includes("user")) role = "user";
      else if (lower.includes("assistant")) role = "assistant";

      messages.push({ role, text });
    }

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
    const url = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/contents/${urlPath}?ref=${encodeURIComponent(BRANCH)}`;

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

    const existing = await getExistingFileMeta(token, path);
    const sha = existing && existing.sha ? existing.sha : null;

    const payload = {
      message,
      content: b64encode(content),
      branch: BRANCH,
      ...(sha ? { sha } : {})
    };

    return ghRequest(baseUrl, token, "PUT", payload);
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

    const wrap = document.createElement("div");
    wrap.id = "jerlan-gh-logger";
    wrap.style.cssText = `
      position: fixed;
      left: 16px;
      bottom: 16px;
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
    header.style.cssText = "display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px;";

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
    info.textContent = "Hybrid lock title • Manual sync • Platform folders";
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

A couple of important notes:

Since you already created the chatgpt and claudeai folders, this script will use them directly.

You do not need to manually create the snapshots subfolders; GitHub will create them automatically when the first snapshot is saved.

Because the script now uses a platform::conversationId key, a ChatGPT chat and a Claude chat with the same-looking ID won’t conflict in Tampermonkey storage.

Your final structure will be:

AI-Chats/
└── logs/
    └── conversations/
        ├── chatgpt/
        │   ├── how-to-build-a-website__abc12345__chatgpt.md
        │   └── snapshots/
        │       └── 2026-03-21__143522__how-to-build-a-website__abc12345__chatgpt.md
        └── claudeai/
            ├── marketing-plan__xyz98765__claudeai.md
            └── snapshots/
                └── 2026-03-21__143700__marketing-plan__xyz98765__claudeai.md

One thing I’d do right after pasting this in Chrome is test in this order: Set Token → Test GitHub → Save on ChatGPT → Save on Claude → Sync Title on one renamed chat.

