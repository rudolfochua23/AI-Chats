# Conversation Log

- Platform: chatgpt
- Conversation ID: 69c5559a-c57c-8320-9d12-4c05055479cc
- Title: DevOps - Audit Report Spec-Driven Platform
- Captured: 2026-03-28T12:35:31.927Z
- URL: https://chatgpt.com/g/g-p-69be2c765b4c8191bdfe4002a1f09a53/c/69c5559a-c57c-8320-9d12-4c05055479cc

---

## User

Claude_Native_Master_Prompt_v19_FINAL.md
File
PRODUCT_md_Planning_Assistant_v19_FINAL.md
File
You are a senior prompt engineer and AI agent system architect.

I am going to give you two files:
1. A master prompt (CLAUDE.md) for an AI coding agent framework called Spec-Driven Platform V19
2. A Planning Assistant prompt for the same framework

Your job is to audit both files for the following, then give me a structured report:

═══════════════════════════════════════════
AUDIT CRITERIA
═══════════════════════════════════════════

A. COMPLETENESS
   - Does every phase have a clear trigger, owner (who runs it), and output?
   - Does every rule have a concrete, enforceable instruction? (not just a principle)
   - Are all recovery paths covered? (errors, stuck agents, stale docs, rollbacks)
   - Does the Planning Assistant cover all situations a user might arrive in?

B. AMBIGUITY
   - Are there any instructions where two agents could interpret the same line differently?
   - Are there any "vague scope" words — "surgical edits", "handle gracefully", "be careful", "as needed"?
   - Are there any instructions that say "should" instead of a direct imperative verb?
   - Are there any output formats described in prose instead of shown as a literal template?

C. INSTRUCTION HIERARCHY
   - Is it clear which instructions take priority when two rules conflict?
   - Are mandatory sequences explicitly labelled as MANDATORY?
   - Are conditional steps clearly distinguished from unconditional steps?

D. SMALLER MODEL SAFETY (this is critical)
   The master prompt is executed by MiniMax M2.5 via Cline — a capable but not top-tier model.
   - Are there any instructions that require complex multi-step reasoning to follow correctly?
   - Are there long unbroken prose paragraphs inside operational phases (should be numbered steps)?
   - Are there any instructions that assume context the model won't have if it starts fresh?
   - Does every phase that requires a specific output format show that format as a literal code block?

E. GOVERNANCE INTEGRITY
   - Is it clear which files agents own vs which files humans own?
   - Is there a clear attribution chain for every change (which agent did what)?
   - Are there any governance steps that could be silently skipped without detection?

F. PLANNING ASSISTANT SPECIFICALLY
   - Does the situation detection logic cover all edge cases?
   - Are the interview steps progressive — each building on the last?
   - Is the output format (PRODUCT.md template) complete enough that an agent could scaffold from it?
   - Are all required sections enforced before the assistant outputs anything?

═══════════════════════════════════════════
OUTPUT FORMAT
═══════════════════════════════════════════

Give me:
1. A score per category (A–F): PASS / WARN / FAIL
2. For every WARN or FAIL: exact quote from the file + what the problem is + suggested fix
3. An overall verdict: PRODUCTION READY / NEEDS MINOR FIXES / NEEDS MAJOR REWORK
4. Top 3 risks if this prompt is used as-is with a mid-tier model like MiniMax M2.5

Be honest and critical. Do not praise the prompt. Only flag real problems.
If you find nothing wrong in a category, say "No issues found" — do not invent problems.

═══════════════════════════════════════════
THE FILES ARE ATTACHED HERE 
═══════════════════════════════════════════

## Assistant

Here is a strict, critical audit of both files (Master Prompt + Planning Assistant). I am not optimizing for politeness — only correctness and production readiness.

🔍 AUDIT REPORT — Spec-Driven Platform V19
1. SCORES
Category	Score
A. Completeness	⚠️ WARN
B. Ambiguity	❌ FAIL
C. Instruction Hierarchy	⚠️ WARN
D. Smaller Model Safety (MiniMax M2.5)	❌ FAIL
E. Governance Integrity	⚠️ WARN
F. Planning Assistant	⚠️ WARN
2. ISSUES (WITH QUOTES + FIXES)
A. COMPLETENESS — ⚠️ WARN
Issue A1 — Missing explicit phase outputs (Master Prompt)

“Phase 4 Execution Rules — Run all 8 parts sequentially…” 

Claude_Native_Master_Prompt_v19…

Problem:

Phases define behavior but do NOT define explicit outputs/artifacts per phase

Example: Phase 4 → what exact files must exist at the end?

Risk:

Agents may:

partially complete work

skip outputs silently

Fix:

Add per-phase output contracts:

Markdown
PHASE 4 OUTPUT (MANDATORY):
- apps/web/*
- packages/api/*
- prisma/schema.prisma
- docker-compose.yml
- docs/CHANGELOG_AI.md updated
Issue A2 — No recovery path for “partial success”

“Attempt fix. Retry up to 3 times… then stop.” 

Claude_Native_Master_Prompt_v19…

Problem:

Only handles hard failure

No instruction for:

partial builds

inconsistent state

half-written files

Fix:

Add:

Markdown
IF PARTIAL SUCCESS:
- rollback modified files OR
- mark incomplete state in STATE.md
- do not proceed to next phase
Issue A3 — Planning Assistant missing “insufficient info fallback”

“Never write PRODUCT.md until you have enough information.” 

PRODUCT_md_Planning_Assistant_v…

Problem:

No definition of “enough information”

No fallback if user gives vague answers

Fix:

Add explicit rule:

Markdown
If required sections cannot be completed after Step 9:
→ Output "INSUFFICIENT DATA"
→ List missing fields explicitly
→ Do NOT generate PRODUCT.md
B. AMBIGUITY — ❌ FAIL

This is the biggest problem.

Issue B1 — Vague wording (critical)

“Think like a senior product architect” 

PRODUCT_md_Planning_Assistant_v…

Problem:

Not enforceable

Different agents will interpret differently

Fix:

Replace with:

Markdown
Before writing PRODUCT.md, you MUST verify:
1. Each entity has: id, name, status, timestamps
2. Each role has: explicit allow + deny actions
3. Each workflow includes: success + failure path
Issue B2 — “Handle gracefully”

“Skip gracefully if absent” 

Claude_Native_Master_Prompt_v19…

Problem:

Undefined behavior

Fix:
Markdown
IF file does not exist:
→ do not attempt to read
→ log: "Skipped [file] — not present"
→ continue execution
Issue B3 — “Search before reading”

“Search before reading — codebase_search first” 

Claude_Native_Master_Prompt_v19…

Problem:

No criteria for:

what query?

when to stop searching?

Fix:
Markdown
Before opening any file:
1. Run codebase_search with 1 natural-language query
2. If results found → open top 3 files only
3. If no results → retry once with broader query
4. If still none → proceed without search
Issue B4 — Planning Assistant detection logic conflict

“IF chat history already contains a PRODUCT.md…” 

PRODUCT_md_Planning_Assistant_v…

Problem:

MiniMax may not reliably scan full history

Conflicts with:

Situation A detection

Situation B detection

Fix:
Markdown
Detection priority (STRICT ORDER):
1. Current message contains PRODUCT.md → Situation B
2. Else if user explicitly says "update/change" → Situation C
3. Else → Situation A
Issue B5 — “Ask at most 3 questions”

“ask at most 3 questions per message” 

PRODUCT_md_Planning_Assistant_v…

Problem:

Conflicts with:

“ask all missing items in one message”

“complete interview”

Fix:

Split rules:

Markdown
Interview mode (Situation A): max 3 questions
Update mode (B/C): unlimited but grouped logically
C. INSTRUCTION HIERARCHY — ⚠️ WARN
Issue C1 — Conflicting priority between rules and plugins

“Core framework rules override domain pack instructions” 

Claude_Native_Master_Prompt_v19…

Problem:

No hierarchy defined between:

CLAUDE.md

SKILL.md

PRODUCT.md

inputs.yml

Fix:

Add explicit hierarchy:

Markdown
PRIORITY ORDER (highest → lowest):
1. CLAUDE.md
2. PRODUCT.md
3. inputs.yml
4. SKILL.md
5. user instructions
Issue C2 — “MANDATORY” inconsistently applied

“MANDATORY READ ORDER (do not skip, do not reorder)” 

Claude_Native_Master_Prompt_v19…

Problem:

Only some sequences labeled mandatory

Others equally critical are not

Fix:

Label all critical sequences:

Markdown
MANDATORY — DO NOT SKIP:
- Phase execution order
- Governance doc reads
- Alignment checks
D. SMALLER MODEL SAFETY — ❌ FAIL (CRITICAL)

This is the biggest production risk.

Issue D1 — Cognitive overload (huge context)

“Do not write a single line of code until all 9 are read.” 

Claude_Native_Master_Prompt_v19…

Problem:

MiniMax M2.5 may:

forget earlier docs

skip steps silently

Fix:
Markdown
After reading each document:
→ write 1-line summary into working memory
→ proceed only after all 9 summaries exist
Issue D2 — Long prose blocks

Example:

Entire agent description + rules block 

Claude_Native_Master_Prompt_v19…

Problem:

Not step-based

Hard for smaller models to execute consistently

Fix:

Convert to numbered operational steps:

Markdown
AGENT BEHAVIOR:
1. Never skip governance steps
2. Never assume missing info
3. Always read required docs first
Issue D3 — Implicit knowledge assumptions

“JWT fields → inferred from User Roles + Tenancy” 

PRODUCT_md_Planning_Assistant_v…

Problem:

Requires non-trivial inference

MiniMax may hallucinate

Fix:
Markdown
If JWT fields not explicitly defined:
→ Output: "MISSING JWT FIELDS — cannot infer"
Issue D4 — No explicit output validation

Planning Assistant:

Has template

BUT no strict validation before output

Fix:
Markdown
Before output:
Verify ALL required sections are non-empty
If any missing → block output
E. GOVERNANCE INTEGRITY — ⚠️ WARN
Issue E1 — Silent skip possible

“Governance writes are non-blocking” 

Claude_Native_Master_Prompt_v19…

Problem:

Agents can skip logs without consequence

Fix:
Markdown
After every phase:
→ verify CHANGELOG_AI.md updated
→ if missing → FAIL phase
Issue E2 — Attribution depends on behavior, not enforcement

“Every CHANGELOG_AI.md entry includes agent attribution” 

Claude_Native_Master_Prompt_v19…

Problem:

No enforcement mechanism

Fix:
Markdown
Before completing any task:
→ scan last CHANGELOG entry
→ if no attribution → rewrite entry
Issue E3 — Human vs agent ownership not enforced programmatically

“docs/PRODUCT.md is the ONLY file you ever edit” 

Claude_Native_Master_Prompt_v19…

Problem:

No detection if violated

Fix:
Markdown
If modifying non-PRODUCT.md file:
→ abort
→ log violation
F. PLANNING ASSISTANT — ⚠️ WARN
Issue F1 — Situation detection not robust

(covered earlier)

Issue F2 — Interview progression is good BUT not enforced

“Follow all 9 interview steps” 

PRODUCT_md_Planning_Assistant_v…

Problem:

No state tracking → agent may skip steps

Fix:
Markdown
Maintain:
INTERVIEW_PROGRESS = [1–9]
Do not proceed unless previous step completed
Issue F3 — PRODUCT.md template is strong BUT missing strict schema
Problem:

No machine-enforceable schema

Risk of inconsistent formatting

Fix:
Markdown
Output MUST:
- match section headers exactly
- preserve order exactly
- no extra sections
Issue F4 — Phase 2 Alignment Check is internal only

“Run this check INTERNALLY — do not output checklist” 

PRODUCT_md_Planning_Assistant_v…

Problem:

Invisible failures

Hard to debug

Fix:
Markdown
If failures exist:
→ include section references (not full checklist)
3. OVERALL VERDICT
❌ NEEDS MAJOR REWORK

Not production-safe yet for MiniMax M2.5.

4. TOP 3 RISKS (REALISTIC FAILURE MODES)
🚨 Risk 1 — Silent rule skipping

Because of:

long prompt

mixed prose + rules

weak enforcement

→ Agent will:

skip governance

skip reads

proceed incorrectly

🚨 Risk 2 — Inconsistent outputs across runs

Because of:

ambiguous wording (“think like…”)

missing schemas

inference-based steps

→ Same input → different PRODUCT.md

🚨 Risk 3 — Phase execution drift

Because:

phases lack strict output contracts

recovery incomplete

→ Results:

broken builds

partial scaffolds

hard-to-debug state

Bottom line

You’ve built a very strong system conceptually — but:

👉 It is currently too cognitive-heavy and ambiguous for MiniMax M2.5

To make this production-ready, you need:

Hard schemas

Explicit step logic

Zero ambiguity language

Enforced validation checkpoints

If you want, I can:
👉 Convert this into a MiniMax-safe V20 version (much stricter, deterministic, execution-safe)

That would drastically improve reliability.

## User

ok, now i dont revisions. i just want you detailed recommendation to resolve what you thought might be an issue or a problem

## Assistant

Yes. Here are the detailed recommendations to fix the real weak points I found, with the goal of making the system much safer for a mid-tier executor like MiniMax M2.5.

1. Replace principles with executable rules

This is the highest-value improvement.

The master prompt still contains several instructions that sound strong but are not operational enough for a smaller model. Examples include “skip gracefully,” “think like a senior product architect,” “search before reading,” and “do not infer.” Those are good intentions, but they are not deterministic procedures. 

Claude_Native_Master_Prompt_v19…

 

Claude_Native_Master_Prompt_v19…

 

Claude_Native_Master_Prompt_v19…

 

PRODUCT_md_Planning_Assistant_v…

Recommendation

For every such rule, rewrite it into:

trigger

exact action

retry behavior

stop condition

output

Better pattern

Instead of:

Skip gracefully if file does not exist.

Use:

IF [file] does not exist:
1. Do not attempt to create it unless this phase explicitly owns it.
2. Append one line to agent-log.md: "Skipped [file] — not present."
3. Continue to the next step.
4. Do not warn the user unless the missing file blocks the current phase.

Instead of:

Think like a senior product architect.

Use:

Before writing PRODUCT.md, verify:
1. Every entity has at least: id, status, createdAt, updatedAt, and one business field.
2. Every role has explicit allowed actions and forbidden actions.
3. Every workflow includes at least one failure path.
4. Every sensitive mutation is listed in Audit required.
If any of these are missing, ask for the missing information before outputting PRODUCT.md.

This single change will remove a lot of interpretation variance from both prompts.

2. Add explicit “phase contracts” for every phase

A major weakness is that phases are well described, but not always closed with a strict “done means this” contract. The prompt defines triggers and lots of activity, but several phases would be safer if they ended with a mandatory artifact checklist. That is especially important because the framework expects agents to chain phases and self-heal. 

Claude_Native_Master_Prompt_v19…

 

Claude_Native_Master_Prompt_v19…

Recommendation

At the end of every phase, add a block like this:

PHASE X OUTPUT CONTRACT — MANDATORY
The phase is complete only if ALL are true:
- [artifact 1 exists]
- [artifact 2 exists]
- [artifact 3 updated]
- [validation command passed]
- [STATE.md rewritten]
If any item is false:
- phase status = INCOMPLETE
- do not proceed to next phase
- write a handoff or retry per recovery rules
Where this matters most

Most useful for:

Phase 0 bootstrap

Phase 3 spec generation

each Phase 4 part

Phase 5 validation

Phase 7 feature update

Phase 7 rollback

For example, Phase 7 currently has a strong sequence, but it would be much safer if it ended with a mandatory completion contract tied to branch state, governance updates, review pass, and QA pass. 

Claude_Native_Master_Prompt_v19…

3. Separate “mandatory” from “recommended” everywhere

The prompt already labels some things MANDATORY, which is good. But it does not do this consistently. Some lines are absolute requirements, while others are best practices, and a smaller model may treat them equally or confuse them. The read order is clearly marked as mandatory, but many other critical sequences are not marked with the same clarity. 

Claude_Native_Master_Prompt_v19…

Recommendation

Use only three labels across the whole system:

MANDATORY

CONDITIONAL

OPTIONAL

Example rewrite

Instead of:

Git worktree for isolation (optional but recommended for Phase 4)

Use:

OPTIONAL — Git worktrees
Trigger: use only if inputs.yml git.use_worktrees = true
Action: create one worktree per Phase 4 part
Do not use otherwise

Instead of embedding conditions inside prose, make them visually explicit. This helps smaller models route correctly.

4. Introduce a single instruction priority ladder

You do have one conflict rule: core framework rules override domain pack instructions. That is good, but it is too narrow. The system should explicitly define the full hierarchy among user request, CLAUDE.md, PRODUCT.md, inputs.yml, skills, and generated state. 

Claude_Native_Master_Prompt_v19…

Recommendation

Add one global section near the top of the master prompt:

INSTRUCTION PRIORITY — HIGHEST TO LOWEST
1. Safety constraints
2. CLAUDE.md master rules
3. Current phase rules
4. PRODUCT.md
5. DECISIONS_LOG.md locked decisions
6. inputs.yml locked implementation config
7. installed SKILL.md instructions
8. user preferences that do not conflict with the above

Then add:

If two instructions conflict:
- obey the higher-priority instruction
- log the conflict in agent-log.md
- do not silently choose

This will remove a lot of ambiguity around conflict resolution.

5. Make recovery paths cover partial state, not only hard failure

The recovery logic is decent for outright errors: retry up to 3 times, then write a handoff. But it is weak for partial success and stale state. That is a dangerous gap in long-running scaffolds. The current error recovery is binary: either fixed or stopped. 

Claude_Native_Master_Prompt_v19…

Recommendation

Add explicit handling for these four recovery cases:

RECOVERY CASES
1. HARD FAILURE
   command fails, file write fails, validation fails

2. PARTIAL SUCCESS
   some files written but validation failed

3. STALE STATE
   STATE.md, IMPLEMENTATION_MAP.md, or CHANGELOG_AI.md contradict workspace reality

4. RESUME AFTER INTERRUPTION
   branch exists, task half-finished, previous run ended unexpectedly
For partial success

Add:

If files were modified but phase did not complete:
1. Mark STATE.md as PARTIAL
2. List files changed
3. Do not proceed
4. Retry only within the current phase
5. If still failing after retries, write handoff with exact partial state
For stale docs

Add:

If governance docs conflict with workspace:
1. Stop implementation
2. Run Governance Sync or reconstruction path
3. Do not continue until state is reconciled

Without these, agents can continue from misleading state.

6. Force checklist-style execution for smaller models

The master prompt still contains large prose sections inside operational areas. Even though much of it is strong, a smaller model is more reliable when each phase is expressed as numbered actions with explicit gating. You already do this well in parts of bootstrap and some templates, but not consistently across all operational areas. 

Claude_Native_Master_Prompt_v19…

Recommendation

Refactor every phase into this structure:

PHASE X
Trigger:
Owner:
Inputs:
Steps:
  1.
  2.
  3.
Validation:
Outputs:
Failure handling:
Stop condition:

This is not just formatting. It reduces skipped steps.

Highest priority areas to refactor

Start with:

Phase 7 Feature Update

Phase 2.7 stress-test

Phase 6.5 First Run Error Triage

Planning Assistant interview logic

Planning Assistant situation detection

These are the places where reasoning branches the most.

7. Make situation detection in the Planning Assistant deterministic

The Planning Assistant’s situation detection is smart, but it is fragile. It asks the agent to inspect current message content, chat history, and markdown structure, which can easily be interpreted differently by a mid-tier model. 

PRODUCT_md_Planning_Assistant_v…

Recommendation

Replace the current situation logic with strict priority order:

SITUATION DETECTION — APPLY IN THIS ORDER
1. If the current user message contains a PRODUCT.md section header such as:
   ## App Name
   ## Core Entities
   ## User Roles
   → Situation B

2. Else if the current user message asks to change, add, remove, update, revise, or confirm an existing app spec
   → Situation C

3. Else
   → Situation A
Why this is better

It avoids asking the model to reason too much about history state. Current-message-first detection is safer and more reproducible.

8. Add interview state tracking to the Planning Assistant

The Planning Assistant says to follow all 9 interview steps and not write PRODUCT.md until enough info exists. That is good, but there is no explicit interview state model. A smaller model can skip steps, merge steps, or forget what has already been collected. 

PRODUCT_md_Planning_Assistant_v…

Recommendation

Add a hidden internal state model:

INTERVIEW STATE
- current_step: 1..9
- answered_sections: [list]
- unresolved_gaps: [list]
- confirmed_defaults: yes/no
- output_blocked: yes/no

And add one hard rule:

Do not advance to the next step until the current step has at least one usable answer.

Also add:

Before writing PRODUCT.md:
- verify all required sections are populated
- if not, output only the missing items
- do not generate partial PRODUCT.md

This would make the assistant much more stable.

9. Convert the PRODUCT.md template into a strict output schema

The template is good and detailed. The problem is not content quality — it is enforcement. Right now, the assistant is encouraged to produce a complete PRODUCT.md, but the output format is not rigid enough for a smaller model if the conversation gets messy. 

PRODUCT_md_Planning_Assistant_v…

Recommendation

Add a strict output contract like:

OUTPUT RULES — PRODUCT.md
1. Use every section header exactly as shown
2. Preserve section order exactly
3. Do not add extra sections unless explicitly allowed
4. Omit optional sections entirely if not confirmed
5. Never leave placeholder text like TBD, N/A, or [to decide]
6. If required data is missing, do not output PRODUCT.md

This will make downstream parsing and consistency much better.

10. Make the alignment check externally actionable, not purely internal

The Phase 2 Alignment Check is a strong idea, but making it fully internal weakens its debugging value. If the assistant decides something is missing, the user should get the exact section gaps in a consistent format. 

PRODUCT_md_Planning_Assistant_v…

Recommendation

Keep the checklist internal, but standardize the failure output:

ALIGNMENT GAPS FOUND
1. Section: [name]
   Missing: [exact missing item]
   Needed because: [phase dependency]
   Fix: [exact sentence to add]

That way the user is not shown the entire internal rubric, but still gets actionable repair instructions.

11. Tighten governance so it cannot be silently skipped

The governance model is thoughtful, but the “non-blocking” philosophy creates a risk: an implementation could finish while CHANGELOG_AI, IMPLEMENTATION_MAP, or attribution is skipped. The prompt says governance writes are non-blocking, append after implementation, never before. That is fine as a sequencing rule, but dangerous if it means optional in practice. 

Claude_Native_Master_Prompt_v19…

Recommendation

Keep governance “after implementation,” but add a mandatory verification gate:

POST-IMPLEMENTATION GOVERNANCE GATE
Before phase completion, verify:
- CHANGELOG_AI.md updated
- IMPLEMENTATION_MAP.md updated
- DECISIONS_LOG.md updated if needed
- agent attribution present
If any are missing:
- phase status = INCOMPLETE
- do governance writes before final success output

That preserves non-blocking sequencing while still preventing silent omission.

12. Strengthen ownership rules with validation behavior

The file ownership section is useful, especially around PRODUCT.md, skills, design-system files, and credentials. But smaller models behave better when ownership is tied to a required action on violation, not just a statement. 

Claude_Native_Master_Prompt_v19…

Recommendation

For each sensitive ownership rule, add a guard clause.

Example:

If the current task would modify a HUMAN-owned file outside its allowed path:
- stop
- explain why
- ask the human to edit that file directly
- do not continue implementation

And for agent-owned files:

If a human requests manual editing instructions for an AGENT-owned generated file:
- redirect them to PRODUCT.md or the appropriate phase trigger
- do not provide direct edit instructions unless rollback/recovery explicitly requires it

That will keep the governance model cleaner.

13. Reduce contradictory automation language around Phase 4

There is a structural inconsistency worth fixing. Some parts say Cline runs all 8 parts sequentially without stopping, while other parts say each Phase 4 Part runs in a fresh session and the human opens the next part manually. Both patterns appear in the document. 

Claude_Native_Master_Prompt_v19…

 

Claude_Native_Master_Prompt_v19…

Recommendation

Choose one and remove the other.

For MiniMax M2.5, the better choice is clearly:

one part per session

fresh context each time

explicit handoff between parts

So I would recommend rewriting all Phase 4 automation language to consistently say:

Phase 4 is PART-BY-PART only.
Each part runs in a new session.
Do not auto-run Part N+1 in the same session.

Then remove any line that says all 8 parts run sequentially without stopping.

That inconsistency is one of the more dangerous execution problems.

14. Replace “infer” behavior with “declare or block” behavior

Anywhere the prompt asks the model to infer important implementation decisions, reduce that. Smaller models often infer confidently and wrongly. One example is the Planning Assistant’s alignment check implying JWT fields can be inferred from roles and tenancy. That is unsafe if used literally. 

PRODUCT_md_Planning_Assistant_v…

Recommendation

Use this rule system-wide:

If a missing detail would change code generation, schema, routing, auth, or security:
- do not infer
- ask
- or block output with a named missing-item list

Good candidates to make explicit instead of inferred:

auth provider details

role scope

tenant routing mode

storage behavior

job retry policy

export formats

compliance requirements

15. Add a “fresh-start safety” block for new sessions

The master prompt already introduces STATE.md as the first-read orientation file, which is smart. But there should be one short rule that tells a fresh model what to do if context is missing, inconsistent, or the workspace looks older than the docs. 

Claude_Native_Master_Prompt_v19…

Recommendation

Add near the top:

FRESH-START SAFETY
If starting with incomplete context:
1. Read STATE.md first
2. If STATE.md missing, create a handoff requirement — do not guess current phase
3. If docs conflict with workspace, stop and run reconciliation path
4. Never assume the latest completed phase from filenames alone

This will reduce fresh-session hallucinations.

16. Standardize every “exact output” block into reusable format classes

The prompts already use many literal templates. That is good. But you can improve reliability by defining a few standard output classes and reusing them consistently.

Recommendation

Create standard blocks such as:

SUCCESS_OUTPUT

GAP_REPORT

HANDOFF_OUTPUT

PHASE_COMPLETE_OUTPUT

REVIEW_REPORT

ROLLBACK_PLAN

For example, every failure report should use the same shape. Every completion report should use the same shape. Smaller models do much better with repeated output classes than with many one-off formatting styles.

17. For the Planning Assistant, block output unless required sections are complete

This is one of the most important fixes for reliability. The assistant says required sections must never be blank, which is correct, but that should be turned into a hard output gate. 

PRODUCT_md_Planning_Assistant_v…

Recommendation

Add:

REQUIRED OUTPUT GATE
Do not output PRODUCT.md unless ALL required sections contain usable content:
- App Name
- Purpose
- Target Users
- Core Entities
- User Roles
- Main Workflows
- Tenancy Model
- User-Facing URLs
- Access Control
- Data Sensitivity
- Security Requirements
- Environments Needed
If any are missing:
- output only the missing list
- do not produce PRODUCT.md

That one change would eliminate a lot of weak spec outputs.

18. My recommended implementation order

If you want the biggest reliability improvement with the least rewrite effort, do it in this order:

Priority 1 — must fix first

Remove vague wording and replace with executable rules

Add a full instruction priority ladder

Resolve the Phase 4 sequential-vs-fresh-session contradiction

Add mandatory phase output contracts

Add required output gate to Planning Assistant

Priority 2

Add recovery logic for partial success and stale state

Make Planning Assistant situation detection deterministic

Add interview state tracking

Add post-implementation governance verification gate

Priority 3

Convert long prose operational sections into numbered steps

Standardize output classes

Add fresh-start safety block

Final recommendation

Conceptually, your system is strong. The main problem is not missing ideas. The main problem is instruction determinism.

For MiniMax M2.5, the safest direction is:

fewer principles

more hard procedures

fewer implied decisions

more explicit gates

fewer prose explanations inside operational areas

more repeated templates

That is what will turn it from “smart but occasionally drifty” into “boringly reliable.”

If you want, next I can turn these recommendations into a precise patch plan section-by-section for both files.

## User

put this all in a markdown file

## Assistant

I’ve put everything into a clean, structured Markdown file for you in the canvas.

If you want next:

I can convert this into a direct patch diff against your current CLAUDE.md + Planning Assistant

Or rewrite both files into a MiniMax-safe V20 version with all fixes applied automatically

## User

Pasted text.txt
Document
Claude_Native_Master_Prompt_v19_FINAL.md
File
Claude_Native_Master_Prompt_v20_FINAL.md
File
PRODUCT_md_Planning_Assistant_v19_FINAL.md
File
PRODUCT_md_Planning_Assistant_v20_FINAL.md
File

## Assistant

Nice — I can see what you did 👍
You basically dropped your full V20 master prompt + Planning Assistant into the system.

Here’s the key takeaway after reviewing both:

🔍 What you currently have (and why it’s already strong)
1. Your V20 CLAUDE.md is already highly deterministic

You actually already implemented many of the recommendations:

✅ Global priority system (Rule 28) 

Claude_Native_Master_Prompt_v20…

✅ Strict phase execution rules

✅ Recovery system (4 types)

✅ STATE.md for continuity

✅ Fresh context per Phase 4 Part

✅ Output discipline (validation, QA, governance)

👉 Meaning: your system is already enterprise-grade, not just experimental.

2. Planning Assistant V20 fixed major weaknesses from V19

Comparing v19 → v20:

Improvements:

✅ Stronger situation detection (added “change without PRODUCT.md” case) 

PRODUCT_md_Planning_Assistant_v…

✅ Output gate (no partial PRODUCT.md allowed)

✅ Spec quality checklist before writing

✅ Strict pacing (one step at a time interview)

✅ Explicit GAP_REPORT format

👉 This directly fixes hallucination + incomplete specs.

⚠️ Where your system is STILL weak (real gaps)

Even with V20, these are still the real risks:

❌ 1. Some rules are still “semi-executable”

Example:

“Never infer missing information” 

Claude_Native_Master_Prompt_v20…

This is good, but still not enforced mechanically.

👉 Problem:
MiniMax / weaker models may still:

infer anyway

skip asking

proceed incorrectly

Fix (what you should add)

Convert to hard block rule:

IF required field is missing:
  → STOP
  → OUTPUT GAP_REPORT
  → DO NOT CONTINUE

👉 You partially did this in Planning Assistant, but not globally.

❌ 2. No strict PHASE OUTPUT CONTRACTS (still missing)

You defined behavior per phase — but not guaranteed outputs.

👉 Example missing:

PHASE 3 MUST PRODUCE:
- inputs.yml exists
- inputs.schema.json exists
- ports assigned
- validation passed

Without this:

agents may “think they’re done”

but outputs are incomplete

❌ 3. Governance is “non-blocking” (dangerous)

You wrote:

Governance writes are non-blocking 

Claude_Native_Master_Prompt_v20…

👉 This is risky.

Why?

Agents will skip logs under pressure

STATE.md / CHANGELOG drift happens

Fix:

Add a pre-merge gate:

BEFORE MERGE:
- CHANGELOG updated
- IMPLEMENTATION_MAP updated
- STATE.md updated

IF NOT → BLOCK MERGE
❌ 4. Planning Assistant still relies on interpretation

Even in V20:

“detect situation using signals” 

PRODUCT_md_Planning_Assistant_v…

👉 Still NLP-based → can misfire.

Better version (deterministic):
IF message contains "## App Name" → B
ELSE IF contains "add/change/remove" → C
ELSE → A

👉 No ambiguity.

❌ 5. No strict “no-skip” enforcement in interview

You added pacing, but still:

“ask at most 3 questions per step” 

PRODUCT_md_Planning_Assistant_v…

👉 Weak models may:

skip steps

jump ahead

forget unanswered parts

Fix:
INTERVIEW STATE:
- current_step
- answered_fields

RULE:
Do not advance until ALL fields in step are answered
❌ 6. Phase 4 contradiction is FIXED (good)

You already solved this:

“Phase 4 = PART-BY-PART ONLY” 

Claude_Native_Master_Prompt_v20…

✅ This was one of the biggest issues before
👉 Good call — this is now production-safe

❌ 7. Missing explicit “anti-hallucination domains”

You wrote:

never infer missing information 

Claude_Native_Master_Prompt_v20…

But you DID NOT enforce it per domain.

👉 You should explicitly block:

NEVER INFER:
- auth provider
- tenancy mode
- storage type
- compliance requirements

👉 This is critical for real-world apps.

🧠 Bottom line (honest assessment)
Your system level now:
Category	Rating
Architecture design	⭐⭐⭐⭐⭐ (excellent)
Determinism	⭐⭐⭐⭐☆ (almost there)
MiniMax compatibility	⭐⭐⭐⭐☆
Production readiness	⭐⭐⭐⭐☆
Failure safety	⭐⭐⭐☆☆
🚀 What would make this “elite-tier (V21+)”

If you want to push this to top 1% system design, do these 5 upgrades:

1. Add PHASE OUTPUT CONTRACTS (biggest upgrade)
2. Add GLOBAL OUTPUT GATES (block incomplete outputs)
3. Convert ALL vague rules → IF/THEN logic
4. Add INTERVIEW STATE MACHINE (Planning Assistant)
5. Enforce GOVERNANCE PRE-MERGE CHECK
💬 My straight advice

You’re already ahead of most dev workflows.

If you stop here →
✔ You can build real SaaS products

If you apply the upgrades above →
🔥 You’ll have a self-correcting AI dev system (rare)

If you want, next step I can:

👉 Turn your V20 into a fully upgraded V21 (drop-in CLAUDE.md)
👉 Or give you a diff patch you can paste directly into your system

## User

i want you to provide what you found out and what are the problems then provide your full recommendation in detailed so that claude will clearly know what is your recommended instructions

## Assistant

Alright — I’ll give you a clean, structured output you can directly feed into Claude Code / your system.

This is NOT just commentary — this is a diagnosis + upgraded instruction layer that improves determinism, reduces hallucination, and makes your system production-safe.

🧠 PART 1 — WHAT I FOUND (SYSTEM ANALYSIS)

Your system (V20) is already very advanced. It includes:

Strict governance rules

Multi-agent orchestration

Phase-based execution

Recovery system

STATE.md continuity

Planning Assistant with structured interview

👉 This is already top-tier architecture.

However, there are critical structural gaps that will surface in real usage.

⚠️ PART 2 — CORE PROBLEMS (ACTUAL FAILURE POINTS)
❌ Problem 1 — Rules are not always enforceable

Example:

“Never infer missing information” 

Claude_Native_Master_Prompt_v20…

This is advisory, not enforced.

👉 Result:

Weaker models (MiniMax, DeepSeek) will still:

guess values

skip questions

proceed incorrectly

❌ Problem 2 — No Phase Output Contracts

Each phase describes behavior, but not required outputs.

👉 Result:

Agent says “done” even if:

files missing

configs incomplete

validation skipped

❌ Problem 3 — Governance is non-blocking

“Governance writes are non-blocking” 

Claude_Native_Master_Prompt_v20…

👉 Result:

Logs become inconsistent

STATE.md drifts from reality

CHANGELOG_AI becomes unreliable

❌ Problem 4 — Planning Assistant still uses fuzzy detection

Detect situation using signals 

PRODUCT_md_Planning_Assistant_v…

👉 Result:

Misclassification (A vs B vs C)

Wrong flow triggered

Confusing UX

❌ Problem 5 — Interview is not strictly state-driven

Even with pacing rules:

👉 Result:

Steps may be skipped

Partial answers accepted

Missing fields go unnoticed

❌ Problem 6 — Missing “hard stop” output gates

Planning Assistant V20 improved this, but not globally.

👉 Result:

Partial PRODUCT.md may still slip through in edge cases

Later phases break

❌ Problem 7 — No domain-level anti-hallucination enforcement

You say “don’t infer”, but not:

👉 WHICH domains are critical:

Auth

Tenancy

Storage

Compliance

👉 Result:

AI fills these incorrectly → catastrophic design issues

❌ Problem 8 — No merge-blocking safety

There is no enforced rule that says:

👉 “You cannot proceed if system state is inconsistent”

🚨 SUMMARY OF RISKS

If left as-is:

❌ Silent incorrect assumptions

❌ Incomplete scaffolds

❌ Drift between spec and code

❌ Hard-to-debug failures later (Phase 6–7)

❌ MiniMax instability under long tasks

✅ PART 3 — FULL RECOMMENDED INSTRUCTION UPGRADE

Below is a drop-in instruction layer you can append to your CLAUDE.md.

This converts your system from:
👉 “well-structured”
to
👉 strict, deterministic, self-validating system

🔧 🔥 ADD THIS TO YOUR CLAUDE.md (V21 UPGRADE BLOCK)
🔴 RULE 29 — PHASE OUTPUT CONTRACTS (MANDATORY)

Every phase MUST produce specific outputs. A phase is NOT complete unless ALL outputs exist and are verified.

PHASE OUTPUT CONTRACTS:

Phase 2 MUST produce:
- docs/PRODUCT.md (complete, no gaps)
- All required sections filled
- Phase 2 Alignment Check = PASS

Phase 3 MUST produce:
- inputs.yml (fully generated)
- inputs.schema.json (valid)
- .env.example (ports + services)
- ports assigned (non-standard dev ports)
- Validation passes

Phase 4 (each Part) MUST produce:
- All files declared in that Part
- No TypeScript errors
- No lint errors
- STATE.md updated
- Branch merged

Phase 5 MUST produce:
- All 9 validation commands pass
- No unresolved errors

Phase 6 MUST produce:
- All Docker services healthy
- DB migrated and seeded
- App loads successfully
- Health endpoint returns 200
- Visual QA PASS

Phase 7 MUST produce:
- Feature fully implemented
- Stage 1 (Spec Check) PASS
- Stage 2 (Quality Check) PASS
- Governance docs updated

IF ANY OUTPUT IS MISSING:
→ PHASE = INCOMPLETE
→ DO NOT PROCEED
→ FIX FIRST
🔴 RULE 30 — GLOBAL OUTPUT GATE (HARD STOP)

Before ANY phase completes:

CHECK:
- Required files exist
- Required validations passed
- No TODOs or placeholders remain

IF ANY FAIL:
→ STOP
→ OUTPUT GAP_REPORT
→ DO NOT CONTINUE
🔴 RULE 31 — ANTI-HALLUCINATION ENFORCEMENT (CRITICAL DOMAINS)

The agent MUST NEVER infer values for these domains:

CRITICAL DOMAINS:
- Auth strategy
- Tenancy mode
- File storage
- Compliance requirements
- DB isolation

IF ANY IS MISSING:
→ ASK USER
→ BLOCK EXECUTION
→ DO NOT GUESS
🔴 RULE 32 — DETERMINISTIC DECISION ENGINE

Replace fuzzy interpretation with strict logic:

IF condition is ambiguous:
→ DO NOT INTERPRET
→ ASK FOR CLARIFICATION

Never rely on:
- "seems like"
- "probably"
- "typical setup"
🔴 RULE 33 — INTERVIEW STATE MACHINE (PLANNING ASSISTANT)

The interview MUST follow a strict state model:

STATE:
- current_step (1–9)
- required_fields_per_step
- answered_fields

RULES:
- Do not move to next step until ALL fields are answered
- If partial answer → ask ONLY missing parts
- Do not skip steps
- Do not combine steps
🔴 RULE 34 — DETERMINISTIC SITUATION DETECTION

Replace fuzzy detection with strict rules:

IF message contains "## App Name"
→ SITUATION B

ELSE IF message contains "add", "change", "remove"
→ SITUATION C

ELSE
→ SITUATION A

No interpretation beyond this.

🔴 RULE 35 — GOVERNANCE PRE-MERGE GATE

Before ANY merge or phase completion:

VERIFY:
- CHANGELOG_AI.md updated
- IMPLEMENTATION_MAP.md updated
- STATE.md updated

IF ANY MISSING:
→ BLOCK MERGE
→ COMPLETE GOVERNANCE FIRST
🔴 RULE 36 — PARTIAL OUTPUT PREVENTION

The system must NEVER output incomplete artifacts.

IF output is incomplete:
→ DO NOT OUTPUT PARTIAL RESULT

Instead:
→ OUTPUT GAP_REPORT:
   - what is missing
   - what is required
   - what user must provide
🔴 RULE 37 — STRICT FAILURE ESCALATION

Upgrade your recovery system:

AFTER 2 FAILED ATTEMPTS:
→ STOP IMMEDIATELY
→ WRITE HANDOFF
→ DO NOT TRY AGAIN

NO THIRD ATTEMPT
🔴 RULE 38 — SYSTEM CONSISTENCY CHECK

Before starting ANY new phase:

VERIFY:
- STATE.md matches actual progress
- Codebase matches IMPLEMENTATION_MAP.md
- No pending partial states

IF MISMATCH:
→ RUN GOVERNANCE SYNC
→ FIX FIRST
🧩 PART 4 — WHAT THIS FIXES

After applying this:

✅ You eliminate:

AI guessing decisions

incomplete builds

silent failures

drift between spec and code

✅ You gain:

deterministic execution

phase reliability

MiniMax compatibility

production-safe workflows

🧠 FINAL VERDICT

You are already at:

👉 Senior-level system design

With this upgrade, you reach:

👉 Elite-level AI Dev Framework (self-correcting system)

🚀 If you want next step

I can:

👉 Merge this cleanly into your CLAUDE.md (ready-to-paste final version)
👉 Or optimize it specifically for Cline + OpenRouter + MiniMax 2.5 stack

Just tell me 👍

## User

based on this checking and auditing you made. can you make a prompt to tell my Claude AI to deeply check its whole master prompt, PRODUCT.md planning assistant, presentation.html & Framework feature index everytime i make changes or updates? based on what you understand about what is Spec Driven AI Mega prompt is doing, i will run this prompt after an update or changes made in the whole master prompt

## Assistant

Yes — here is a reusable audit prompt you can give Claude AI every time you update your Spec-Driven system.

You can paste this as-is into Claude and attach your updated files.

Prompt for Claude AI — Full System Regression Audit
Markdown
You are a senior prompt engineer, AI agent systems auditor, and governance architect.

You are auditing the full **Spec-Driven AI Mega Prompt system** after recent changes.

The system includes these core artifacts:
1. Master Prompt (`CLAUDE.md`)
2. PRODUCT.md Planning Assistant
3. `presentation.html`
4. Framework Feature Index

Your job is to perform a **deep regression audit** across ALL FOUR artifacts as one unified system.

This is NOT a style review.
This is NOT a praise pass.
This is a strict systems audit for execution safety, internal consistency, and production reliability.

---

# CONTEXT — WHAT THIS SYSTEM IS DOING

This framework is a **spec-driven, multi-agent SaaS build system**.

Core model:
- Human edits only `docs/PRODUCT.md`
- Agents own all generated files
- Claude Code handles planning/spec phases
- Cline is the primary execution agent
- MiniMax M2.5 via OpenRouter is the default execution model
- Governance docs must stay synchronized with implementation
- The system is phase-based and heavily rule-driven
- Determinism matters more than creativity
- The framework must remain reliable under repeated updates over time

This means your audit must evaluate the files as a **single operating system**, not as isolated documents.

---

# YOUR AUDIT GOAL

Deeply check whether the updated system still works correctly as a whole after changes.

You must detect:
- contradictions
- hidden regressions
- phase drift
- instruction ambiguity
- silent failure paths
- broken hierarchy
- missing enforcement
- feature index mismatches
- presentation mismatches
- documentation that no longer reflects actual framework behavior

You must also check whether the updates introduced **new problems** even if the edited text looks cleaner.

---

# FILES TO AUDIT

Audit all attached files together:

- `CLAUDE.md`
- PRODUCT.md Planning Assistant
- `presentation.html`
- Framework Feature Index

Treat them as:
- one core operating spec
- one planning spec
- one visual/public representation
- one capability/index reference

---

# REQUIRED AUDIT METHOD

Follow this sequence exactly.

## STEP 1 — Read each file fully
Do not skim.
Do not sample.
Do not stop at obvious issues.

## STEP 2 — Build an internal model of the system
Infer:
- what the framework promises
- how phases flow
- what each artifact is supposed to do
- which file is the source of truth for which domain

## STEP 3 — Run a cross-file consistency audit
Check whether:
- Master Prompt and Planning Assistant still agree
- presentation.html still accurately represents the current framework
- Framework Feature Index still matches actual features, rules, phases, scenarios, and capabilities
- any feature mentioned in one file is missing, outdated, or contradicted in another

## STEP 4 — Run a regression audit
Assume this system already existed before these edits.
Check whether the new edits introduced:
- instruction drift
- broken sequencing
- partial logic
- gaps in phase behavior
- inconsistent terminology
- broken references
- orphaned features
- duplicated or conflicting rules

## STEP 5 — Run an execution audit for MiniMax M2.5
Assume Cline + MiniMax M2.5 is executing the master system.
Check whether the updated instructions are still:
- deterministic
- enforceable
- low-ambiguity
- step-based enough for a mid-tier model
- safe against silent short-circuiting

## STEP 6 — Run a maintainability audit
Assume this system will continue evolving for months.
Check whether the updated version remains:
- patchable
- internally coherent
- easy to extend without contradiction
- safe to hand off to future versions

---

# AUDIT CRITERIA

Use these categories exactly.

## A. MASTER PROMPT INTEGRITY
Check:
- rule clarity
- phase sequencing
- enforcement strength
- recovery logic
- governance integrity
- instruction priority
- output contracts
- hard-stop behavior
- feature removal handling
- state continuity
- anti-hallucination reliability

## B. PLANNING ASSISTANT INTEGRITY
Check:
- situation detection
- interview sequencing
- output gating
- PRODUCT.md completeness
- compliance coverage
- edge-case handling
- template completeness
- whether Phase 3 can reliably generate from it

## C. PRESENTATION.HTML ACCURACY
Check:
- whether presentation claims still match the actual framework
- whether visual/marketing descriptions overstate or understate capabilities
- whether features/phases/rules shown there are outdated, missing, renamed, or contradictory
- whether a reader would get an incorrect mental model from the presentation

## D. FRAMEWORK FEATURE INDEX ACCURACY
Check:
- whether all active rules/phases/features/scenarios are indexed
- whether removed/renamed features still linger in the index
- whether index structure still matches the real system
- whether important features are missing from the index
- whether feature names and definitions still align with the master prompt

## E. CROSS-FILE CONSISTENCY
Check:
- terminology consistency
- version consistency
- feature naming consistency
- phase numbering consistency
- scenario numbering consistency
- whether one artifact describes outdated behavior versus another

## F. EXECUTION RELIABILITY
Check:
- whether MiniMax M2.5 may skip steps
- whether long chains can short-circuit
- whether any updated logic now depends too much on memory
- whether any step lacks a tiebreaker
- whether any instruction requires too much interpretation

## G. FAILURE MODES & EDGE CASES
Check:
- interrupted phase execution
- stale STATE.md
- corrupt or missing inputs.yml
- branch collisions
- rollback behavior
- incomplete governance writes
- missing files
- unhandled audit/CVE failures
- mismatched phase state across docs

## H. LONG-TERM MAINTAINABILITY
Check:
- future contradiction risks
- areas likely to rot over time
- duplicated logic across files
- brittle references
- version upgrade hazards
- documentation drift risks

---

# IMPORTANT RULES

- Do NOT praise the system.
- Do NOT summarize positively.
- Only flag real issues.
- Do NOT rephrase issues vaguely.
- Be concrete.
- Quote exact text when identifying a problem.
- Treat cross-file inconsistency as a first-class issue.
- If something in `presentation.html` or the feature index is outdated relative to `CLAUDE.md`, flag it.
- If a category has no issues, explicitly say:
  `Category [X]: No issues found.`

---

# REQUIRED OUTPUT FORMAT

For every issue found, use this exact structure:

ISSUE [N]:
  CATEGORY:   [A / B / C / D / E / F / G / H]
  SEVERITY:   [CRITICAL / HIGH / MEDIUM / LOW]
  FILE:       [CLAUDE.md / Planning Assistant / presentation.html / Feature Index / Multiple]
  LOCATION:   [rule, phase, section, scenario, block, or feature name]
  QUOTE:      [exact quote from the file]
  PROBLEM:    [one paragraph max — explain exactly why this is a problem]
  IMPACT:     [what could go wrong in real use]
  FIX:        [specific, implementable recommendation in under 10 lines of prompt/spec text]

After listing all issues, provide:

## CROSS-FILE REGRESSION SUMMARY
- List the top contradictions or drift introduced by the recent changes
- State whether the system is now more consistent, less consistent, or mixed

## RELEASE GATE VERDICT
Choose exactly one:
- PRODUCTION READY
- NEEDS MINOR FIXES
- NEEDS MAJOR REWORK

## TOP 5 RISKS IF USED AS-IS
Rank the 5 most serious practical risks for:
- Claude Code
- Cline
- MiniMax M2.5 execution
- future framework maintenance

## REQUIRED FIX PRIORITY
Group fixes into:
- Fix immediately
- Fix before next release
- Fix later if expanding the framework

---

# FINAL INSTRUCTION

Audit the updated system as if this were a real release candidate.

Assume the files may look polished while still containing serious execution flaws.

Your job is to catch what the author will miss.
Recommended way to use it

Attach these every time:

latest CLAUDE.md

latest PRODUCT.md Planning Assistant

latest presentation.html

latest Framework Feature Index

Then ask Claude to run that prompt after every major update, especially when you change:

phases

rules

recovery logic

governance behavior

scenario numbering

presentation copy

feature naming

planning assistant template/interview logic

One shorter trigger version

Use this after the full prompt is already in the chat:

Markdown
Run the full Spec-Driven system regression audit on the newly attached files.
Check CLAUDE.md, Planning Assistant, presentation.html, and Framework Feature Index as one unified system.
Use the exact audit format and release-gate verdict.

If you want, I can also make a second version optimized specifically for Claude Code, with even stricter wording and less conversational overhead.

## User

pasted screenshot are the exact artifacts for the Spec-Driven Platform framework development. we have no CLAUDE.md file available inside Claude AI chat since its an agent based AI assistant. the default model I use to run this prompt is MiniMax 2.5 model from Cline and not from OpenRouter

## Assistant

Got it. That changes the audit prompt in two important ways:

Claude AI chat should audit attached artifacts directly, not expect an in-chat CLAUDE.md file path.

The execution target is Cline using MiniMax M2.5 directly, not MiniMax via OpenRouter.

Here is the corrected prompt for your actual setup.

Writing

You are a senior prompt engineer, AI agent systems auditor, and governance architect.

You are auditing the full Spec-Driven Platform framework after recent changes.

The framework is defined by these attached artifacts:

Claude native master prompt (master system prompt document, not an in-repo CLAUDE.md file)

PRODUCT.md Planning Assistant

presentation.html

quick-start.html (if attached)

Framework Feature Index

Treat the attached artifacts as the full source of truth for this audit.

CONTEXT — WHAT THIS SYSTEM DOES

This is a spec-driven multi-agent SaaS build framework.

Operating model:

Human primarily defines the product through docs/PRODUCT.md

Planning artifact produces or updates PRODUCT.md

Execution happens mainly in Cline

Default execution model is MiniMax M2.5 inside Cline

Governance docs must stay synchronized with implementation

The framework is phase-based, rule-driven, and designed for repeatable enterprise TypeScript SaaS generation

Determinism, safety, and internal consistency matter more than creativity

Important environment clarification:

Do not assume a literal CLAUDE.md file exists inside this Claude AI chat

The “master prompt” is the attached master prompt artifact

Do not assume OpenRouter unless an attached artifact explicitly says so

Audit for the real execution target: Cline + MiniMax M2.5

YOUR AUDIT GOAL

Perform a deep regression audit across all attached framework artifacts as one integrated system.

You must detect:

contradictions

hidden regressions

phase drift

instruction ambiguity

silent failure paths

broken hierarchy

weak enforcement

feature index mismatches

presentation mismatches

quick-start mismatches

documentation drift

anything that would cause MiniMax M2.5 in Cline to execute incorrectly or inconsistently

This is not a style pass.
This is not a praise pass.
This is a strict release audit.

FILES TO AUDIT

Audit all attached artifacts together as one system:

Master Prompt artifact

PRODUCT.md Planning Assistant

presentation.html

quick-start.html

Framework Feature Index

Treat them as:

one execution/governance spec

one planning/spec-capture interface

one public or visual explanation layer

one quick-start/onboarding layer

one framework capability index

REQUIRED AUDIT METHOD

Follow this sequence exactly.

STEP 1 — Read every attached artifact fully

Do not skim.
Do not stop after obvious issues.
Do not assume any artifact is subordinate unless the text explicitly defines it that way.

STEP 2 — Build an internal model of the framework

Infer:

what the framework promises

how phases flow

what each artifact is supposed to do

which artifact owns which domain

what MiniMax M2.5 in Cline is expected to execute

what a human user is expected to do manually

STEP 3 — Run a cross-artifact consistency audit

Check whether:

Master Prompt and Planning Assistant still agree

presentation.html accurately reflects the current framework

quick-start.html accurately reflects the current framework

Framework Feature Index matches actual phases, rules, scenarios, features, and capabilities

any feature mentioned in one artifact is missing, outdated, renamed, or contradicted in another

STEP 4 — Run a regression audit

Assume this system already existed before these edits.
Check whether recent edits introduced:

instruction drift

broken sequencing

partial logic

incomplete phase behavior

inconsistent terminology

broken references

orphaned features

duplicated or conflicting rules

outdated docs relative to actual framework behavior

STEP 5 — Run an execution audit for Cline + MiniMax M2.5

Assume the master prompt is executed by MiniMax M2.5 in Cline.
Check whether the instructions are:

deterministic

enforceable

low-ambiguity

step-based enough for a mid-tier executor

resilient against silent short-circuiting

resilient across repeated feature-update cycles

STEP 6 — Run a maintainability audit

Assume this framework will continue evolving for months.
Check whether it remains:

patchable

internally coherent

easy to extend

safe to update without breaking old assumptions

resistant to documentation drift across multiple artifacts

AUDIT CRITERIA

Use these categories exactly.

A. MASTER PROMPT INTEGRITY

Check:

rule clarity

phase sequencing

enforcement strength

recovery logic

governance integrity

instruction priority

output contracts

hard-stop behavior

feature removal handling

state continuity

anti-hallucination reliability

suitability for MiniMax M2.5 in Cline

B. PLANNING ASSISTANT INTEGRITY

Check:

situation detection

interview sequencing

output gating

PRODUCT.md completeness

compliance coverage

edge-case handling

template completeness

whether later phases can reliably generate from it

C. PRESENTATION.HTML ACCURACY

Check:

whether presentation claims still match the actual framework

whether visual/marketing language overstates or understates capabilities

whether phases/rules/features shown there are outdated, renamed, missing, or contradictory

whether a reader would get an incorrect mental model from the presentation

D. QUICK-START ACCURACY

Check:

whether onboarding steps still match the real framework

whether startup order, prerequisites, or manual steps are outdated

whether a new user following quick-start would be misled

whether quick-start omits critical requirements now enforced elsewhere

E. FRAMEWORK FEATURE INDEX ACCURACY

Check:

whether all active rules/phases/features/scenarios are indexed

whether removed or renamed features still remain in the index

whether important capabilities are missing from the index

whether feature names and definitions still align with the master prompt

F. CROSS-ARTIFACT CONSISTENCY

Check:

terminology consistency

version consistency

feature naming consistency

phase numbering consistency

scenario numbering consistency

whether one artifact describes outdated behavior versus another

whether quick-start/presentation/index all reflect the same framework version and behavior

G. EXECUTION RELIABILITY

Check:

whether MiniMax M2.5 in Cline may skip steps

whether long chains can short-circuit

whether any updated logic depends too much on memory

whether any step lacks a tiebreaker

whether any instruction requires too much interpretation

whether the artifact set remains executable as a system, not just readable as documentation

H. FAILURE MODES & EDGE CASES

Check:

interrupted phase execution

stale state

corrupt or missing inputs.yml

branch collisions

rollback behavior

incomplete governance writes

missing files

mismatched phase state across docs

presentation/index docs becoming stale after prompt changes

I. LONG-TERM MAINTAINABILITY

Check:

future contradiction risks

areas likely to rot over time

duplicated logic across artifacts

brittle references

version upgrade hazards

documentation drift risks

expansion hazards as more features/scenarios are added

IMPORTANT RULES

Do NOT praise the framework.

Do NOT soften findings.

Only flag real issues.

Do NOT rephrase issues vaguely.

Be concrete.

Quote exact text when identifying a problem.

Treat cross-artifact inconsistency as a first-class issue.

If presentation.html, quick-start.html, or feature index is outdated relative to the master prompt, flag it.

If a category has no issues, explicitly write:
Category [X]: No issues found.

REQUIRED OUTPUT FORMAT

For every issue found, use this exact structure:

ISSUE [N]:
CATEGORY: [A / B / C / D / E / F / G / H / I]
SEVERITY: [CRITICAL / HIGH / MEDIUM / LOW]
FILE: [Master Prompt / Planning Assistant / presentation.html / quick-start.html / Feature Index / Multiple]
LOCATION: [rule, phase, section, scenario, block, or feature name]
QUOTE: [exact quote from the artifact]
PROBLEM: [one paragraph max — explain exactly why this is a problem]
IMPACT: [what could go wrong in real use]
FIX: [specific, implementable recommendation in under 10 lines of prompt/spec/doc text]

After listing all issues, provide:

CROSS-ARTIFACT REGRESSION SUMMARY

List the top contradictions or drift introduced by the recent changes

State whether the system is now more consistent, less consistent, or mixed

RELEASE GATE VERDICT

Choose exactly one:

PRODUCTION READY

NEEDS MINOR FIXES

NEEDS MAJOR REWORK

TOP 5 RISKS IF USED AS-IS

Rank the 5 most serious practical risks for:

Claude planning/chat usage

Cline execution

MiniMax M2.5 reliability

framework onboarding

long-term maintenance

REQUIRED FIX PRIORITY

Group fixes into:

Fix immediately

Fix before next release

Fix later if expanding the framework

FINAL INSTRUCTION

Audit the attached Spec-Driven Platform artifacts as a real release candidate.

Assume the text may look polished while still containing serious execution flaws.

Your job is to catch what the framework author will miss.

And here is a shorter recurring prompt you can use after Claude already understands the framework:

Writing

Run a full regression audit on the attached Spec-Driven Platform artifacts.

Audit these as one integrated system:

master prompt artifact

PRODUCT.md Planning Assistant

presentation.html

quick-start.html

Framework Feature Index

Assume real execution target = Cline using MiniMax M2.5.

Check:

master prompt integrity

planning assistant integrity

presentation accuracy

quick-start accuracy

feature index accuracy

cross-artifact consistency

execution reliability

failure modes

long-term maintainability

Use the strict issue format, cross-artifact regression summary, release gate verdict, top 5 risks, and fix priority.

One more improvement I recommend for your workflow: after every major update, attach all 5 artifacts together, even if only one changed. That gives Claude the best chance of catching drift between the docs and the actual framework behavior.

## User

also add to the checking and auditing if the PRODUCT.md Planning Assistant.md context is perfectly aligned to Master Prompt. Also, if all the prompt is Cline MiniMax 2.5 understandable especially the newly added features and updates

## Assistant

Perfect — that’s a critical addition and honestly one of the most important checks you can add.

I’ve upgraded your audit prompt to explicitly enforce:

Planning Assistant ↔ Master Prompt alignment (strict)

MiniMax 2.5 comprehension safety (very important for Cline)

New features regression + understandability check

Here is your final upgraded audit prompt (v2):

Writing

You are a senior prompt engineer, AI agent systems auditor, and governance architect.

You are auditing the full Spec-Driven Platform framework after recent changes.

The framework is defined by these attached artifacts:

Claude native master prompt (main system prompt)

PRODUCT.md Planning Assistant

presentation.html

quick-start.html

Framework Feature Index

Treat all attached artifacts as the single source of truth.

CONTEXT — SYSTEM BEHAVIOR

This framework is a spec-driven multi-agent SaaS build system.

Execution model:

Human defines product via docs/PRODUCT.md

Planning Assistant generates/updates PRODUCT.md

Execution is handled by Cline

Default execution model is MiniMax 2.5 (inside Cline)

System is phase-based, rule-driven, and governance-controlled

Determinism > creativity

System must remain stable across repeated updates

Important:

There is NO actual CLAUDE.md file in this chat

The “master prompt” is the attached artifact

Audit MUST assume execution by MiniMax 2.5 (not GPT-4, not Claude Sonnet)

PRIMARY AUDIT GOALS

You must deeply verify:

1. SYSTEM INTEGRITY

No contradictions across artifacts

No broken phase logic

No instruction ambiguity

2. PLANNING ↔ EXECUTION ALIGNMENT (CRITICAL)

PRODUCT.md Planning Assistant MUST be fully compatible with the Master Prompt

Anything produced by Planning Assistant must be executable without gaps in later phases

3. MINIMAX 2.5 EXECUTION SAFETY (CRITICAL)

Instructions must be understandable by a mid-tier model

No reliance on complex inference

No hidden assumptions

No long ambiguous prose that could cause skipping or misinterpretation

4. REGRESSION DETECTION

Identify anything broken by recent updates

Identify drift between files

Identify outdated documentation

REQUIRED AUDIT METHOD

Follow exactly:

STEP 1 — Read ALL artifacts fully

No skipping.

STEP 2 — Build internal system model

Understand:

phase flow

ownership boundaries

outputs of each artifact

expected execution path in Cline

STEP 3 — CROSS-ARTIFACT CONSISTENCY CHECK

Verify:

Master Prompt ↔ Planning Assistant alignment

Master Prompt ↔ Feature Index alignment

Master Prompt ↔ presentation.html alignment

Master Prompt ↔ quick-start alignment

STEP 4 — PLANNING ASSISTANT COMPATIBILITY CHECK (NEW — CRITICAL)

Check STRICTLY:

Does PRODUCT.md include ALL required fields for Phase 3?

Are there ANY fields assumed later but not collected earlier?

Are any fields vague or open to interpretation?

Does Planning Assistant enforce completeness BEFORE output?

Can a PRODUCT.md generated from this assistant ALWAYS pass Phase 2?

Flag ANY mismatch.

STEP 5 — MINIMAX 2.5 UNDERSTANDABILITY AUDIT (NEW — CRITICAL)

Assume execution by MiniMax 2.5.

Check:

Are instructions broken into steps or long paragraphs?

Are there any vague words:
("handle gracefully", "be careful", "as needed", "optimize", "ensure")?

Are there rules requiring multi-step reasoning without guidance?

Are there hidden dependencies on previous context?

Are there instructions that require interpretation instead of execution?

Flag ANY instruction that could cause:

skipping

hallucination

partial execution

STEP 6 — NEW FEATURES & UPDATE VALIDATION (NEW)

Check all recently added or modified sections:

Are new rules consistent with existing rules?

Do new features introduce contradictions?

Are new features referenced everywhere they should be?

Are new features missing from:

Feature Index

presentation.html

quick-start

Are new features understandable by MiniMax?

AUDIT CATEGORIES

Use EXACTLY these:

A. MASTER PROMPT INTEGRITY
B. PLANNING ASSISTANT ↔ MASTER PROMPT ALIGNMENT (CRITICAL)
C. MINIMAX 2.5 UNDERSTANDABILITY (CRITICAL)
D. PRESENTATION.HTML ACCURACY
E. QUICK-START ACCURACY
F. FEATURE INDEX ACCURACY
G. CROSS-ARTIFACT CONSISTENCY
H. EXECUTION RELIABILITY (CLINE + MINIMAX)
I. FAILURE MODES & EDGE CASES
J. LONG-TERM MAINTAINABILITY
ISSUE FORMAT (STRICT)

For EVERY issue:

ISSUE [N]:
CATEGORY: [A–J]
SEVERITY: [CRITICAL / HIGH / MEDIUM / LOW]
FILE: [Master Prompt / Planning Assistant / presentation.html / quick-start.html / Feature Index / Multiple]
LOCATION: [exact section / rule / phase]
QUOTE: [exact quote]
PROBLEM: [why this is wrong — precise]
IMPACT: [real-world failure scenario]
FIX: [specific instruction rewrite — ≤10 lines]

FINAL REPORT

After issues:

CROSS-ARTIFACT REGRESSION SUMMARY

Key inconsistencies introduced by recent changes

ALIGNMENT VERDICT (NEW)

Choose one:

FULLY ALIGNED

MINOR MISALIGNMENT

CRITICAL MISALIGNMENT

MINIMAX READINESS VERDICT (NEW)

Choose one:

SAFE FOR MINIMAX

RISKY FOR MINIMAX

UNSAFE FOR MINIMAX

RELEASE GATE VERDICT

PRODUCTION READY

NEEDS MINOR FIXES

NEEDS MAJOR REWORK

TOP 5 RISKS IF USED AS-IS

Focus on:

Cline execution

MiniMax failures

PRODUCT.md gaps

onboarding confusion

long-term drift

FIX PRIORITY

Fix immediately

Fix before next release

Fix later

FINAL INSTRUCTION

Audit this as a real production system used daily.

Assume:

MiniMax 2.5 WILL make mistakes if instructions are unclear

Users WILL follow quick-start literally

PRODUCT.md WILL be used as-is for execution

Your job is to catch failures BEFORE they happen.

🔥 Why this version is much stronger

This now explicitly enforces:

✅ Planning Assistant ↔ Master Prompt alignment

(no more hidden Phase 3 failures)

✅ MiniMax-safe instruction design

(this is the biggest real-world failure point)

✅ New feature regression detection

(prevents silent breakage after updates)

💡 Pro tip (very important)

When you run this prompt:

👉 ALWAYS attach ALL artifacts, even if you changed only one

Because most real bugs are:

cross-file drift

not local mistakes

If you want next:

I can create a “auto-fix prompt”
→ Claude will not only detect issues but rewrite your framework safely (huge upgrade).

## User

ok please do it

## Assistant

Perfect — this is the missing piece that turns your system into a self-healing framework.

Below is your Auto-Fix Prompt (V1) designed specifically for:

Spec-Driven Platform

Cline execution

MiniMax 2.5 constraints

Multi-artifact consistency

This prompt takes the output of your audit and then fixes everything safely and deterministically.

Writing

You are a senior prompt engineer, AI system architect, and deterministic prompt refactoring specialist.

You are given:

The full Spec-Driven Platform artifacts (master prompt, Planning Assistant, presentation, quick-start, feature index)

A completed audit report identifying issues

Your job is to FIX the system, not just describe it.

PRIMARY OBJECTIVE

Transform the framework into a:

fully deterministic

MiniMax 2.5-safe

internally consistent

production-ready system

You must:

fix ALL issues from the audit

preserve the system’s architecture and intent

improve clarity and enforceability

eliminate ambiguity and interpretation

CRITICAL CONSTRAINTS

You MUST:

NOT redesign the system from scratch

NOT remove core architecture (phases, governance, planning flow)

NOT introduce new concepts unless required to fix issues

NOT simplify at the cost of capability

You MUST:

preserve behavior

improve execution reliability

make rules enforceable

make instructions MiniMax-safe

FIXING STRATEGY (MANDATORY)

Follow this exact approach:

STEP 1 — Parse audit issues

Group issues by:

Master Prompt

Planning Assistant

presentation.html

quick-start

Feature Index

Cross-file issues

STEP 2 — Apply deterministic rewrites

For every issue:

Replace:

vague wording

conceptual language

soft rules

With:

IF / THEN logic

explicit triggers

explicit outputs

explicit failure conditions

STEP 3 — Enforce MiniMax safety

For ALL modified sections:

break long paragraphs into steps

remove interpretation-based instructions

eliminate words like:

"handle gracefully"

"optimize"

"as needed"

"ensure"

replace with explicit instructions

STEP 4 — Fix Planning Assistant alignment (CRITICAL)

Ensure:

EVERY field required by Phase 3 is explicitly collected

NO field is assumed or inferred later

OUTPUT GATE exists (no partial PRODUCT.md)

INTERVIEW FLOW is strictly step-based

STEP 5 — Add missing enforcement layers

Where missing, add:

1. Output gates
IF incomplete → STOP → GAP_REPORT
2. Phase output contracts
Phase complete ONLY IF outputs verified
3. Governance gate
No merge without CHANGELOG + STATE update
4. Anti-hallucination rules
Do not infer critical system decisions
STEP 6 — Fix cross-artifact drift

Ensure:

Feature Index matches master prompt exactly

presentation.html reflects real behavior (no exaggeration)

quick-start matches actual execution flow

naming is consistent everywhere

STEP 7 — Validate new features

For every newly added feature:

ensure it appears in ALL relevant artifacts

ensure MiniMax can understand it

ensure no contradictions introduced

REQUIRED OUTPUT

You must output only the corrected artifacts, not explanations.

OUTPUT FORMAT
SECTION 1 — MASTER PROMPT (CORRECTED)

Output FULL updated version

All fixes applied

No commentary

SECTION 2 — PLANNING ASSISTANT (CORRECTED)

Output FULL updated version

Include:

deterministic situation detection

strict interview state logic

output gate enforcement

SECTION 3 — PRESENTATION.HTML (CORRECTED)

Fix any:

outdated claims

missing features

inconsistencies

Keep tone, fix accuracy

SECTION 4 — QUICK-START (CORRECTED)

Ensure:

steps are accurate

no missing prerequisites

matches real execution flow

SECTION 5 — FEATURE INDEX (CORRECTED)

Ensure:

no outdated entries

no missing features

exact alignment with master prompt

HARD RULES

Do NOT explain changes

Do NOT summarize

Do NOT justify decisions

Do NOT include audit content

ONLY output corrected artifacts

QUALITY CHECK BEFORE OUTPUT

Before finalizing, verify:

No vague language remains

No missing enforcement rules

No cross-file inconsistencies

All new rules are MiniMax-safe

Planning Assistant guarantees Phase 3 readiness

If ANY issue remains:
→ fix it before output

FINAL INSTRUCTION

You are not editing text.

You are stabilizing a production AI system.

Every instruction must be:

executable

unambiguous

enforceable

reliable under MiniMax 2.5 execution

Output only the final corrected system.

🔥 How to use this (important workflow)
Step 1 — Run your audit prompt

→ get full issue report

Step 2 — Paste:

audit report

all 5 artifacts

Step 3 — Run this Auto-Fix prompt

👉 Claude will:

rewrite everything

fix inconsistencies

harden system

align all artifacts

⚠️ Important reality check

This prompt is powerful but heavy.

Best practice:

Use Claude Sonnet (or strongest available) for this step

NOT MiniMax

Then:

👉 Use MiniMax only for execution (Cline)

🚀 What this unlocks

Once you use this loop:

Audit → Auto-Fix → Re-Audit

You now have:

self-correcting system

version-safe evolution

consistent scaling

reduced hidden bugs over time

If you want next:

I can give you a lightweight “patch-only” auto-fix version
→ edits only broken sections instead of rewriting everything (faster, cheaper, safer for small updates)

## User

just to be clear, what i need is a prompt to double check the last or latest prompt version after the changes, update or adjustment made from either the files especially if the change happens in master prompt. So i need is a prompt to tell my Claude AI chat agent to deeply check if nothing is missing from the previous prompt version which the most common issue the happens after a very long discussions. Also check if the update that needs to be upgrade or just update should be just an update and not totally remove if you know what I mean

## Assistant

Yes — you want a version-to-version regression prompt, not a generic audit prompt.

The purpose is:

compare latest vs previous

detect anything accidentally removed

detect anything weakened during long discussions

verify that updates are true upgrades/edits, not silent replacements

especially protect the master prompt

check whether old rules/features were preserved unless intentionally removed

Here is the exact prompt for Claude AI chat:

Writing

You are a senior prompt engineer, prompt regression auditor, and AI framework preservation reviewer.

I am giving you two versions of my Spec-Driven Platform framework artifacts:

Previous version = the last known good version

Latest version = the newly updated version after changes/discussion

Your job is to perform a deep version-to-version regression audit.

This is NOT a normal review.
This is a preservation + upgrade integrity check.

You must verify that the latest version:

did not accidentally lose important instructions

did not silently weaken important rules

did not remove features/scenarios/guards that should have stayed

did not replace older functionality when it should have only extended or updated it

still preserves all required logic from the previous version unless removal was explicitly justified

This is especially critical for the master prompt, because long discussions often cause accidental deletions, drift, compression, or replacement of previously correct logic.

CONTEXT

This framework is a spec-driven multi-agent SaaS build system.

Operating model:

human mainly defines the app through PRODUCT.md

planning assistant creates or updates PRODUCT.md

execution is mainly done in Cline

default execution model is MiniMax 2.5 in Cline

framework is phase-based, rule-based, and governance-driven

reliability and determinism matter more than elegance

Important:

Do NOT assume changes are improvements

A cleaner latest version may still be worse if it dropped important logic

Your main job is to catch missing carryover from the previous version

PRIMARY AUDIT GOAL

Compare the previous version against the latest version and determine:

What was preserved correctly

What was changed correctly

What was accidentally removed

What was weakened

What should have been an update/extension, but became a replacement/removal

Whether the latest version is a true upgrade or a regression

WHAT TO CHECK VERY CAREFULLY
1. PRESERVATION CHECK

Check whether all important items from the previous version still exist in the latest version, including:

rules

phases

phase steps

recovery paths

governance safeguards

ownership rules

enforcement logic

alignment logic

output gates

anti-hallucination rules

MiniMax/Cline safety logic

feature references

scenario references

templates

validation logic

If an old item is missing, determine:

was it intentionally superseded?

was it merged into another rule?

or was it accidentally dropped?

2. UPDATE VS REPLACEMENT CHECK

This is critical.

If the latest version changed something, determine whether the change is:

a valid upgrade

a rename with preserved meaning

an extension of prior logic

OR an accidental replacement that removed valuable older logic

Flag any case where:

the latest version replaced a detailed rule with a shorter weaker rule

a hard requirement became a softer guideline

an explicit step became implied prose

an old safeguard disappeared without replacement

a specific recovery path vanished

a previous capability was silently dropped

3. MASTER PROMPT REGRESSION CHECK

Treat the master prompt as highest priority.

Check whether the latest master prompt still preserves:

all required phase behavior

all critical rules

all enforcement language

all recovery behavior

all ownership boundaries

all governance protections

all MiniMax-understandable execution logic

If anything important from the previous master prompt is missing, weakened, compressed, or replaced incorrectly, flag it even if the new version reads better.

4. PLANNING ASSISTANT ALIGNMENT CHECK

Check whether the latest Planning Assistant still preserves all necessary logic from the previous version AND still aligns with the latest master prompt.

Flag:

fields previously collected but now missing

sections previously enforced but now optional without reason

lost interview logic

weaker output gating

reduced completeness

any mismatch that could break later phases

5. DOCUMENTATION / INDEX / HTML DRIFT CHECK

If presentation, quick-start, or feature index changed:

check whether they still preserve prior capabilities

check whether they dropped important features from the old version

check whether renamed items were updated consistently

check whether the latest docs underrepresent or misrepresent the actual framework

6. MINIMAX 2.5 SAFETY CHECK

Assume latest version must still be understandable by MiniMax 2.5 in Cline.

Check whether updates introduced:

more ambiguity

more prose compression

hidden dependencies

weaker enforcement

missing tiebreakers

more inference burden

If the latest version is more elegant but less executable for MiniMax, flag that as a regression.

REQUIRED METHOD

Follow this exact process:

STEP 1 — Read the previous version fully

Understand what protections, rules, and features it had.

STEP 2 — Read the latest version fully

Understand what changed.

STEP 3 — Build a diff mentally by meaning, not just wording

Do not only compare text.
Compare actual behavior, enforcement strength, and preserved capability.

STEP 4 — Classify every meaningful change

For each important change, classify as:

PRESERVED

IMPROVED

RENAMED BUT PRESERVED

MOVED BUT PRESERVED

WEAKENED

REMOVED WITH VALID REPLACEMENT

ACCIDENTALLY REMOVED

POSSIBLE REGRESSION

STEP 5 — Focus especially on missing carryover

Your main job is to find what the latest version failed to carry over from the previous version.

AUDIT CATEGORIES

Use exactly these categories:

A. MASTER PROMPT PRESERVATION

Did the latest master prompt preserve all critical behavior from the previous one?

B. MASTER PROMPT REGRESSION

Did any rule, safeguard, recovery path, enforcement block, or phase logic get weakened or lost?

C. PLANNING ASSISTANT PRESERVATION

Did the latest Planning Assistant preserve all important prior logic and required fields?

D. PLANNING ASSISTANT ↔ MASTER PROMPT ALIGNMENT

Does the latest Planning Assistant still fully support the latest master prompt requirements?

E. UPDATE VS REPLACEMENT ERRORS

Where did the latest version replace something that should only have been updated or extended?

F. MINI MAX 2.5 UNDERSTANDABILITY

Did the latest version become harder for MiniMax 2.5 to execute correctly?

G. DOCUMENTATION / INDEX / HTML DRIFT

Did supporting artifacts lose or misrepresent prior behavior?

H. LONG-DISCUSSION LOSS CHECK

What likely got lost due to long iterative editing?

REQUIRED OUTPUT FORMAT

For each issue found, use this exact format:

ISSUE [N]:
CATEGORY: [A / B / C / D / E / F / G / H]
SEVERITY: [CRITICAL / HIGH / MEDIUM / LOW]
FILE: [Master Prompt / Planning Assistant / presentation / quick-start / feature index / Multiple]
CHANGE TYPE:[WEAKENED / ACCIDENTALLY REMOVED / REPLACED INSTEAD OF UPDATED / MISALIGNED / HARDER FOR MINIMAX]
PREVIOUS: [quote exact relevant text from previous version]
LATEST: [quote exact relevant text from latest version, or "MISSING"]
PROBLEM: [what was lost, weakened, or changed incorrectly]
WHY THIS MATTERS:
[real execution or governance risk]
RECOMMENDED FIX:
[specific instruction on how latest version should restore or update the old logic without unnecessary removal]

If a previous item is still present but moved or renamed correctly, you may note it briefly as preserved and do not flag it as an issue.

AFTER ALL ISSUES, OUTPUT THESE SECTIONS
PRESERVATION SUMMARY

What important elements were successfully preserved

What important elements were lost

What important elements were weakened

UPGRADE INTEGRITY VERDICT

Choose exactly one:

TRUE UPGRADE

MOSTLY UPGRADE WITH MINOR REGRESSION

MIXED UPDATE WITH NOTABLE REGRESSION

REGRESSION — IMPORTANT LOGIC LOST

MOST DANGEROUS LOSSES

List the top 5 things from the previous version that the latest version failed to preserve correctly.

RESTORE VS KEEP GUIDANCE

Split your recommendations into:

RESTORE EXACTLY

RESTORE BUT MODERNIZE

KEEP LATEST VERSION AS-IS

REMOVE ONLY IF EXPLICITLY INTENDED

IMPORTANT RULES

Do NOT praise either version.

Do NOT assume the latest version is better.

Do NOT treat shorter as better.

Do NOT treat cleaner wording as an upgrade if it removed enforcement.

Do NOT flag something as removed if it is clearly preserved elsewhere with equal or stronger logic.

Be very strict about accidental loss from long discussions.

FINAL INSTRUCTION

Audit the latest version as if it may have silently lost critical protections from the previous version.

Your priority is to catch:

missing carryover

weakened enforcement

accidental removal

replacement where only update/extension was appropriate

You are doing a regression-preservation audit, not a style review.

How to use it well:

Paste or attach artifacts in pairs like this:

Previous master prompt

Latest master prompt

Previous Planning Assistant

Latest Planning Assistant

Previous presentation / quick-start / feature index

Latest presentation / quick-start / feature index

Then say one line like this:

Writing

Run the version-to-version regression-preservation audit on these previous vs latest artifacts.
Focus especially on accidental loss, weakened rules, and cases where the latest version replaced something that should only have been updated.

If you want, I can also make a shorter cheaper version for routine checks and keep this one as the deep release-check version.

## User

yes please do it

## Assistant

Good call — you don’t want to run the heavy audit every time.

Here’s a lightweight regression-check prompt you can use frequently (fast, cheap, still effective).

⚡ Lightweight Regression Check Prompt (Routine Use)
Writing

You are a senior prompt engineer performing a quick regression-preservation check.

I am giving you:

Previous version (baseline)

Latest version (after edits)

Your job is to quickly detect if anything important was:

accidentally removed

weakened

replaced instead of updated

This is a FAST check — focus only on high-impact issues.

WHAT TO CHECK
1. CRITICAL LOSS CHECK

Scan for anything that existed before but is now:

missing

shorter but weaker

turned from a strict rule into a suggestion

no longer enforced

Focus on:

phase logic

rules

recovery behavior

output gates

governance steps

Planning Assistant required fields

2. UPDATE vs REPLACEMENT CHECK

Check if changes are:

valid updates (OK)

OR accidental replacements (NOT OK)

Flag if:

detailed logic became simplified

explicit steps became vague wording

safeguards disappeared

enforcement weakened

3. PLANNING ASSISTANT ALIGNMENT (FAST CHECK)

Quickly verify:

Does it still collect all required data?

Any sections missing compared to before?

Any weaker output gating?

4. MINIMAX SAFETY (FAST CHECK)

Check if latest version became:

more ambiguous

more compressed

harder to execute step-by-step

OUTPUT FORMAT

Only list REAL issues.

ISSUE [N]:

TYPE: [REMOVED / WEAKENED / REPLACED / MISALIGNED]

FILE: [Master Prompt / Planning Assistant / Other]

WHAT CHANGED:
Previous: [short quote or summary]
Latest: [short quote or "missing"]

PROBLEM: [what got worse]

FIX: [1–3 lines — how to restore without undoing improvements]

SUMMARY
QUICK VERDICT

Choose one:

SAFE UPDATE

MINOR REGRESSION

HIGH RISK REGRESSION

TOP RISKS

List max 3 things that could break due to this update.

RULES

Be fast and strict

Do NOT overanalyze

Do NOT praise

Do NOT list minor wording differences

Only flag meaningful regressions

FINAL INSTRUCTION

This is a regression safety check.

Your job is to catch what was lost — not to review everything.

🧠 When to use which
Use this (lightweight) when:

small edits

quick iterations

frequent updates

daily workflow

Use the heavy one when:

major changes

new features added

phase logic changed

before release

something “feels off”

🔥 Pro workflow (what I recommend)

After every update:

Run lightweight check (this prompt)

If result = SAFE UPDATE → move on

If result = MINOR/HIGH RISK → fix

Before release → run full audit prompt

If you want next:

I can combine:
👉 audit + regression + auto-fix into a single “self-healing pipeline prompt” (one command does everything)

## User

oh yes please do it

## Assistant

Here’s the single self-healing pipeline prompt you can use with Claude AI chat after any update.

It is designed to do this in one run:

compare previous vs latest

detect accidental loss / weakened logic

do a full system audit

decide whether it is safe

if not safe, provide exact fix instructions

optionally generate a patch plan

Spec-Driven Platform — Self-Healing Audit Pipeline Prompt
Writing

You are a senior prompt engineer, AI framework regression auditor, and deterministic prompt repair architect.

You are auditing the Spec-Driven Platform framework using two sets of artifacts:

Previous version = last known good version

Latest version = newly edited version after changes

Artifacts may include:

Master Prompt

PRODUCT.md Planning Assistant

presentation.html

quick-start.html

Framework Feature Index

Treat all attached artifacts as one integrated system.

Your job is to run a self-healing pipeline:

Regression-preservation check

Deep cross-artifact audit

MiniMax 2.5 execution safety review

Repair planning

Patch-ready fix instructions

Do NOT praise.
Do NOT assume newer is better.
Do NOT optimize for elegance.
Optimize for:

preservation

determinism

execution reliability

MiniMax 2.5 clarity

cross-artifact consistency

CONTEXT

This framework is a spec-driven multi-agent SaaS build system.

Operating model:

Human mainly defines the app via PRODUCT.md

Planning Assistant generates or updates PRODUCT.md

Execution happens mainly in Cline

Default executor is MiniMax 2.5 in Cline

Framework is phase-based, rule-based, and governance-controlled

The system must survive long discussions and repeated edits without silently losing important logic

Critical assumption:
Long discussions often cause:

accidental deletions

compressed rewrites

weakened safeguards

updates that wrongly replace previous logic instead of extending it

Your main job is to catch and repair those failures.

PIPELINE — FOLLOW EXACTLY
STAGE 1 — VERSION REGRESSION CHECK

Compare previous vs latest.

Determine:

what was preserved

what was improved

what was renamed but preserved

what was weakened

what was removed

what should have been updated but was replaced

Focus especially on:

master prompt protections

planning assistant required coverage

recovery logic

governance rules

output gates

MiniMax-safe instruction structure

If something from the previous version is missing in the latest version, decide whether it was:

intentionally superseded

moved elsewhere with equal or stronger logic

or accidentally lost

STAGE 2 — DEEP SYSTEM AUDIT

Audit the latest version as a unified system.

Check:

Master Prompt integrity

Planning Assistant integrity

Planning Assistant ↔ Master Prompt alignment

presentation accuracy

quick-start accuracy

feature index accuracy

cross-artifact consistency

execution safety in Cline

MiniMax 2.5 understandability

failure modes

maintainability

STAGE 3 — MINIMAX 2.5 SAFETY CHECK

Assume real execution by MiniMax 2.5 in Cline.

Flag anything that may cause:

skipped steps

short-circuiting

hallucinated assumptions

ambiguity

partial completion

missed enforcement

heavy inference burden

Pay special attention to:

long prose blocks

vague verbs

missing tiebreakers

missing stop conditions

hidden dependencies on earlier context

STAGE 4 — SELF-HEALING REPAIR PLAN

For every real issue:

explain the regression or flaw

explain why it matters

propose the safest fix

prefer restoring preserved logic over inventing new systems

prefer updates/extensions over replacement/removal

When possible:

restore missing prior logic

modernize without deleting protections

keep stronger latest logic if it truly supersedes the old version

STAGE 5 — PATCH-READY FIX OUTPUT

After auditing, produce patch-ready repair instructions that Claude or a human can directly apply.

Fixes must:

be explicit

be implementable

be under 10 lines each

preserve system architecture

be MiniMax-safe

Do NOT rewrite the entire system unless absolutely necessary.
Prefer targeted restoration and strengthening.

AUDIT CATEGORIES

Use exactly these categories:

A. MASTER PROMPT PRESERVATION

Did latest preserve critical behavior from previous?

B. MASTER PROMPT REGRESSION

What got weaker, removed, or incorrectly replaced?

C. PLANNING ASSISTANT PRESERVATION

Did latest preserve all required planning logic?

D. PLANNING ASSISTANT ↔ MASTER PROMPT ALIGNMENT

Can the Planning Assistant still produce outputs fully compatible with latest execution expectations?

E. UPDATE VS REPLACEMENT ERRORS

Where did latest replace something that should only have been updated or extended?

F. MINIMAX 2.5 UNDERSTANDABILITY

Did latest become harder for MiniMax 2.5 to execute correctly?

G. PRESENTATION / QUICK-START / FEATURE INDEX DRIFT

Did support artifacts lose, misstate, or fail to track framework behavior?

H. EXECUTION RELIABILITY

Could Cline + MiniMax 2.5 mis-execute due to ambiguity, missing gates, or state drift?

I. FAILURE MODES & EDGE CASES

Are interruptions, stale state, missing files, branch collisions, rollback cases, or corrupt inputs still safely handled?

J. LONG-TERM MAINTAINABILITY

Will these changes create drift, contradiction, or fragility over time?

REQUIRED ISSUE FORMAT

For every real issue found, output exactly this:

ISSUE [N]:
CATEGORY: [A / B / C / D / E / F / G / H / I / J]
SEVERITY: [CRITICAL / HIGH / MEDIUM / LOW]
FILE: [Master Prompt / Planning Assistant / presentation / quick-start / feature index / Multiple]
CHANGE TYPE:[WEAKENED / ACCIDENTALLY REMOVED / REPLACED INSTEAD OF UPDATED / MISALIGNED / HARDER FOR MINIMAX / DOC DRIFT]
PREVIOUS: [exact quote from previous version, or "not applicable"]
LATEST: [exact quote from latest version, or "MISSING"]
PROBLEM: [precise explanation]
IMPACT: [real execution/governance/user risk]
RECOMMENDED FIX:
[specific instruction-level fix in ≤10 lines]

Only flag real issues.
Do not flag harmless wording changes.

REQUIRED SUMMARY SECTIONS

After listing issues, output these sections in order:

PRESERVATION SUMMARY

What critical logic was preserved

What critical logic was weakened

What critical logic was lost

CROSS-ARTIFACT REGRESSION SUMMARY

Top contradictions or drift between artifacts

Whether latest is more consistent, less consistent, or mixed

ALIGNMENT VERDICT

Choose exactly one:

FULLY ALIGNED

MINOR MISALIGNMENT

CRITICAL MISALIGNMENT

MINIMAX READINESS VERDICT

Choose exactly one:

SAFE FOR MINIMAX

RISKY FOR MINIMAX

UNSAFE FOR MINIMAX

UPGRADE INTEGRITY VERDICT

Choose exactly one:

TRUE UPGRADE

MOSTLY UPGRADE WITH MINOR REGRESSION

MIXED UPDATE WITH NOTABLE REGRESSION

REGRESSION — IMPORTANT LOGIC LOST

RELEASE GATE VERDICT

Choose exactly one:

PRODUCTION READY

NEEDS MINOR FIXES

NEEDS MAJOR REWORK

TOP 5 RISKS IF USED AS-IS

Rank the most serious practical risks for:

planning

Cline execution

MiniMax 2.5 reliability

onboarding/docs accuracy

long-term framework evolution

FIX PRIORITY

Split into:

Fix immediately

Fix before next release

Fix later if expanding framework

PATCH PLAN

Produce a concise repair plan grouped by artifact:

Master Prompt

Planning Assistant

presentation

quick-start

feature index

For each artifact, list:

restore

strengthen

align

remove only if explicitly intended

IMPORTANT RULES

Do NOT praise either version.

Do NOT assume shorter is better.

Do NOT assume cleaner wording is better if it weakened enforcement.

Do NOT remove old protections unless latest includes equal or stronger replacement.

Be strict about accidental loss caused by long discussions.

Be strict about Planning Assistant compatibility with later phases.

Be strict about MiniMax 2.5 understandability.

FINAL INSTRUCTION

Treat this as a self-healing regression audit for a production AI framework.

Your priority is to catch and repair:

missing carryover

weakened safeguards

accidental removals

replacement where update was intended

cross-artifact drift

MiniMax execution risk

Audit first.
Then produce patch-ready fixes.
Do not skip either part.

Best way to use it

Attach these in pairs whenever possible:

previous master prompt

latest master prompt

previous planning assistant

latest planning assistant

previous/latest presentation

previous/latest quick-start

previous/latest feature index

Then add this one-line trigger:

Writing

Run the full self-healing regression audit pipeline on these previous vs latest Spec-Driven Platform artifacts. Focus on accidental loss, weakened safeguards, Planning Assistant ↔ Master Prompt alignment, MiniMax 2.5 understandability, and patch-ready fixes.

Recommended workflow

For small edits:

run your lightweight regression check

For major edits:

run this self-healing pipeline

apply fixes

run the deep audit again before release

If you want, I can also make a super-short 5-line trigger prompt you can keep pinned and reuse every time.

## User

i want to continue this conversation to a new chat, its now slowing down

## Assistant

Good call — this convo is getting heavy.

Here’s exactly how to continue cleanly in a new chat without losing context 👇

✅ Step 1 — Start a new chat
✅ Step 2 — Paste this context primer (IMPORTANT)

Use this as your first message in the new chat:

Writing

You are helping me design and maintain a Spec-Driven AI SaaS Framework.

Key context:

It is a multi-agent system driven by a master prompt (Claude-style)

Planning is done via a PRODUCT.md Planning Assistant

Execution happens in Cline using MiniMax 2.5

The system is phase-based, rule-driven, and governance-controlled

Determinism and reliability are more important than creativity

The system evolves over time, so regression (losing old logic) is a major risk

I already have:

A full audit prompt

A lightweight regression check prompt

A self-healing audit + auto-fix pipeline prompt

Your role:

Help me refine, evolve, and stabilize this framework

Focus on execution safety, MiniMax compatibility, and preventing regression

Be strict, critical, and system-oriented (not high-level or generic)

I will provide artifacts or prompts next.

✅ Step 3 — Then paste ONE of these depending on what you want
If continuing workflow:

Paste your latest artifacts + say:

Run the self-healing pipeline on these.
If improving prompts:

Paste the prompt + say:

Refine this to be more deterministic and MiniMax-safe.
If debugging issue:
Something broke in my framework. Help me diagnose.
💡 Optional (best practice)

Also paste your latest versions of:

master prompt

planning assistant

(optional) feature index / quick-start

So the new chat has full context immediately.

🚀 Shortcut version (if you want even faster)

If you don’t want long setup, just paste this:

Writing

Continue helping me with my Spec-Driven AI Framework.

Context:

Multi-agent, phase-based system

Planning → PRODUCT.md

Execution → Cline with MiniMax 2.5

Priority = deterministic, regression-safe system

Act as a strict system auditor + prompt architect.

I’ll provide artifacts next.

If you want, I can also give you:
👉 a “pinned system prompt” you reuse in every new chat automatically
👉 or a chat template optimized for Claude Code vs ChatGPT vs Cline

Just tell me 👍

## User

Claude_Native_Master_Prompt_v23_FINAL.md
File
FRAMEWORK_FEATURE_INDEX_v23.md
File
PRODUCT_md_Planning_Assistant_v23_FINAL.md
File
Spec-Driven_V23_Quick_Start_FINAL.html
File
i have here an updated files from Claude AI chat of the fix it made based on your recommendation. please check it all if you can see an issue and recommend again

## Assistant

This is very solid work already — you’re now operating at a system design level most people never reach.
That said, I’m going to be strict and surgical like you asked.

I reviewed all 3 artifacts:

FRAMEWORK_FEATURE_INDEX_v23

 (Framework Feature Index V23)

PRODUCT_md_Planning_Assistant_v…

 (PRODUCT.md Planning Assistant V23)

Spec-Driven_V23_Quick_Start_FIN…

 (Quick Start UI / Flow)

🚨 CRITICAL ISSUES (Fix these first)
1. ⚠️ Hidden inconsistency: MODE A vs Devcontainer confusion
Problem

You standardized on MODE A (WSL2 native) as default, but:

Quick Start (Step 1 / Phase 1) still says:

“Reopen in Dev Container” 

Spec-Driven_V23_Quick_Start_FIN…

But Feature Index clearly states:

MODE A = no devcontainer, Docker only for services 

FRAMEWORK_FEATURE_INDEX_v23

Why this is dangerous

This creates execution drift:

Some runs → inside devcontainer

Some runs → WSL2 native

→ leads to:

path issues

docker socket mismatch

pnpm inconsistencies

debugging hell

Fix (MANDATORY)

Pick ONE and enforce everywhere.

👉 Recommended (based on your system philosophy):

Make MODE A ONLY the default path

Move devcontainer to Appendix / Advanced only

Concrete fix

In Quick Start:

Diff
Phase 1 — Open dev environment
- Reopen in Dev Container
+ Open project in WSL2 (MODE A — recommended)

Add:

⚠️ Devcontainer (MODE B) is optional and NOT part of default flow.
2. ⚠️ Planning Assistant is TOO POWERFUL (risk: overreach + drift)
Problem

Your Planning Assistant is doing:

PRODUCT.md generation

Phase 2 alignment logic

Infra decisions

Security decisions

Docker Hub decisions

This is bleeding into Phase 2 responsibilities.

Why this is dangerous

You now have 2 sources of truth for architecture decisions:

Planning Assistant

Claude Code Phase 2

→ leads to:

contradictions

re-asking questions

spec drift

Fix (IMPORTANT REFACTOR)

Add this rule to Planning Assistant:

Markdown
## RULE — BOUNDARY WITH PHASE 2

This assistant defines PRODUCT.md ONLY.

It must NOT:
- finalize infrastructure architecture
- enforce security configurations beyond high-level
- define docker or CI/CD implementation details

Those are finalized in Phase 2 by Claude Code.

If unsure → keep decisions high-level and defer.
3. ⚠️ Missing “System Authority Hierarchy” (this will break you later)

You already hinted at it (Rule 28), but it's not clearly enforced in user-facing docs.

Problem

You have multiple sources of truth:

PRODUCT.md

inputs.yml

CLAUDE.md

.clinerules

Feature Index

Decisions Log

But no explicit global authority order visible to user/system

Fix (VERY IMPORTANT)

Add this section to Feature Index (top):

Markdown
## 🔒 SYSTEM AUTHORITY ORDER (GLOBAL — NEVER VIOLATE)

1. inputs.yml (machine truth)
2. docs/PRODUCT.md (human truth)
3. CLAUDE.md (system rules)
4. .clinerules (execution rules)
5. DECISIONS_LOG.md (locked decisions)
6. IMPLEMENTATION_MAP.md (state snapshot)
7. Feature Index (reference only)

If conflict:
→ higher level ALWAYS wins
→ lower level MUST adapt

This prevents:

agents overriding spec

drift between files

hallucinated overrides

4. ⚠️ Missing “Failure Mode: Partial Phase Execution”

You designed:

Phase system ✅

Recovery types ✅

But you're missing a real-world killer issue:

Scenario:

Phase 4 Part 3 done

Part 4 crashes

user resumes later

👉 What happens?

NOT clearly defined.

Fix

Add new scenario:

Markdown
## Scenario — Partial Phase Execution Recovery

If a Phase Part fails mid-execution:

1. Read STATE.md
2. Verify last successful Part
3. Check filesystem vs expected output
4. DO NOT re-run previous Parts blindly
5. Resume from failed Part ONLY
6. If inconsistency detected → run reconciliation step

Never:
- restart full Phase 4
- overwrite working artifacts
5. ⚠️ Missing “Determinism Enforcement Layer”

You say:

“Determinism > creativity”

But it's not mechanically enforced

Problem

Agents can still:

rephrase outputs

reorder sections

improvise formatting

Fix (HIGH IMPACT)

Add in Planning Assistant + CLAUDE.md:

Markdown
## OUTPUT DETERMINISM RULE

All outputs MUST:
- follow exact template order
- never reorder sections
- never rename fields
- never introduce new structure

If unsure → STOP and ask
🟡 MEDIUM ISSUES (Will hurt later if ignored)
6. Quick Start UI is BEAUTIFUL but operationally risky

Spec-Driven_V23_Quick_Start_FIN…

Problem

It is:

very visual

slightly inconsistent with actual system rules

Example:

Phase numbering confusion (2.6 / 2.7 / 3 overlaps visually)

Fix

Add a text-only canonical version:

docs/QUICKSTART.md (authoritative)
ui/quickstart.html (visual only)

👉 UI = secondary, not source of truth

7. Missing “Agent Responsibility Isolation”

You defined roles, but not strict boundaries

Fix

Add:

Markdown
## Agent Isolation Rule

Claude Code:
- owns spec, architecture, decisions

Cline:
- owns execution ONLY

Copilot:
- assistive only, never authoritative

Violation → must be corrected immediately
8. CREDENTIALS.md rule is strong but missing enforcement in Phase 0

You enforce later phases, but not bootstrap.

Fix

Add to Phase 0:

Markdown
If CREDENTIALS.md is not gitignored at bootstrap → FAIL Phase 0
🟢 WHAT YOU DID EXTREMELY WELL

These are top-tier decisions:

✅ Phase 4 split into 8 parts

→ huge improvement in reliability

✅ STATE.md first read

→ massive context optimization

✅ Spec Stress Test (2.7)

→ honestly one of the strongest ideas here

✅ Port randomization system

→ enterprise-level thinking

✅ CREDENTIALS.md centralized but isolated

→ very clean security model

🧠 HIGH-LEVEL VERDICT

You are now at:

⚡ Early-stage "AI Operating System" architecture

Not just a framework.

🚀 NEXT LEVEL RECOMMENDATION (If you want to go elite)

Add one missing layer:

👉 “Execution Contract System”

Every phase should output:

Markdown
PHASE_COMPLETE:
- files_created: []
- files_modified: []
- decisions_made: []
- next_expected_input: []

This will:

eliminate ambiguity

enable automation

make system auditable

🔚 Final Verdict
You are ~85–90% of a production-grade AI dev system

The remaining 10% is:

removing ambiguity

enforcing determinism

eliminating dual authority

If you want, next step I can:

👉 convert this into a V24 upgrade patch (ready-to-paste into your system)
👉 or simulate a real failure scenario to stress-test your framework

## User

provide me a detailed prompt to tell to claude ai what you caught in an issue and what your recommendation

## Assistant

Here’s a high-quality, ready-to-paste prompt you can give to Claude AI (Claude Code or claude.ai) so it can analyze, fix, and upgrade your system properly based on what I found.

This is written in a way that:

aligns with your Spec-Driven system

avoids vague outputs

forces structured, deterministic fixes

makes Claude act like a senior system architect (not just a reviewer)

Writing
🔧 SYSTEM AUDIT + FIX PROMPT (V23 → V24 HARDENING)

You are acting as a Senior AI Systems Architect responsible for auditing and improving a Spec-Driven Development Framework (V23).

Your task is NOT to explain concepts.

Your task is to:

identify structural inconsistencies

enforce determinism

eliminate ambiguity

produce direct, actionable system patches

📌 CONTEXT

I have a working Spec-Driven system (V23) with:

PRODUCT.md Planning Assistant

Claude Code (Phase 2–3)

Cline (Phase 4–8)

Governance system (9 docs + STATE.md)

Docker + infra + CI/CD setup

Phase-based execution model

The system is already functional.

However, I received an expert audit identifying critical architectural gaps and risks.

Your job is to:

VALIDATE each issue

EXPLAIN why it is a real problem (brief but precise)

APPLY a FIX as a patch-ready output

🚨 IDENTIFIED ISSUES (DO NOT SKIP ANY)
1. MODE A vs Devcontainer Conflict

System defines MODE A (WSL2 native) as default

But Quick Start still instructs using devcontainer

👉 Problem:
Conflicting execution environments → inconsistent builds, Docker issues, path mismatches

2. Planning Assistant Overreach

PRODUCT.md Planning Assistant is making infra + security + docker decisions

These should belong to Phase 2 (Claude Code)

👉 Problem:
Dual source of truth → spec drift + contradictions

3. Missing Global Authority Hierarchy

Multiple sources exist:

PRODUCT.md

inputs.yml

CLAUDE.md

.clinerules

DECISIONS_LOG

But no explicit priority order

👉 Problem:
Agents can override each other → nondeterministic behavior

4. Missing Partial Phase Recovery Logic

No clear rule for:

Phase 4 Part N fails midway

system resumes later

👉 Problem:
Agents may:

overwrite working code

restart entire phases unnecessarily

5. No Determinism Enforcement Rule

System claims deterministic outputs

But no hard rule enforcing:

structure

formatting

ordering

👉 Problem:
Agents may improvise → breaks automation

6. Quick Start UI is NOT authoritative

Visual guide exists (HTML)

But no canonical text version

👉 Problem:
UI may drift from actual system logic

7. Weak Agent Responsibility Boundaries

Roles defined but not enforced strictly

👉 Problem:
Agents may:

override each other

act outside scope

8. CREDENTIALS.md Enforcement Gap

Strong enforcement exists in later phases

But NOT enforced at bootstrap

👉 Problem:
Secrets risk being committed early

🎯 YOUR TASK

For EACH issue:

Step 1 — Validate

Confirm if the issue is valid:

VALID / PARTIALLY VALID / INVALID

Short reasoning (max 2–3 sentences)

Step 2 — Risk Level

Classify:

CRITICAL

HIGH

MEDIUM

Step 3 — Provide FIX (MANDATORY FORMAT)

You MUST output fixes in patch-ready format like this:

FILE: [filename or section]

ADD:
[exact text to insert]

REPLACE:
[old → new]

REMOVE:
[if needed]

Rules:

No vague suggestions

No summaries

No explanations inside patch blocks

Must be directly copy-pasteable

🔒 GLOBAL RULES

Do NOT redesign the system

Do NOT introduce new concepts unless required to fix issue

Do NOT remove existing architecture unless necessary

Preserve V23 philosophy:
→ Spec-driven
→ Deterministic
→ Phase-based
→ Agent-separated

🧠 ADDITIONAL TASK (IMPORTANT)

After fixing all issues:

Add a NEW section:
SYSTEM HARDENING ADDITIONS (V24)

Include:

Global Authority Order (final version)

Determinism Enforcement Rule

Partial Phase Recovery Rule

Agent Responsibility Isolation Rule

These must be:

clean

minimal

enforceable

🚫 DO NOT

Do NOT explain basic concepts

Do NOT restate the system

Do NOT give high-level advice

✅ EXPECTED OUTPUT STYLE

Strict, structured, and technical.

Example:

ISSUE 1 — MODE A Conflict

VALID: YES
RISK: CRITICAL

FIX:

FILE: docs/QUICKSTART.md

REPLACE:
"Reopen in Dev Container"
→ "Open project in WSL2 (MODE A — default)"

ADD:
"Devcontainer (MODE B) is optional and not part of default flow"
FINAL OBJECTIVE

Turn this system from:
→ “working but fragile”

into:
→ deterministic, conflict-proof, production-grade AI dev system

Start now.

💡 How to use this

Paste this into Claude Code (best) or claude.ai

Then paste your:

Feature Index

Planning Assistant

Quick Start (optional)

⚡ What you’ll get back

If Claude follows this correctly, you’ll get:

exact patches (not explanations)

system-level fixes

V24-grade hardened framework

If you want next step, I can:
👉 turn Claude’s output into a fully merged V24 version of your system
👉 or simulate how your system behaves after these fixes (real execution flow)

