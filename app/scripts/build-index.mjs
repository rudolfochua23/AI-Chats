import fs from 'node:fs/promises';
import path from 'node:path';

const repoRoot = path.resolve(process.cwd());
const logsDir = path.join(repoRoot, 'logs', 'conversations');
const outFile = path.join(repoRoot, 'app', 'data', 'conversations.json');

const conversationHeadingRegex = /^##\s+(.+)$/gm;
const metadataRegex = /^-\s+([^:]+):\s*(.+)$/gm;
const codeFenceRegex = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)));
    } else if (entry.isFile() && entry.name.endsWith('.md')) {
      files.push(fullPath);
    }
  }

  return files;
}

function parseMetadata(md) {
  const metadata = {};
  const headerSection = md.split('\n---\n')[0] ?? '';
  for (const match of headerSection.matchAll(metadataRegex)) {
    metadata[match[1].trim().toLowerCase()] = match[2].trim();
  }
  return metadata;
}

function parseMessages(md) {
  const body = md.split('\n---\n').slice(1).join('\n---\n');
  const headings = [...body.matchAll(conversationHeadingRegex)];

  if (!headings.length) return [];

  return headings.map((match, index) => {
    const role = match[1].trim();
    const start = (match.index ?? 0) + match[0].length;
    const end = index + 1 < headings.length ? (headings[index + 1].index ?? body.length) : body.length;
    const text = body.slice(start, end).trim();
    return { role, text };
  });
}

function parseDocument(filePath, md) {
  const metadata = parseMetadata(md);
  const messages = parseMessages(md);

  const conversationId = metadata['conversation id'] ?? path.basename(filePath, '.md');
  const title = metadata.title ?? path.basename(filePath, '.md');
  const captured = metadata.captured ?? null;
  const platform = metadata.platform ?? inferPlatform(filePath);

  const codeSnippets = [];
  messages.forEach((message, messageIndex) => {
    for (const match of message.text.matchAll(codeFenceRegex)) {
      codeSnippets.push({
        messageIndex,
        role: message.role,
        language: match[1] || 'plaintext',
        code: match[2].trim(),
      });
    }
  });

  return {
    id: conversationId,
    title,
    platform,
    captured,
    url: metadata.url ?? null,
    sourcePath: path.relative(repoRoot, filePath).replace(/\\/g, '/'),
    messages,
    codeSnippets,
  };
}

function inferPlatform(filePath) {
  const normalized = filePath.toLowerCase();
  if (normalized.includes('claude')) return 'claudeai';
  if (normalized.includes('chatgpt')) return 'chatgpt';
  return 'unknown';
}

function sortByCapturedDesc(items) {
  return items.sort((a, b) => {
    const aTime = a.captured ? Date.parse(a.captured) : 0;
    const bTime = b.captured ? Date.parse(b.captured) : 0;
    return bTime - aTime;
  });
}

async function main() {
  const allFiles = await walk(logsDir);
  const snapshots = [];
  const conversations = [];

  for (const filePath of allFiles) {
    const md = await fs.readFile(filePath, 'utf8');
    const doc = parseDocument(filePath, md);
    if (filePath.includes(`${path.sep}snapshots${path.sep}`)) {
      snapshots.push(doc);
    } else {
      conversations.push(doc);
    }
  }

  const snapshotsByConversation = new Map();
  snapshots.forEach((snapshot) => {
    const list = snapshotsByConversation.get(snapshot.id) ?? [];
    list.push(snapshot);
    snapshotsByConversation.set(snapshot.id, list);
  });

  const combinedConversations = sortByCapturedDesc(conversations).map((conversation) => ({
    ...conversation,
    snapshots: sortByCapturedDesc(snapshotsByConversation.get(conversation.id) ?? []),
  }));

  const allCodeSnippets = [];
  combinedConversations.forEach((conversation) => {
    conversation.codeSnippets.forEach((snippet, snippetIndex) => {
      allCodeSnippets.push({
        id: `${conversation.id}::${snippetIndex}`,
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        platform: conversation.platform,
        captured: conversation.captured,
        ...snippet,
      });
    });

    conversation.snapshots.forEach((snapshot) => {
      snapshot.codeSnippets.forEach((snippet, snippetIndex) => {
        allCodeSnippets.push({
          id: `${snapshot.id}::snapshot::${snippetIndex}::${snapshot.captured ?? 'unknown'}`,
          conversationId: conversation.id,
          conversationTitle: conversation.title,
          platform: conversation.platform,
          captured: snapshot.captured ?? conversation.captured,
          fromSnapshot: true,
          snapshotCaptured: snapshot.captured,
          ...snippet,
        });
      });
    });
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    stats: {
      conversations: combinedConversations.length,
      snapshots: snapshots.length,
      codeSnippets: allCodeSnippets.length,
    },
    conversations: combinedConversations,
    codeSnippets: sortByCapturedDesc(allCodeSnippets),
  };

  await fs.writeFile(outFile, JSON.stringify(payload, null, 2));
  console.log(`Generated ${path.relative(repoRoot, outFile)} with ${payload.stats.conversations} conversations.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
