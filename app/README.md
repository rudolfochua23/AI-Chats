# AI Chat Consolidator App

This folder contains a simple web app that consolidates markdown conversation exports from both ChatGPT and Claude AI.

## Features

- Unified conversation list with platform badges (`chatgpt` / `claudeai`).
- Includes linked snapshot conversations directly under each chat.
- Global search across every conversation + snapshot.
- Per-chat search while reading one conversation.
- Dedicated "Recent Scripts & Code" column for code/script fences.
- Clicking a code entry jumps to where the code appears in the conversation.

## Rebuild the dataset

```bash
node app/scripts/build-index.mjs
```

## Run locally

Use any static server from repo root, for example:

```bash
python3 -m http.server 4173
```

Then open:

`http://localhost:4173/app/`
