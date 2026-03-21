# ChatGPT Conversation Log

- Conversation ID: 69be637f-b234-8322-913f-386cf1604e74
- Title: Tampermonkey Setup Chrome
- Captured: 2026-03-21T09:27:22.671Z
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

