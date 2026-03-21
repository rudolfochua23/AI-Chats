const state = {
  dataset: null,
  filteredConversations: [],
  filteredCodeSnippets: [],
  selectedConversationId: null,
  globalQuery: '',
  chatQuery: '',
  codeQuery: '',
};

const els = {
  globalSearch: document.querySelector('#globalSearch'),
  conversationList: document.querySelector('#conversationList'),
  chatTitle: document.querySelector('#chatTitle'),
  chatSearch: document.querySelector('#chatSearch'),
  chatContent: document.querySelector('#chatContent'),
  codeList: document.querySelector('#codeList'),
  codeSearch: document.querySelector('#codeSearch'),
  stats: document.querySelector('#stats'),
};

init();

async function init() {
  const response = await fetch('./data/conversations.json');
  state.dataset = await response.json();
  state.filteredConversations = state.dataset.conversations;
  state.filteredCodeSnippets = state.dataset.codeSnippets;
  renderStats();
  renderConversationList();
  renderCodeList();
  bindEvents();
}

function bindEvents() {
  els.globalSearch.addEventListener('input', (event) => {
    state.globalQuery = event.target.value.trim().toLowerCase();
    applyConversationFilter();
    applyCodeFilter();
  });

  els.chatSearch.addEventListener('input', (event) => {
    state.chatQuery = event.target.value.trim().toLowerCase();
    renderChat();
  });

  els.codeSearch.addEventListener('input', (event) => {
    state.codeQuery = event.target.value.trim().toLowerCase();
    applyCodeFilter();
  });
}

function renderStats() {
  const { conversations, snapshots, codeSnippets } = state.dataset.stats;
  const generatedAt = new Date(state.dataset.generatedAt).toLocaleString();
  els.stats.textContent = `${conversations} chats · ${snapshots} snapshots · ${codeSnippets} code snippets · generated ${generatedAt}`;
}

function applyConversationFilter() {
  const query = state.globalQuery;
  state.filteredConversations = state.dataset.conversations.filter((conversation) => {
    if (!query) return true;
    const haystack = [
      conversation.title,
      conversation.platform,
      ...conversation.messages.map((message) => `${message.role} ${message.text}`),
      ...conversation.snapshots.flatMap((snapshot) => snapshot.messages.map((message) => message.text)),
    ].join(' ').toLowerCase();

    return haystack.includes(query);
  });

  if (state.selectedConversationId && !state.filteredConversations.some((item) => item.id === state.selectedConversationId)) {
    state.selectedConversationId = null;
    state.chatQuery = '';
    els.chatSearch.value = '';
  }

  renderConversationList();
  renderChat();
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
        <strong>${escapeHtml(conversation.title)}</strong>
      </div>
      <div class="meta">${formatDate(conversation.captured)} · ${conversation.messages.length} msgs · ${conversation.snapshots.length} snapshots</div>
    `;

    li.addEventListener('click', () => {
      state.selectedConversationId = conversation.id;
      state.chatQuery = '';
      els.chatSearch.value = '';
      renderConversationList();
      renderChat();
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
    return;
  }

  els.chatTitle.textContent = `${conversation.title} (${conversation.platform})`;
  els.chatSearch.disabled = false;

  const allBlocks = [];
  allBlocks.push(...conversation.messages.map((msg, index) => ({ ...msg, index, source: 'main' })));

  conversation.snapshots.forEach((snapshot) => {
    allBlocks.push({
      role: `Snapshot · ${formatDate(snapshot.captured)}`,
      text: '',
      snapshotHeader: true,
    });
    allBlocks.push(...snapshot.messages.map((message, index) => ({ ...message, index, source: 'snapshot' })));
  });

  const query = state.chatQuery;
  const rendered = allBlocks
    .filter((message) => {
      if (!query) return true;
      return `${message.role} ${message.text}`.toLowerCase().includes(query);
    })
    .map((message) => {
      if (message.snapshotHeader) {
        return `<div class="snapshot-group"><div class="snapshot-title">${escapeHtml(message.role)}</div></div>`;
      }

      const domId = message.source === 'main' ? `message-${message.index}` : '';
      return `
        <article class="message" id="${domId}">
          <h3>${escapeHtml(message.role)}</h3>
          <div>${renderText(message.text, query)}</div>
        </article>
      `;
    })
    .join('');

  els.chatContent.innerHTML = rendered || '<p class="meta">No matching content in this chat.</p>';
}

function renderCodeList() {
  els.codeList.innerHTML = '';

  state.filteredCodeSnippets.slice(0, 300).forEach((snippet) => {
    const li = document.createElement('li');
    li.innerHTML = `
      <div class="title-row">
        <span class="badge ${snippet.platform}">${snippet.platform}</span>
        <strong>${escapeHtml(snippet.language)}</strong>
      </div>
      <div class="meta">${escapeHtml(snippet.conversationTitle)} · ${formatDate(snippet.captured)}</div>
      <pre>${escapeHtml(snippet.code.slice(0, 250))}</pre>
    `;

    li.addEventListener('click', () => {
      state.selectedConversationId = snippet.conversationId;
      renderConversationList();
      renderChat();
      requestAnimationFrame(() => {
        const target = document.querySelector(`#message-${snippet.messageIndex}`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          target.style.outline = '2px solid var(--accent)';
          setTimeout(() => { target.style.outline = 'none'; }, 1200);
        }
      });
    });

    els.codeList.appendChild(li);
  });
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
