// ==UserScript==
// @name         ChatStash [STAGING]
// @namespace    chatstash-staging
// @version      5.0.0
// @description  Auto-save AI conversations with images and files to your ChatStash STAGING dashboard
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
// @grant        GM_xmlhttpRequest
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  // ━━━ CONFIG ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const API_URL = "https://chatstash-staging.powerbyte.app";
  const AUTOSAVE_MS = 1 * 60 * 1000;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file

  // ━━━ STORAGE KEYS (prefixed to avoid collision with prod) ━━━
  const K_API_KEY = "archiver_staging_api_key";
  const K_AUTOSAVE = "archiver_staging_autosave";
  const K_LAST_HASH = "archiver_staging_last_hash";
  const K_COLLAPSED = "archiver_staging_collapsed";
  const K_PANEL_POS = "archiver_staging_panel_pos";
  const K_CAPTURE_FILES = "archiver_staging_capture_files";

  // ━━━ HELPERS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // Convert DOM element's innerHTML to Markdown, preserving formatting
  function htmlToMarkdown(el) {
    if (!el) return "";
    const clone = el.cloneNode(true);
    // Remove UI chrome that platforms inject
    clone.querySelectorAll(
      'button, [role="button"], svg, form, [class*="action"], [class*="toolbar"], ' +
      '[class*="copy"], [class*="vote"], [class*="footer"], [class*="controls"], ' +
      '[class*="opacity-0"], .sr-only, [aria-hidden="true"]'
    ).forEach(n => n.remove());
    return nodeToMd(clone).replace(/\n{3,}/g, "\n\n").trim();
  }

  function nodeToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return "";

    const tag = node.tagName.toLowerCase();

    // Code blocks: <pre> containing <code>
    if (tag === "pre") {
      const code = node.querySelector("code");
      const lang = (code?.className?.match(/language-(\S+)/)?.[1] || code?.getAttribute("data-language") || "").replace("language-", "");
      const text = (code || node).textContent.trimEnd();
      return "\n\n```" + lang + "\n" + text + "\n```\n\n";
    }

    // Inline code
    if (tag === "code") {
      return "`" + node.textContent + "`";
    }

    // Recurse into children
    const children = Array.from(node.childNodes).map(nodeToMd).join("");

    switch (tag) {
      case "strong": case "b": return "**" + children.trim() + "**";
      case "em": case "i": return "*" + children.trim() + "*";
      case "del": case "s": return "~~" + children.trim() + "~~";
      case "h1": return "\n\n# " + children.trim() + "\n\n";
      case "h2": return "\n\n## " + children.trim() + "\n\n";
      case "h3": return "\n\n### " + children.trim() + "\n\n";
      case "h4": return "\n\n#### " + children.trim() + "\n\n";
      case "h5": return "\n\n##### " + children.trim() + "\n\n";
      case "h6": return "\n\n###### " + children.trim() + "\n\n";
      case "p": return "\n\n" + children + "\n\n";
      case "br": return "\n";
      case "hr": return "\n\n---\n\n";
      case "blockquote": return "\n\n" + children.trim().split("\n").map(l => "> " + l).join("\n") + "\n\n";
      case "a": {
        const href = node.getAttribute("href") || "";
        const text = children.trim();
        return href && text ? `[${text}](${href})` : text;
      }
      case "img": {
        const alt = node.getAttribute("alt") || "image";
        const src = node.getAttribute("src") || "";
        return src ? `![${alt}](${src})` : "";
      }
      case "ul": {
        const items = Array.from(node.children)
          .filter(c => c.tagName?.toLowerCase() === "li")
          .map(li => "- " + nodeToMd(li).trim().replace(/\n/g, "\n  "));
        return "\n\n" + items.join("\n") + "\n\n";
      }
      case "ol": {
        const items = Array.from(node.children)
          .filter(c => c.tagName?.toLowerCase() === "li")
          .map((li, i) => (i + 1) + ". " + nodeToMd(li).trim().replace(/\n/g, "\n   "));
        return "\n\n" + items.join("\n") + "\n\n";
      }
      case "li": return children;
      case "table": {
        const rows = Array.from(node.querySelectorAll("tr"));
        if (!rows.length) return children;
        const md = [];
        rows.forEach((tr, ri) => {
          const cells = Array.from(tr.querySelectorAll("th, td")).map(c => nodeToMd(c).trim().replace(/\|/g, "\\|"));
          md.push("| " + cells.join(" | ") + " |");
          if (ri === 0) md.push("| " + cells.map(() => "---").join(" | ") + " |");
        });
        return "\n\n" + md.join("\n") + "\n\n";
      }
      case "div": return children;
      default: return children;
    }
  }

  function simpleHash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    return h;
  }

  function getLastHash(id) {
    const data = JSON.parse(GM_getValue(K_LAST_HASH, "{}"));
    return data[id] || 0;
  }

  function setLastHash(id, hash) {
    const data = JSON.parse(GM_getValue(K_LAST_HASH, "{}"));
    data[id] = hash;
    GM_setValue(K_LAST_HASH, JSON.stringify(data));
  }

  function getAutosave() { return GM_getValue(K_AUTOSAVE, true); }
  function setAutosave(v) { GM_setValue(K_AUTOSAVE, v); }
  function getCaptureFiles() { return GM_getValue(K_CAPTURE_FILES, true); }
  function setCaptureFiles(v) { GM_setValue(K_CAPTURE_FILES, v); }

  // ━━━ PLATFORM DETECTION ━━━━━━━━━━━━━━━━━━━━━━━━━
  function detectPlatform() {
    const h = location.hostname;
    if (h.includes("claude.ai")) return "claudeai";
    if (h.includes("chatgpt") || h.includes("openai")) return "chatgpt";
    if (h.includes("gemini.google")) return "gemini";
    if (h.includes("copilot.microsoft")) return "copilot";
    if (h.includes("perplexity")) return "perplexity";
    if (h.includes("deepseek")) return "deepseek";
    if (h.includes("grok") || (h.includes("x.com") && location.pathname.includes("grok"))) return "grok";
    if (h.includes("mistral")) return "mistral";
    if (h.includes("huggingface")) return "huggingchat";
    if (h.includes("poe.com")) return "poe";
    return "unknown";
  }

  // Check if we're on an actual conversation page (not dashboard/project/settings)
  function isConversationPage() {
    const p = location.pathname;
    const platform = detectPlatform();

    switch (platform) {
      case "chatgpt":
        return /^\/c\/[a-zA-Z0-9_-]+/.test(p);
      case "claudeai":
        return /^\/chat\/[a-zA-Z0-9_-]+/.test(p);
      case "gemini":
        return /^\/app\/[a-f0-9-]+/.test(p);
      case "copilot":
        return /\/(c|thread)\//.test(p);
      case "deepseek":
        return /^\/chat\/[a-zA-Z0-9_-]+/.test(p);
      case "perplexity":
        return /^\/(search|thread)\/[a-zA-Z0-9_-]+/.test(p);
      case "grok":
        return /\/chat\/|\/i\/grok/.test(p);
      case "mistral":
        return /^\/chat\/[a-zA-Z0-9_-]+/.test(p);
      case "huggingchat":
        return /^\/chat\/[a-f0-9-]+/.test(p);
      case "poe":
        return /^\/chat\/[a-zA-Z0-9_-]+/.test(p);
      default:
        return false;
    }
  }

  function getConversationId() {
    const p = location.pathname;
    const m = p.match(/\/(?:c|chat|thread|search|app)\/([a-zA-Z0-9_-]+)/i);
    if (m) return m[1];
    return null;
  }

  function getTitle() {
    return document.title
      .replace(/\s*[-|]\s*(ChatGPT|Claude|Gemini|Copilot|Perplexity|DeepSeek|Grok|Mistral|HuggingChat|Poe)\s*$/i, "")
      .trim() || "Untitled";
  }

  // ━━━ FILE EXTRACTION ━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function isSmallIcon(img) {
    const w = img.naturalWidth || img.width || 0;
    const h = img.naturalHeight || img.height || 0;
    if (w <= 24 || h <= 24) return true;
    const cl = (img.className || "") + " " + (img.closest("[class]")?.className || "");
    return /avatar|icon|logo|emoji|profile/i.test(cl);
  }

  function fetchAsBase64(url) {
    return new Promise((resolve) => {
      GM_xmlhttpRequest({
        method: "GET", url,
        responseType: "arraybuffer",
        timeout: 15000,
        onload: (res) => {
          if (res.status < 300) {
            const bytes = new Uint8Array(res.response);
            if (bytes.length > MAX_FILE_SIZE) { resolve(null); return; }
            let binary = "";
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const contentType = res.responseHeaders?.match(/content-type:\s*([^\r\n;]+)/i)?.[1] || "application/octet-stream";
            resolve({ data: btoa(binary), mimeType: contentType, size: bytes.length });
          } else { resolve(null); }
        },
        onerror: () => resolve(null),
        ontimeout: () => resolve(null),
      });
    });
  }

  function dataUrlToBase64(dataUrl) {
    const m = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!m) return null;
    const data = m[2];
    if (data.length * 0.75 > MAX_FILE_SIZE) return null;
    return { data, mimeType: m[1], size: Math.floor(data.length * 0.75) };
  }

  async function extractImagesFromElement(el) {
    const attachments = [];
    const images = el.querySelectorAll("img");

    for (const img of images) {
      if (isSmallIcon(img)) continue;
      const src = img.src || img.getAttribute("src") || "";
      if (!src) continue;

      let result = null;
      if (src.startsWith("data:")) {
        result = dataUrlToBase64(src);
      } else if (src.startsWith("http")) {
        result = await fetchAsBase64(src);
      }

      if (result) {
        const ext = result.mimeType.split("/")[1]?.split("+")[0] || "png";
        attachments.push({
          fileName: `image_${attachments.length + 1}.${ext}`,
          mimeType: result.mimeType,
          data: result.data,
        });
      }
    }
    return attachments;
  }

  async function extractFilesFromElement(el) {
    const attachments = [];
    // Look for file attachment links
    const links = el.querySelectorAll('a[download], a[href*="blob:"], a[href*="/file/"], [data-testid*="file"], [class*="attachment"], [class*="file-card"]');

    for (const link of links) {
      const href = link.href || link.getAttribute("href") || "";
      const name = link.download || link.textContent?.trim() || link.getAttribute("aria-label") || "file";
      if (!href || href === "#") continue;

      const result = await fetchAsBase64(href);
      if (result) {
        attachments.push({
          fileName: name.slice(0, 100),
          mimeType: result.mimeType,
          data: result.data,
        });
      }
    }
    return attachments;
  }

  // ━━━ TEXT + FILE EXTRACTION PER PLATFORM ━━━━━━━━━
  function extractChatGPT() {
    const msgs = [];
    document.querySelectorAll("[data-message-author-role]").forEach((el) => {
      const role = el.getAttribute("data-message-author-role");
      const prose = el.querySelector(".markdown, .prose, [class*='markdown'], [class*='prose']") || el;
      const text = htmlToMarkdown(prose) || (prose.innerText || "").trim();
      if (text) msgs.push({ role: role === "user" ? "User" : "Assistant", text, _el: el });
    });
    return msgs;
  }

  // Claude uses virtualized rendering — messages are removed from DOM when scrolled past.
  // We must collect messages DURING scrolling, not after.
  async function extractClaude() {
    // Bail early if no conversation messages are visible — prevents scrolling on project/dashboard pages
    if (!document.querySelector('[data-testid="user-message"]')) return [];

    const scroller =
      document.querySelector('[class*="overflow-y-auto"]') ||
      document.querySelector("main") ||
      document.documentElement;

    // Collect messages while scrolling — deduplicate by text hash
    const collected = new Map(); // hash → { role, text }

    function harvestVisible() {
      // Find the conversation container (has many children, contains user-message elements)
      let container = null;
      const firstUser = document.querySelector('[data-testid="user-message"]');
      if (firstUser) {
        let el = firstUser;
        for (let i = 0; i < 10; i++) {
          el = el.parentElement;
          if (!el) break;
          if (el.children.length > 5 && el.querySelectorAll('[data-testid="user-message"]').length > 0) {
            container = el;
          }
        }
      }

      if (!container) return;

      for (const child of container.children) {
        const userMsg = child.querySelector('[data-testid="user-message"]');
        if (userMsg) {
          const text = htmlToMarkdown(userMsg) || (userMsg.innerText || "").trim();
          if (text) {
            const key = text.slice(0, 100);
            if (!collected.has(key)) collected.set(key, { role: "User", text, _el: child });
          }
        } else {
          // Assistant turn — htmlToMarkdown handles UI chrome stripping internally
          const text = htmlToMarkdown(child);
          if (text && text.length > 10) {
            const key = text.slice(0, 100);
            if (!collected.has(key)) collected.set(key, { role: "Assistant", text, _el: child });
          }
        }
      }
    }

    // Scroll to top
    scroller.scrollTop = 0;
    await sleep(600);
    harvestVisible();

    // Scroll down in steps, harvesting at each position
    const step = Math.max(window.innerHeight * 0.6, 300);
    let lastHeight = 0;
    let stableCount = 0;

    while (stableCount < 3) {
      scroller.scrollTop += step;
      await sleep(350);
      harvestVisible();

      const currentHeight = scroller.scrollHeight;
      if (currentHeight === lastHeight) {
        stableCount++;
      } else {
        stableCount = 0;
      }
      lastHeight = currentHeight;

      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 10) {
        stableCount++;
      }
    }

    // Final harvest at bottom
    scroller.scrollTop = scroller.scrollHeight;
    await sleep(400);
    harvestVisible();

    // Convert collected map to ordered array
    const msgs = [...collected.values()];
    return msgs;
  }

  function extractGeneric() {
    const msgs = [];
    const selectors = [
      '[data-message-author-role]', '[data-testid*="message"]',
      '[class*="message-row"]', '[class*="chat-message"]',
      '[class*="turn"]', 'main article',
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      if (els.length >= 2) {
        els.forEach((el, i) => {
          const text = htmlToMarkdown(el) || (el.innerText || "").trim();
          if (text && text.length > 5) {
            msgs.push({ role: i % 2 === 0 ? "User" : "Assistant", text, _el: el });
          }
        });
        if (msgs.length) return msgs;
      }
    }

    const main = document.querySelector("main");
    if (main) {
      const text = htmlToMarkdown(main) || (main.innerText || "").trim();
      if (text) msgs.push({ role: "Conversation", text, _el: main });
    }
    return msgs;
  }

  async function extractAll() {
    const platform = detectPlatform();
    let rawMsgs;
    if (platform === "chatgpt") rawMsgs = extractChatGPT();
    else if (platform === "claudeai") rawMsgs = await extractClaude();
    else rawMsgs = extractGeneric();

    const messages = [];
    const attachments = [];
    const captureFiles = getCaptureFiles();

    for (let i = 0; i < rawMsgs.length; i++) {
      const msg = rawMsgs[i];
      messages.push({ role: msg.role, text: msg.text });

      if (captureFiles && msg._el) {
        const imgs = await extractImagesFromElement(msg._el);
        const files = await extractFilesFromElement(msg._el);
        for (const att of [...imgs, ...files]) {
          attachments.push({ ...att, messageIndex: i });
        }
      }
    }

    return { messages, attachments };
  }

  // ━━━ API ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function getApiKey() { return GM_getValue(K_API_KEY, ""); }
  function setApiKey(v) { GM_setValue(K_API_KEY, v); }

  function pushToApi(payload) {
    const apiKey = getApiKey();
    if (!apiKey) return Promise.reject(new Error("No API key set. Click Set API Key."));
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: "POST",
        url: `${API_URL}/api/conversations`,
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        data: JSON.stringify(payload),
        timeout: 60000,
        onload: (res) => {
          if (res.status >= 200 && res.status < 300) {
            try { resolve(JSON.parse(res.responseText)); } catch { resolve({}); }
          } else {
            let msg = `HTTP ${res.status}`;
            try { msg = JSON.parse(res.responseText).error || msg; } catch {}
            reject(new Error(msg));
          }
        },
        onerror: () => reject(new Error("Network error")),
        ontimeout: () => reject(new Error("Request timeout")),
      });
    });
  }

  // ━━━ SAVE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  let saving = false;

  async function save(auto = false) {
    if (saving) return;

    if (!isConversationPage()) {
      if (!auto) toast("Not a conversation page — nothing to save.");
      return;
    }

    const id = getConversationId();
    if (!id) {
      if (!auto) toast("Could not detect conversation ID.");
      return;
    }

    saving = true;

    try {
      const { messages, attachments } = await extractAll();
      if (!messages.length) { if (!auto) toast("No messages found."); return; }

      const platform = detectPlatform();
      const title = getTitle();
      const hash = simpleHash(JSON.stringify(messages));

      if (auto && hash === getLastHash(id)) return;
      if (!auto) toast(attachments.length ? `Saving... (${attachments.length} files)` : "Saving...");

      const payload = {
        id, title, platform,
        url: location.href,
        captured: new Date().toISOString(),
        messages,
      };

      if (attachments.length > 0) payload.attachments = attachments;

      const result = await pushToApi(payload);

      setLastHash(id, hash);
      const parts = [`${messages.length} msgs`];
      if (result.savedAttachments > 0) parts.push(`${result.savedAttachments} files`);
      toast(`${auto ? "Auto-saved" : "Saved"}: ${title}\n(${parts.join(", ")})`);
    } catch (e) {
      console.error("Save failed:", e);
      toast(`Save failed:\n${e.message}`, 5000);
    } finally {
      saving = false;
    }
  }

  // ━━━ UI ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  function toast(msg, duration = 3000) {
    let el = document.getElementById("ai-archiver-toast-staging");
    if (!el) {
      el = document.createElement("div");
      el.id = "ai-archiver-toast-staging";
      Object.assign(el.style, {
        position: "fixed", bottom: "20px", right: "20px", zIndex: "99999",
        background: "#1a1400", color: "#fef3c7", border: "1px solid #f59e0b",
        borderRadius: "8px", padding: "10px 16px", fontSize: "13px",
        fontFamily: "system-ui", maxWidth: "320px", boxShadow: "0 4px 20px rgba(0,0,0,.4)",
        whiteSpace: "pre-wrap", lineHeight: "1.4",
      });
      document.body.appendChild(el);
    }
    el.textContent = msg; el.style.display = "block";
    clearTimeout(el._t);
    el._t = setTimeout(() => { el.style.display = "none"; }, duration);
  }

  function makeButton(label) {
    const btn = document.createElement("button");
    btn.textContent = label;
    Object.assign(btn.style, {
      width: "100%", padding: "8px", borderRadius: "10px",
      border: "1px solid rgba(0,0,0,.15)", background: "#fff",
      cursor: "pointer", marginBottom: "8px", color: "#111", fontSize: "12px",
    });
    btn.onmouseenter = () => { btn.style.background = "#f4f4f4"; };
    btn.onmouseleave = () => { btn.style.background = "#fff"; };
    return btn;
  }

  function enableDrag(wrap, ...handles) {
    let dragging = false, startX, startY, origLeft, origTop, moved;
    for (const handle of handles) {
      handle.style.cursor = "move";
      handle.addEventListener("mousedown", (e) => {
        dragging = true; moved = false;
        startX = e.clientX; startY = e.clientY;
        const rect = wrap.getBoundingClientRect();
        origLeft = rect.left; origTop = rect.top; e.preventDefault();
      });
    }
    document.addEventListener("mousemove", (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX, dy = e.clientY - startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
      wrap.style.left = `${origLeft + dx}px`;
      wrap.style.top = `${origTop + dy}px`;
      wrap.style.right = "auto"; wrap.style.bottom = "auto";
    });
    document.addEventListener("mouseup", () => {
      if (!dragging) return; dragging = false;
      if (moved) GM_setValue(K_PANEL_POS, JSON.stringify({ left: parseInt(wrap.style.left), top: parseInt(wrap.style.top) }));
    });
    // Returns whether the last mouseup was a drag (not a click)
    wrap._wasDrag = () => moved;
  }

  function mountUI() {
    if (document.getElementById("ai-archiver-panel-staging")) return;
    if (!document.body) return;

    const platform = detectPlatform();
    const label = "ChatStash [STG]";
    const isCollapsed = GM_getValue(K_COLLAPSED, true); // collapsed (small) by default
    const savedPos = GM_getValue(K_PANEL_POS, null);
    const pos = savedPos ? JSON.parse(savedPos) : null;

    const wrap = document.createElement("div");
    wrap.id = "ai-archiver-panel-staging";
    Object.assign(wrap.style, {
      position: "fixed",
      ...(pos ? { left: `${pos.left}px`, top: `${pos.top}px`, right: "auto", bottom: "auto" } : { left: "16px", bottom: "60px" }),
      zIndex: "999998", font: "12px/1.2 system-ui", color: "#111",
    });

    // ── Minimized: tiny circular + button ──
    const fab = document.createElement("button");
    fab.textContent = "+";
    Object.assign(fab.style, {
      width: "32px", height: "32px", borderRadius: "50%",
      border: "2px solid #f59e0b", background: "rgba(255,245,220,.95)",
      cursor: "pointer", color: "#92400e", fontSize: "18px", fontWeight: "700",
      boxShadow: "0 2px 8px rgba(0,0,0,.15)", backdropFilter: "blur(8px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: "0", lineHeight: "1",
    });
    wrap.appendChild(fab);

    // ── Expanded panel ──
    const panel = document.createElement("div");
    Object.assign(panel.style, {
      background: "rgba(255,251,235,.97)", border: "2px solid #f59e0b",
      borderRadius: "12px", padding: "10px", width: "220px",
      boxShadow: "0 10px 24px rgba(0,0,0,.12)", backdropFilter: "blur(8px)",
      display: "none",
    });
    wrap.appendChild(panel);

    const header = document.createElement("div");
    Object.assign(header.style, {
      display: "flex", justifyContent: "space-between", alignItems: "center",
      marginBottom: "8px", cursor: "move",
    });

    const titleEl = document.createElement("div");
    titleEl.textContent = label;
    titleEl.style.fontWeight = "700";
    titleEl.style.color = "#92400e";

    const closeBtn = document.createElement("button");
    closeBtn.textContent = "–";
    Object.assign(closeBtn.style, {
      width: "24px", height: "24px", borderRadius: "6px", border: "1px solid rgba(0,0,0,.15)",
      background: "#fff", cursor: "pointer", color: "#111",
    });

    header.appendChild(titleEl);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const content = document.createElement("div");
    panel.appendChild(content);

    const btnSave = makeButton("Save");
    btnSave.onclick = () => save(false);
    content.appendChild(btnSave);

    // Auto-save toggle
    const autoRow = document.createElement("label");
    Object.assign(autoRow.style, { display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px", userSelect: "none", fontSize: "12px" });
    const autoCb = document.createElement("input"); autoCb.type = "checkbox"; autoCb.checked = getAutosave();
    autoCb.onchange = () => { setAutosave(autoCb.checked); toast(`Auto-save ${autoCb.checked ? "on" : "off"}`); };
    autoRow.appendChild(autoCb); autoRow.appendChild(document.createTextNode("Auto-save (1 min)"));
    content.appendChild(autoRow);

    // Capture files toggle
    const fileRow = document.createElement("label");
    Object.assign(fileRow.style, { display: "flex", gap: "6px", alignItems: "center", marginBottom: "6px", userSelect: "none", fontSize: "12px" });
    const fileCb = document.createElement("input"); fileCb.type = "checkbox"; fileCb.checked = getCaptureFiles();
    fileCb.onchange = () => { setCaptureFiles(fileCb.checked); toast(`File capture ${fileCb.checked ? "on" : "off"}`); };
    fileRow.appendChild(fileCb); fileRow.appendChild(document.createTextNode("Capture images & files"));
    content.appendChild(fileRow);

    // API Key button
    const btnKey = makeButton("Set API Key");
    btnKey.onclick = () => {
      const current = getApiKey();
      const v = prompt("Paste your STAGING API Key from Settings → Tampermonkey API Key:", current || "");
      if (v && v.trim()) { setApiKey(v.trim()); toast("API key saved."); keyStatus.textContent = `Key: ...${v.trim().slice(-8)}`; }
    };
    content.appendChild(btnKey);

    const keyStatus = document.createElement("div");
    keyStatus.style.cssText = "font-size:11px;opacity:.6;margin-top:2px;margin-bottom:4px;";
    keyStatus.textContent = getApiKey() ? `Key: ...${getApiKey().slice(-8)}` : "No API key set";
    content.appendChild(keyStatus);

    const info = document.createElement("div");
    info.style.cssText = "font-size:11px;opacity:.6;margin-top:4px;";
    info.textContent = `→ ${API_URL.replace(/^https?:\/\//, "")}`;
    content.appendChild(info);

    function applyCollapse(collapsed) {
      fab.style.display = collapsed ? "flex" : "none";
      panel.style.display = collapsed ? "none" : "block";
    }

    fab.addEventListener("click", () => {
      if (wrap._wasDrag()) return; // ignore if it was a drag
      GM_setValue(K_COLLAPSED, false);
      applyCollapse(false);
    });

    closeBtn.onclick = () => {
      GM_setValue(K_COLLAPSED, true);
      applyCollapse(true);
    };

    applyCollapse(isCollapsed);
    document.body.appendChild(wrap);
    enableDrag(wrap, header, fab);
  }

  // ━━━ INIT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (!detectPlatform() || detectPlatform() === "unknown") return;

  setTimeout(() => {
    mountUI();
    toast("ChatStash [STAGING] active");
  }, 2000);

  setInterval(async () => {
    if (!getAutosave()) return;
    if (!isConversationPage()) return;
    if (!document.querySelector("main")) return;
    await save(true);
  }, AUTOSAVE_MS);
})();
