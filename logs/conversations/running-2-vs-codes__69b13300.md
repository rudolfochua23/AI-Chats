# ChatGPT Conversation Log

- Conversation ID: 69b13300-d0d8-8323-b8d7-25fbf68533d5
- Title: Running 2 VS Codes
- Captured: 2026-03-11T09:37:15.103Z
- URL: https://chatgpt.com/c/69b13300-d0d8-8323-b8d7-25fbf68533d5

---

## User

is it ok to run 2 vscodes and both of them run copilot at the same time using 1 account?

## Assistant

Yes — it’s generally OK to run two VS Code windows with GitHub Copilot using the same account at the same time. 👍

How it works

GitHub Copilot is tied to your GitHub account, not strictly to a single VS Code instance. So you can:

Open multiple VS Code windows

Even run multiple VS Code processes

Use Copilot in all of them simultaneously

as long as you’re logged into the same GitHub account with an active Copilot subscription.

Common scenarios that work

✅ Two different projects open in separate VS Code windows
✅ One VS Code locally + one in a remote workspace (SSH / WSL / container)
✅ Multiple monitors with multiple editors running Copilot

Possible limitations

You might notice occasional issues like:

Slight rate limiting if many requests happen at the same time

Copilot temporarily pausing suggestions if too many completions are requested quickly

Auth refresh prompts if the GitHub session expires

But running two instances is completely normal and supported.

Tip

If you want better performance when running many editors:

Turn off Copilot in files where you don’t need it

Or disable inline suggestions in secondary windows.

Short answer:
✔ Yes, you can run 2 VS Code instances with Copilot at the same time on one account.

If you want, I can also explain when Copilot might stop suggesting in multiple windows and how to fix it quickly. 🚀

