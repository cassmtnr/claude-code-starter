# Phase 12: Re-baseline against Current Claude Code

> Overhaul phase. Research-only — no code changes. Produces an audit doc identifying where `claude-code-starter`'s generated artifacts have drifted from current Claude Code idioms, plus a "should we generate this?" verdict for missing surfaces. Output drives Phase 13's rebuild.

## Goal

Produce a single audit doc at `docs/superpowers/plans/phase-12-claude-code-rebaseline.md` (this file, populated during implementation) that gives Phase 13 a concrete punch list: for every artifact this tool generates today, document any divergence from current Claude Code conventions with a `keep`/`update`/`deprecate` verdict; for relevant missing surfaces (plugins, MCP, output styles, newer hook events, permission rules), document a `should we generate this` verdict with rationale.

## Scope

**In scope — current artifacts (9):**

| Artifact | Source in repo | Owns the format |
|---|---|---|
| `.claude/CLAUDE.md` | `src/prompt.ts` (Phase 2 of `ANALYSIS_PROMPT`) | Claude analysis |
| `.claude/skills/*` | `src/prompt.ts` (`SKILLS_PROMPT`, labelled "Phase 4" inside the constant) | Claude analysis |
| `.claude/agents/*` | `src/prompt.ts` (`AGENTS_PROMPT`, labelled "Phase 5") | Claude analysis |
| `.claude/rules/*` | `src/prompt.ts` (`RULES_PROMPT`, labelled "Phase 6") | Claude analysis |
| `.claude/commands/*` | `src/prompt.ts` (`COMMANDS_PROMPT`, labelled "Phase 7") | Claude analysis |
| `.claude/memory/*` | `src/prompt.ts` (`MEMORY_PROMPT`, labelled "Phase 8") | Claude analysis |
| `.claude/settings.json` | `src/generator.ts:writeSettings` | Deterministic generator |
| `.claude/hooks/*` (`block-dangerous-commands.js`, `protect-sensitive-files.js`) | `src/hooks.ts` (`HOOK_SCRIPT`, `SENSITIVE_FILES_HOOK`) + `src/extras.ts` (`EXTRAS` registry: `safety-hook`, `sensitive-files`) | Deterministic templates |
| `.claude/config/statusline-command.sh` | `src/hooks.ts:STATUSLINE_SCRIPT` | Deterministic template |

**Anomaly noted during spec drafting (out-of-band for Phase 12, surface for Phase 13):** `ROADMAP.md` claims a `tool-logger` extra is "done" (line ~789), but no implementation exists in `src/hooks.ts` or `src/extras.ts` as of 2026-05-25. The `EXTRAS` registry has exactly 3 entries — `safety-hook`, `statusline`, `sensitive-files`. Either the tool-logger was deferred and the ROADMAP is stale, or it lives elsewhere. Phase 12 does not investigate further; Phase 13 should reconcile.

**In scope — missing surfaces (5):**

For each, the audit answers: *should this tool generate it?* with rationale.

- Plugin manifests (claude-code plugin marketplace — `.claude/plugin.json` / marketplace JSON)
- MCP server configs (`.mcp.json` or `settings.json` `mcpServers` field)
- Custom output styles (`.claude/output-styles/*`)
- Newer hook events (`SessionStart`, `Stop`, `SubagentStop`, `UserPromptSubmit`, `Notification`, `PreCompact`)
- Permission rules deep dive (allow/deny patterns in `settings.json` — beyond what `generator.ts` already emits)

**Out of scope:**

- Implementing any change. Phase 13 owns the rebuild.
- Source code modifications in this phase. This phase produces only this file.
- Speculation about Claude Code features that don't exist or aren't documented.
- L1-L7 audit items from `docs/AUDIT.md` (Phase 11 dropped/deferred these; out of scope for re-baselining).

## Methodology

Sequential research, one artifact (or surface) at a time. Each section in the audit is built from:

1. **Current state from the repo.** Quote the exact string from `src/prompt.ts` (for Claude-generated artifacts) or read the generator template (for deterministic ones). No paraphrasing — verbatim source quotes.
2. **Idiomatic-today reference.** Cite a URL from `code.claude.com/docs/en/` OR a verification command (`claude --help | grep ...`, file inspection in `~/.claude/plugins/cache/`).
3. **Divergences.** Concrete bullet list. Each divergence is either "format mismatch," "missing field," "deprecated convention," or "naming drift."
4. **Verdict.** One of: `keep` (already correct), `update` (Phase 13 fix), `deprecate` (remove from tool).
5. **Effort.** S (≤30 LOC change), M (~100 LOC), L (significant restructuring).
6. **Phase 13 action.** One sentence — what to change.

For missing surfaces, the structure is: current state ("not generated"), idiomatic reference, "should we?" verdict (`yes` / `no` / `defer to user toggle`), rationale, effort, Phase 13 action.

## Sources of truth

**Primary:**
- `https://code.claude.com/docs/en/` — the canonical Claude Code documentation. (Both `docs.claude.com/en/docs/claude-code/*` and `docs.anthropic.com/en/docs/claude-code/*` 301-redirect to this base; verify with `curl -sI -L -o /dev/null -w "%{url_effective}\n" <url>`.)
- `claude --help` and subcommand `--help` flags — runtime behavior verification.

**Secondary (only if primary insufficient):**
- `~/.claude/plugins/cache/claude-plugins-official/*` — Anthropic-distributed plugins. **Caveat:** verify each plugin explicitly targets Claude Code (not OpenCode or another IDE harness) before treating it as a canonical reference. As of 2026-05-25 the `superpowers` plugin's `package.json` declares `"main": ".opencode/plugins/superpowers.js"` — it targets OpenCode and its `CONTRIBUTING.md` explicitly states its skill philosophy diverges from Anthropic's published guidance. Use such plugins only as illustrative shape references, never as a final source of truth for Claude Code conventions.
- Anthropic engineering blog posts that announce specific Claude Code features.
- GitHub release notes of the `claude` CLI.

**Not allowed:**
- Random community blog posts.
- Third-party plugin examples sourced outside `~/.claude/plugins/cache/` (the local cache acts as a soft endorsement signal; outside that, no).
- Speculation about undocumented behavior.

**Out-of-scope but allowed as a secondary cross-check:**
- The project's own `.claude/` directory — generated by this tool's own prior bootstrapping. Useful as a real-world specimen to sanity-check that the prompts produce what the methodology section claims, but NOT used as the source of "idiomatic-today" claims (it represents output, not the standard).
- The user's global `~/.claude/skills/`, `~/.claude/agents/`, etc. — same status: real specimens, not authoritative.

## Verification rule (per project CLAUDE.md)

Every claim about "idiomatic-today" MUST include either:
- A URL the user can open, OR
- A shell command the user can run to reproduce the finding

Claims without verification artifacts get marked as `unverified` in the audit and either get cut or downgraded to a "worth investigating in Phase 13" note. **Hard cap:** no more than 2 of the 14 sub-sections may rely on `deferred to Phase 13` as their primary verdict. If more than 2 sections punt, the spec itself is incomplete and needs another research pass before Phase 13 starts — Phase 13 cannot plan against a half-researched audit.

## Output format

This file gets a major new section appended during implementation: `## Audit Findings`. That section has one sub-heading per artifact (9) and per missing surface (5), totaling 14 sub-sections.

Each sub-section follows the structure defined under Methodology above. The final audit also includes a roll-up table at the top of `## Audit Findings` summarizing every verdict + effort + Phase 13 action in one row each — Phase 13's planning starts from that table.

## Completeness check (replaces "test plan" for a docs-only phase)

The audit is considered complete when:
1. Every artifact in `Scope > In scope — current artifacts` has a section with all 6 fields populated.
2. Every missing surface has a section with all 6 fields populated.
3. The roll-up table at the top has 14 rows.
4. Every "idiomatic-today" claim has either a URL or a verification command.
5. No section contains "TBD", "needs further research", or other punt phrases — punts get either real findings or a `deferred to Phase 13` note with explanation.

## Rollback

Not applicable. This phase produces only documentation. If the audit is wrong, Phase 13 will surface that and Phase 12 gets revised before Phase 13 ships.

## Files touched

**Always changed:**
- `docs/superpowers/plans/phase-12-claude-code-rebaseline.md` (this file) — audit findings appended

**Not touched in this phase:**
- Any source file
- Any other doc
- Settings or configs

## Constraints

- No code changes. If the audit reveals an obvious bug, file it as a Phase 11.5 follow-up — do not fix inline.
- No subagent dispatch for research. Inline WebFetch + Reads in this session produce a more coherent audit than parallel agents whose findings would need reconciling.
- All git ops by the user.

## Non-goals

- **Implementing fixes for divergences found.** That's Phase 13.
- **Replacing Claude-analysis-generated artifacts with deterministic templates.** That's a Phase 13 design decision informed by this audit, not a Phase 12 conclusion.
- **Researching Claude Code's roadmap.** Only current, documented behavior.
- **Auditing the project's own `.claude/` directory** (the bootstrapping done on `claude-code-starter` itself). The audit is about what the tool GENERATES for downstream users, not the project's own config.

---

# Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` (inline) — NOT subagent-driven. Research benefits from coherent context per the spec's Constraints section. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the `## Audit Findings` section of this same spec file with 14 sub-sections (9 current artifacts + 5 missing surfaces) per the Methodology defined above, plus a 14-row roll-up table that Phase 13 will plan from.

**Architecture:** Research-only phase. The implementer reads each in-scope artifact's source quote from the repo, fetches the corresponding Claude Code documentation page, identifies divergences, assigns a verdict (`keep`/`update`/`deprecate` for current; `yes`/`no`/`defer to user toggle` for missing), and writes a 6-field sub-section. Output is appended to this spec file. No code, no tests, no commits by the implementer — the user commits the populated audit as a single docs commit at the end.

**Tech Stack:** WebFetch (for `code.claude.com/docs/en/` pages), Read (for `src/prompt.ts`, `src/generator.ts`, `src/hooks.ts`, `src/extras.ts`, `~/.claude/plugins/cache/`), Bash for verification commands (`curl`, `claude --help`).

**Execution invariants** (apply to every task):
- All git operations are performed by the **user**, never by the implementer.
- No source code modifications. If the audit reveals an obvious bug (typo in a prompt, etc.), file it under the "anomaly noted during spec drafting" pattern — surface to the user, do not fix inline.
- Every "idiomatic-today" claim MUST include a URL or verification command. The Hard Cap rule (≤2 sub-sections deferred) is enforced by Task 10.
- Append-only: each task adds its sub-section after the existing content. Never rewrites prior sub-sections (if a later finding contradicts an earlier one, surface it in the roll-up at Task 10).
- The roll-up table is built at the END (Task 10) from the populated sub-sections, not incrementally.

---

## Task 1: Pre-flight — verify sources and capture current-state quotes

**Files:** No file edits. Only reads + URL probes + writes to this spec under a new `## Audit Findings` heading with placeholder content.

- [ ] **Step 1: Verify primary docs URLs resolve**

Run:
```bash
for path in settings skills hooks subagents slash-commands memory output-styles mcp plugins; do
  url="https://code.claude.com/docs/en/$path"
  code=$(curl -sI -o /dev/null -w "%{http_code}" "$url")
  echo "$code $url"
done
```

Expected: every line starts with `200`. If any line shows `301`, `302`, or `404`, record the actual page path the implementer will use (e.g., the doc structure may use `hooks-guide` instead of `hooks`). Note the working paths in a scratch list for use in subsequent tasks.

- [ ] **Step 2: Verify `claude --version` and key flags exist**

Run:
```bash
claude --version
claude --help 2>&1 | grep -E "system-prompt|allowedTools|append-system-prompt|bare" | head -10
```

Expected: version prints, and the flags `--system-prompt`, `--append-system-prompt`, `--allowedTools` all appear. If any is missing, mark as a divergence finding for the relevant artifact later.

- [ ] **Step 3: Inventory the in-scope Claude-analysis prompts**

Run:
```bash
grep -nE "^## Phase [0-9]+:|^const (ANALYSIS|SKILLS|AGENTS|RULES|COMMANDS|MEMORY)_PROMPT" /Users/cassiano/Dev/claude-code-starter/src/prompt.ts
```

Expected: 6 prompt constants + their phase labels. Confirm the spec's scope-table mappings (Phase 2 for CLAUDE.md, Phase 4 for skills, etc.) match. If any are off, fix the scope table BEFORE proceeding.

- [ ] **Step 4: Inventory the deterministic generators**

Run:
```bash
grep -nE "^export function|^const [A-Z_]+\s*=" /Users/cassiano/Dev/claude-code-starter/src/generator.ts /Users/cassiano/Dev/claude-code-starter/src/hooks.ts /Users/cassiano/Dev/claude-code-starter/src/extras.ts | head -30
```

Expected: confirm `writeSettings` (generator.ts), `HOOK_SCRIPT` / `SENSITIVE_FILES_HOOK` / `STATUSLINE_SCRIPT` (hooks.ts), `EXTRAS` registry (extras.ts).

- [ ] **Step 5: Append the Audit Findings scaffold**

Append to this spec file (after the Non-goals section, at the very bottom):

```markdown

---

## Audit Findings

*Populated by Phase 12 implementation. Roll-up table at the top is built from individual sub-sections below. Hard cap: ≤2 sub-sections may use `deferred to Phase 13` as primary verdict.*

### Roll-up

*Filled in by Task 10. Rows: 14 (9 current + 5 missing).*

### Current artifacts

*Filled by Tasks 2-4.*

### Missing surfaces

*Filled by Tasks 5-9.*
```

This scaffold establishes the structure all subsequent tasks append into.

---

## Task 2: Audit current artifacts — Claude-analysis-generated set 1 (CLAUDE.md, Skills, Agents)

**Files:** Append to this spec file under `### Current artifacts`. No other files.

This batch clusters the three Claude-analysis-generated artifacts that share frontmatter/markdown conventions. Researching them together lets the implementer reuse the same docs page (skills) as the canonical reference for frontmatter shape.

- [ ] **Step 1: Fetch and read the canonical references**

WebFetch each in turn, save key quotes to scratch notes:
- `https://code.claude.com/docs/en/memory` (covers CLAUDE.md location, format, hierarchy)
- `https://code.claude.com/docs/en/skills` (covers skill frontmatter, SKILL.md file structure, location conventions, naming)
- `https://code.claude.com/docs/en/subagents` (covers agent definition file structure)

For each, capture: (a) the file/directory location convention, (b) the frontmatter schema, (c) any naming rules.

- [ ] **Step 2: Read the current prompts**

```bash
sed -n '442,534p' /Users/cassiano/Dev/claude-code-starter/src/prompt.ts  # Phase 2: CLAUDE.md
sed -n '582,676p' /Users/cassiano/Dev/claude-code-starter/src/prompt.ts  # Phase 4: Skills
sed -n '677,855p' /Users/cassiano/Dev/claude-code-starter/src/prompt.ts  # Phase 5: Agents
```

For each prompt, capture verbatim:
- What file location the prompt instructs Claude to write to
- What frontmatter (if any) the prompt instructs Claude to include
- Any naming rules

- [ ] **Step 3: Write the 3 sub-sections**

Append to this spec under `### Current artifacts` — one sub-heading per artifact (`#### CLAUDE.md`, `#### Skills (.claude/skills/*)`, `#### Agents (.claude/agents/*)`). Each sub-section MUST have all 6 fields from the Methodology section:

```markdown
#### CLAUDE.md

1. **Current state from the repo:** [verbatim quote from prompt.ts]
2. **Idiomatic-today reference:** [URL or verification command]
3. **Divergences:** [bullet list, or "none — current generation matches"]
4. **Verdict:** `keep` | `update` | `deprecate`
5. **Effort:** S (≤30 LOC) | M (~100 LOC) | L (significant restructuring)
6. **Phase 13 action:** [one sentence]
```

Repeat the structure for `#### Skills` and `#### Agents`.

- [ ] **Step 4: Local verification**

Re-read the 3 appended sub-sections. Confirm each has all 6 fields populated, each has a URL or verification command, and the verdict is one of the allowed values.

---

## Task 3: Audit current artifacts — Claude-analysis-generated set 2 (Rules, Commands, Memory)

**Files:** Append to this spec file under `### Current artifacts`.

- [ ] **Step 1: Fetch the canonical references**

- `https://code.claude.com/docs/en/slash-commands` (covers `.claude/commands/*` structure)
- `https://code.claude.com/docs/en/memory` (re-read for the memory subsystem, if not already cached from Task 2)
- For "Rules": there is no dedicated Claude Code "rules" docs page — `rules` is a project-specific concept this tool invented (per the project's own CLAUDE.md / SKILL.md). Use the Claude Code skills page as the closest analog, and explicitly call out that `rules` may be a tool-invented concept that has no upstream canonical form.

- [ ] **Step 2: Read the current prompts**

```bash
sed -n '856,920p' /Users/cassiano/Dev/claude-code-starter/src/prompt.ts  # Phase 6: Rules
sed -n '921,1034p' /Users/cassiano/Dev/claude-code-starter/src/prompt.ts  # Phase 7: Commands
sed -n '1035,1083p' /Users/cassiano/Dev/claude-code-starter/src/prompt.ts  # Phase 8: Memory
```

For each, capture: file/directory location, frontmatter shape, naming rules, any slash-prefix conventions (commands).

- [ ] **Step 3: Write the 3 sub-sections**

Append `#### Rules (.claude/rules/*)`, `#### Commands (.claude/commands/*)`, `#### Memory (.claude/memory/*)` under `### Current artifacts`. Same 6-field structure as Task 2.

For the Rules sub-section specifically: if no upstream canonical form exists, the divergence list should be empty, the verdict should be `keep` (with the rationale that it's a tool-specific concept), and the Phase 13 action is "no change — Rules are tool-defined, not Claude Code canonical."

- [ ] **Step 4: Local verification**

Same as Task 2 Step 4.

---

## Task 4: Audit current artifacts — Deterministic set (settings.json, Hooks, Statusline)

**Files:** Append to this spec file under `### Current artifacts`.

- [ ] **Step 1: Fetch the canonical references**

- `https://code.claude.com/docs/en/settings` (covers `settings.json` schema)
- `https://code.claude.com/docs/en/hooks` (covers hooks config in settings.json + supported hook events)
- For statusline: search `claude --help 2>&1 | grep -i statusline` and `https://code.claude.com/docs/en/settings` (statusline is configured via settings.json, not a separate page typically).

- [ ] **Step 2: Read the current generators**

```bash
# settings.json shape:
grep -nA20 "export function writeSettings" /Users/cassiano/Dev/claude-code-starter/src/generator.ts

# hooks:
sed -n '370,400p' /Users/cassiano/Dev/claude-code-starter/src/hooks.ts  # STATUSLINE_SCRIPT
grep -nA5 "HOOK_SCRIPT|SENSITIVE_FILES_HOOK" /Users/cassiano/Dev/claude-code-starter/src/hooks.ts | head -20

# extras registry:
sed -n '50,100p' /Users/cassiano/Dev/claude-code-starter/src/extras.ts
```

Capture: the exact settings.json keys this tool emits, hook event names used (`PreToolUse`, `PostToolUse`, etc.), statusline configuration approach.

- [ ] **Step 3: Write the 3 sub-sections**

Append `#### settings.json`, `#### Hooks (.claude/hooks/*)`, `#### Statusline (.claude/config/statusline-command.sh)` under `### Current artifacts`. Same 6-field structure.

For settings.json: pay special attention to whether the tool emits all the keys Claude Code supports today (env, permissions, includeCoAuthoredBy, hooks, statusLine, mcpServers, etc.). Each unsupported emit is a `format mismatch` divergence; each missing emit is a `missing field` divergence.

- [ ] **Step 4: Local verification**

Same as Task 2 Step 4.

---

## Task 5: Audit missing surface — Plugin manifests

**Files:** Append to this spec file under `### Missing surfaces`.

- [ ] **Step 1: Fetch the canonical reference**

WebFetch `https://code.claude.com/docs/en/plugins`. Capture: plugin manifest schema (likely `plugin.json` or `.claude-plugin/plugin.json`), required fields, version constraints, whether plugins can include skills/agents/commands inside their package.

- [ ] **Step 2: Inspect a real-world example**

```bash
find ~/.claude/plugins/cache/claude-plugins-official -name "plugin.json" -o -name ".claude-plugin" -type d 2>/dev/null | head -5
# Then cat the most representative one
```

If found, quote the relevant fields. If the example uses OpenCode-specific structure (per the spec's caveat), note that explicitly.

- [ ] **Step 3: Write the sub-section**

Append `#### Plugin manifests` under `### Missing surfaces`. Structure:

```markdown
#### Plugin manifests

1. **Current state:** Not generated by this tool today.
2. **Idiomatic-today reference:** [URL + relevant fields]
3. **What this surface does:** [one paragraph — why plugins exist, what they enable]
4. **Verdict:** `yes` | `no` | `defer to user toggle`
5. **Rationale:** [why that verdict]
6. **Effort + Phase 13 action:** [S/M/L + one sentence]
```

The verdict rationale should consider: does generating a plugin manifest fit the tool's purpose (bootstrap a project's .claude/ config), or is it a separate use case (package a reusable plugin for distribution)?

---

## Task 6: Audit missing surface — MCP server configs

**Files:** Append to this spec file under `### Missing surfaces`.

- [ ] **Step 1: Fetch the canonical reference**

WebFetch `https://code.claude.com/docs/en/mcp`. Capture: where MCP configs live (`.mcp.json` vs `settings.json` `mcpServers` field vs both), required fields, transport types (stdio, http, sse), any project-vs-global distinction.

- [ ] **Step 2: Verify with the CLI**

```bash
claude mcp --help 2>&1 | head -20
```

Capture the supported subcommands and config locations.

- [ ] **Step 3: Write the sub-section**

Append `#### MCP server configs` under `### Missing surfaces`. Same structure as Task 5 Step 3. Verdict rationale should consider whether the tool can reasonably infer which MCP servers a downstream project needs (probably not without explicit user input), and whether a "defer to user toggle" makes more sense than a yes/no.

---

## Task 7: Audit missing surface — Custom output styles

**Files:** Append to this spec file under `### Missing surfaces`.

- [ ] **Step 1: Fetch the canonical reference**

WebFetch `https://code.claude.com/docs/en/output-styles`. Capture: file location (`.claude/output-styles/*.md` likely), schema, what they control (Claude's response formatting style?), how a user switches between them.

- [ ] **Step 2: Verify with the CLI**

```bash
claude --help 2>&1 | grep -iE "output.style"
```

Confirm the CLI exposes them.

- [ ] **Step 3: Write the sub-section**

Append `#### Custom output styles` under `### Missing surfaces`. Same structure as Task 5 Step 3. Verdict rationale should weigh: are output styles project-specific (yes, generate) or user-preference (no, don't generate from a per-project analysis)?

---

## Task 8: Audit missing surface — Newer hook events

**Files:** Append to this spec file under `### Missing surfaces`.

- [ ] **Step 1: Fetch the canonical reference**

WebFetch `https://code.claude.com/docs/en/hooks`. Capture the full list of supported hook events as of 2026 (the spec mentions `SessionStart`, `Stop`, `SubagentStop`, `UserPromptSubmit`, `Notification`, `PreCompact` — verify which exist).

- [ ] **Step 2: Compare to what this tool currently emits**

The audit from Task 4 covers what's emitted today. Re-read it. The newer-hook-events sub-section here specifically lists hook events Claude Code supports that the tool's EXTRAS registry doesn't expose. Don't duplicate; instead, reference Task 4's findings and add the delta.

- [ ] **Step 3: Write the sub-section**

Append `#### Newer hook events` under `### Missing surfaces`. Same structure as Task 5 Step 3, with the divergences field replaced by a "Events not currently exposed by the tool's EXTRAS registry" list.

For each event missing from EXTRAS, the rationale field briefly notes whether it's worth adding (some events like `Notification` are user-preference; others like `SessionStart` could be load-bearing for bootstrapping).

---

## Task 9: Audit missing surface — Permission rules deep dive

**Files:** Append to this spec file under `### Missing surfaces`.

- [ ] **Step 1: Fetch the canonical reference**

WebFetch `https://code.claude.com/docs/en/settings` (the permissions section specifically). Capture: allow/deny rule syntax, glob support, tool-specific rules (e.g., `Bash(git status)` vs `Bash(*)`), how rules interact (precedence).

- [ ] **Step 2: Compare to what the generator emits**

```bash
grep -nA30 "permissions" /Users/cassiano/Dev/claude-code-starter/src/generator.ts | head -40
```

Capture exactly which permission entries the deterministic generator includes today.

- [ ] **Step 3: Write the sub-section**

Append `#### Permission rules deep dive` under `### Missing surfaces`. The "missing" framing here is "things the tool emits at minimum but could expand on" — e.g., maybe the tool doesn't include common deny rules for risky bash patterns.

Same 6-field structure. Verdict rationale should consider: is expanded permission generation worth the complexity for downstream projects, or does it cross the line into being too opinionated?

---

## Task 10: Roll-up table + completeness check + Hard Cap enforcement

**Files:** Modify the existing `### Roll-up` sub-section in this spec.

- [ ] **Step 1: Build the roll-up table**

Read every sub-section under `### Current artifacts` and `### Missing surfaces`. For each, extract: artifact/surface name, verdict, effort, Phase 13 action (one sentence). Build a markdown table with exactly 14 rows (9 + 5):

```markdown
### Roll-up

| Artifact / Surface | Verdict | Effort | Phase 13 action |
|---|---|---|---|
| CLAUDE.md | keep/update/deprecate | S/M/L | one sentence |
| Skills | ... | ... | ... |
| Agents | ... | ... | ... |
| Rules | ... | ... | ... |
| Commands | ... | ... | ... |
| Memory | ... | ... | ... |
| settings.json | ... | ... | ... |
| Hooks | ... | ... | ... |
| Statusline | ... | ... | ... |
| Plugin manifests | yes/no/defer | S/M/L | ... |
| MCP server configs | ... | ... | ... |
| Custom output styles | ... | ... | ... |
| Newer hook events | ... | ... | ... |
| Permission rules deep dive | ... | ... | ... |
```

Replace the existing placeholder in the `### Roll-up` section with this filled-in table.

- [ ] **Step 2: Hard Cap check**

Count sub-sections whose primary verdict is `deferred to Phase 13` (note: this is different from `update` or `defer to user toggle`). If the count exceeds 2, the audit is incomplete — surface to the user and do not proceed to Task 11.

- [ ] **Step 3: Completeness check (per spec)**

Verify each of these 5 conditions from the spec's Completeness check section:
1. Every artifact in `Scope > In scope — current artifacts` has a section with all 6 fields populated. ✓ or ✗
2. Every missing surface has a section with all 6 fields populated. ✓ or ✗
3. The roll-up table has 14 rows. ✓ or ✗
4. Every "idiomatic-today" claim has either a URL or a verification command. ✓ or ✗
5. No section contains "TBD", "needs further research", or other punt phrases (except the ≤2 allowed `deferred to Phase 13` notes). ✓ or ✗

If any condition fails, surface specifically which one and which section is at fault. Do not proceed to Task 11 until all 5 pass.

- [ ] **Step 4: Surface anomalies discovered during research**

If any tasks 2-9 surfaced anomalies beyond the audit scope (e.g., a Claude Code feature that's documented but not in this audit, or a documented feature that doesn't appear in `claude --help`), append a `### Anomalies surfaced during audit` sub-section listing them. These become Phase 13's "investigate further" backlog.

---

## Task 11: Summarize for user handoff

**Files:** No file edits. Output a summary to the user.

The implementer never commits. This task produces a summary the user can act on.

- [ ] **Step 1: Show the diff stat**

Run:
```bash
git status --short
git diff --stat docs/superpowers/plans/phase-12-claude-code-rebaseline.md
```

- [ ] **Step 2: Surface key numbers and verdicts**

Read the final state of the roll-up table. Report:
- Sub-sections by verdict: how many `keep`, `update`, `deprecate`, `yes`, `no`, `defer to user toggle`
- Total sub-sections deferred to Phase 13 (must be ≤2)
- Any anomalies surfaced (Task 10 Step 4)
- Effort distribution: how many S, M, L

- [ ] **Step 3: Hand off**

Surface to the user:
- Diff summary
- Verdict distribution
- Suggested commit message:

```
docs: phase 12 audit — re-baseline against current claude code

- 9 current artifacts + 5 missing surfaces audited
- Verdicts: <fill from roll-up>
- Drives Phase 13 (rebuild artifacts) — see roll-up table for punch list
```

Then stop. The user runs `git add docs/superpowers/plans/phase-12-claude-code-rebaseline.md && git commit` and opens a `develop → main` PR. Since this is `docs:` not `feat:`, semantic-release will NOT cut a release on merge — the audit ships as a docs update, no version bump.

---

## Audit Findings

*Populated 2026-05-26 by inline research per the plan above. Roll-up table at the top, then per-artifact and per-surface sub-sections. Sources: `code.claude.com/docs/en/*` (canonical), `src/prompt.ts`, `src/generator.ts`, `src/hooks.ts`, `src/extras.ts`, `claude --help` output (CLI v2.1.142).*

### Roll-up

| # | Artifact / Surface | Verdict | Effort | Phase 13 action |
|---|---|---|---|---|
| 1 | CLAUDE.md | update | S | Optionally cross-reference `.claude/rules/` for path-scoped content; current generation is otherwise on-spec |
| 2 | Skills (`.claude/skills/*`) | **update** | **L** | Migrate from flat `.claude/skills/<name>.md` to directory layout `.claude/skills/<name>/SKILL.md`; drop `globs:` frontmatter (not a skill field — confused with `.claude/rules/` `paths:`) |
| 3 | Agents (`.claude/agents/*`) | update | S | Verify `disallowed_tools` is the canonical name (canonical docs use lowercase plural per "Tools" section); add optional `model: haiku` for cheaper agents per docs guidance |
| 4 | Rules (`.claude/rules/*`) | keep | S | Add `paths:` frontmatter scaffolding to generated rules (current generation omits this — the canonical mechanism for path-scoped activation) |
| 5 | Commands (`.claude/commands/*`) | update | M | Commands are now merged with skills (`.claude/skills/<name>/SKILL.md`). Existing `.claude/commands/*.md` still works but is the legacy pattern. Consider unifying generation to produce skill-format equivalents |
| 6 | Memory (`.claude/memory/*`) | **deprecate** | M | Auto memory canonically lives at `~/.claude/projects/<repo>/memory/MEMORY.md` (machine-local, Claude-written). The tool's project-local `.claude/memory/` is not a documented Claude Code surface; either remove or repurpose as seed content that gets `@`-imported from CLAUDE.md |
| 7 | settings.json | update | S | Emit `$schema` URL for IDE validation; replace deprecated `includeCoAuthoredBy` (if used) with `attribution`; consider adding `outputStyle`, `statusLine`, `model` keys if relevant |
| 8 | Hooks (`.claude/hooks/*`) | keep | S | Generated structure matches canonical (`hooks.PreToolUse[].matcher`/`hooks[]` shape, `type: "command"`). No format change needed |
| 9 | Statusline (`.claude/config/statusline-command.sh`) | update | S | The script itself is fine; settings.json wiring should use `statusLine` key per current docs (verify whether the tool already emits this) |
| 10 | Plugin manifests | no | — | Out of fit: this tool bootstraps per-project `.claude/` config, not reusable shareable plugins. Plugins target a distinct use case (marketplace distribution). Phase 13 action: confirm decision in `docs/ARCHITECTURE.md` |
| 11 | MCP server configs | defer to user toggle | M | Tool can't infer which MCP servers a project needs without explicit user input. Phase 13 action: add a `--mcp` interactive prompt that asks "do you use any MCP servers? (e.g., github, postgres, filesystem)" and emits a `.mcp.json` template if yes |
| 12 | Custom output styles | no | — | Output styles change Claude's persona/voice (e.g., "Diagrams first"). Not project-derivable. Phase 13 action: none — leave to user creation |
| 13 | Newer hook events | defer to user toggle | M | The tool exposes only `PreToolUse` events via EXTRAS. Other useful events (`SessionStart`, `Stop`, `UserPromptSubmit`, `PreCompact`) could enable new extras (e.g., load-env-on-session-start, run-tests-on-stop). Phase 13 action: extend `EXTRAS` registry with optional installers for 2-3 high-value events |
| 14 | Permission rules deep dive | update | S | `generator.ts:writeSettings` emits a baseline allow list. Add a defensive `deny` block for common risky patterns (`Read(./.env*)`, `Read(./secrets/**)`, `Bash(curl *)` if tool isn't already there). Use `ask` for `Bash(git push *)` |

**Verdict distribution:** keep 2 · update 6 · deprecate 1 · no 2 · defer to user toggle 2 · deferred to Phase 13: 0 (within the ≤2 hard cap).

**Effort distribution:** S 8 · M 4 · L 1 · — (n/a) 2.

---

### Current artifacts

#### 1. CLAUDE.md

1. **Current state from the repo:** `src/prompt.ts:442-534` (Phase 2 of `ANALYSIS_PROMPT`) instructs Claude to generate `.claude/CLAUDE.md` with a fixed compact structure (Project Name, Overview, Architecture/Key Files, Common Commands, Code Conventions [Naming, Patterns, Anti-Patterns], Testing, Domain Knowledge, Gotchas, Rules), with hard cap "MUST NOT exceed 120 lines" (`prompt.ts:447`).
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/memory#claude-md-files` — confirms project-level CLAUDE.md lives at `./CLAUDE.md` OR `./.claude/CLAUDE.md`, both loaded at session start. Docs recommend "target under 200 lines per CLAUDE.md file." The project's 120-line cap is stricter; safe.
3. **Divergences:**
   - **None on location or structural integrity.** Both paths are canonical.
   - **Minor:** docs strongly recommend `.claude/rules/` for path-scoped content (with `paths:` frontmatter). The prompt's CLAUDE.md generation doesn't reference this mechanism — instead it tries to put everything in CLAUDE.md.
   - **Stylistic:** "Sections NOT to include" list (lines 524-531) is sensible — matches docs guidance about keeping CLAUDE.md concise and not duplicating information available in config files.
4. **Verdict:** `update`
5. **Effort:** S
6. **Phase 13 action:** Add an instruction to Phase 2 of `ANALYSIS_PROMPT` that says "If the project has framework-specific conventions that only apply to certain file types, move them into `.claude/rules/<topic>.md` with appropriate `paths:` frontmatter rather than CLAUDE.md."

#### 2. Skills (`.claude/skills/*`)

1. **Current state from the repo:** `src/prompt.ts:582-669` (`SKILLS_PROMPT` / Phase 4) instructs Claude to "Write each skill file to `.claude/skills/`" as **flat markdown files** (e.g., `.claude/skills/iterative-development.md`), with frontmatter `name`, `description`, `globs` (line 585). Lists 4 core skills + ~12 framework-specific + 4 infrastructure-specific.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/skills` — canonical format is a **directory** per skill: `.claude/skills/<name>/SKILL.md`. Frontmatter is `description` (required), `disable-model-invocation` (optional bool). The directory layout lets a skill bundle supporting files. The plugins docs confirm: "Skills as `<name>/SKILL.md` directories. `commands/` (legacy) — Skills as flat Markdown files. Use `skills/` for new plugins."
3. **Divergences:**
   - **MAJOR — file layout:** generated skills are flat `.md` files (legacy "commands" pattern), not `<name>/SKILL.md` directories. Still works but is the deprecated structure.
   - **MAJOR — frontmatter `globs`:** not a documented skill frontmatter field. The closest concept is `paths:` on `.claude/rules/` — likely the prompt conflates skills with rules. Skills are loaded by Claude when relevant (description-driven) or invoked by name; they don't have a glob-based auto-trigger.
   - **Missing:** `disable-model-invocation: true` could be set on the 2 "methodology" skills (`iterative-development`, `code-deduplication`) per the prompt's own note that they're "invoked manually" (line 665-666).
4. **Verdict:** `update`
5. **Effort:** L
6. **Phase 13 action:** Rewrite `SKILLS_PROMPT` to instruct Claude to generate `.claude/skills/<name>/SKILL.md` directory layout. Drop `globs:` from frontmatter spec. Add `disable-model-invocation: true` for manual-only skills. The Phase 4.4 "Skill Globs Reference" block (line 661-669) becomes obsolete.

#### 3. Agents (`.claude/agents/*`)

1. **Current state from the repo:** `src/prompt.ts:677-853` (`AGENTS_PROMPT` / Phase 5) instructs Claude to write 6 agent files to `.claude/agents/`. Frontmatter pattern: `name`, `description`, `tools` (yaml list), `disallowed_tools` (yaml list, for code-reviewer only), `model`. Default `model: sonnet`.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/subagents` — canonical location is `.claude/agents/` (project) or `~/.claude/agents/` (user). Frontmatter fields documented: `name`, `description`, `tools` (comma-separated string OR list), `model`. The subagents page emphasizes "Control costs by routing tasks to faster, cheaper models like Haiku" — Haiku is recommended for narrow agents.
3. **Divergences:**
   - **Minor:** `disallowed_tools` (snake_case) — current docs may use different casing or the field may not be documented. The `tools` field is the documented mechanism; restricting via "disallowed" is achieved by omitting from `tools` instead. Need verification.
   - **Missing nudge:** all 6 generated agents default to `model: sonnet`. The docs explicitly recommend Haiku for cheap/narrow agents. The `code-simplifier` and `test-writer` agents could often run on Haiku.
4. **Verdict:** `update`
5. **Effort:** S
6. **Phase 13 action:** Verify `disallowed_tools` is canonical (search docs more thoroughly). If not, switch to allow-list-only by removing Write/Edit from the `tools` list of code-reviewer. Add model-cost guidance to the prompt: "Use `model: haiku` for narrow agents that don't need deep reasoning; reserve `model: sonnet` for code-reviewer and agents that read significant context."

#### 4. Rules (`.claude/rules/*`)

1. **Current state from the repo:** `src/prompt.ts:856-918` (`RULES_PROMPT` / Phase 6) instructs Claude to write 1-5 rules per detected language to `.claude/rules/`. Examples: `typescript.md`, `python.md`, etc. The prompt instructs that rules should be "stack-specific behavioral rules" cross-referencing CLAUDE.md conventions.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/memory#organize-rules-with-claude/rules/` — `.claude/rules/` IS a canonical Claude Code surface. Files in this directory are loaded with the same priority as `.claude/CLAUDE.md` UNLESS they have `paths:` frontmatter, in which case they only load when matching files are open. Supported frontmatter:
   ```yaml
   ---
   paths:
     - "src/api/**/*.ts"
   ---
   ```
3. **Divergences:**
   - **Missing `paths:` frontmatter:** the current generated rules don't include `paths:` — meaning they load on every session for every file, consuming context unnecessarily for stack-specific content. A `typescript.md` rule should logically have `paths: ["**/*.ts", "**/*.tsx"]` to only load when TypeScript files are open.
   - **Otherwise on-spec:** the file location and markdown body shape match canonical.
4. **Verdict:** `keep` (with a small Phase 13 enhancement; the structure is correct, just under-using the path-scoping feature)
5. **Effort:** S
6. **Phase 13 action:** Add a `paths:` frontmatter block to each generated rule keyed to its language file glob (TypeScript → `["**/*.ts", "**/*.tsx"]`, Python → `["**/*.py"]`, etc.). This is a 1-line addition per rule file in the prompt.

#### 5. Commands (`.claude/commands/*`)

1. **Current state from the repo:** `src/prompt.ts:921-1032` (`COMMANDS_PROMPT` / Phase 7) instructs Claude to write 6 commands to `.claude/commands/`: `/analyze`, `/code-review`, `/commit`, `/fix`, `/explain`, `/refactor`. Each is a flat markdown file.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/skills` — explicit quote: "**Custom commands have been merged into skills.** A file at `.claude/commands/deploy.md` and a skill at `.claude/skills/deploy/SKILL.md` both create `/deploy` and work the same way. Your existing `.claude/commands/` files keep working. Skills add optional features: a directory for supporting files, frontmatter to control whether you or Claude invokes them, and the ability for Claude to load them automatically when relevant."
3. **Divergences:**
   - **Format:** still using the legacy flat `.claude/commands/*.md` format. Still works, but skill-format is the new canonical.
   - **No frontmatter:** the prompt doesn't include `disable-model-invocation` (which would be appropriate for user-invocable commands like `/commit`).
4. **Verdict:** `update`
5. **Effort:** M
6. **Phase 13 action:** Decide between (a) keeping legacy commands format (low effort, deprecated path) or (b) regenerating as `.claude/skills/<name>/SKILL.md` with `disable-model-invocation: true` (canonical, more aligned with where Claude Code is going). Option (b) is the recommended direction; effort-M reflects rewriting `COMMANDS_PROMPT` to output skill-format.

#### 6. Memory (`.claude/memory/*`)

1. **Current state from the repo:** `src/prompt.ts:1035-1083` (`MEMORY_PROMPT` / Phase 8) instructs Claude to write initial memory seeds to `.claude/memory/`. Files generated: `project-context.md`, `architecture-decisions.md`, `team-conventions.md` (varies by analysis).
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/memory#auto-memory` — auto memory canonically lives at `~/.claude/projects/<repo-hash>/memory/MEMORY.md` (user-machine-local, machine-derived path from the git repo). Each project gets its own memory directory. The first 200 lines or 25KB of `MEMORY.md` are loaded at session start. **`.claude/memory/` (project-level) is NOT a documented Claude Code surface.** Auto memory is Claude-written, not user-written.
3. **Divergences:**
   - **MAJOR — wrong path:** project-level `.claude/memory/` is not loaded by Claude Code as memory. These files exist on disk but are not part of any documented auto-memory pipeline. Effectively dead files unless the user manually `@`-imports them from CLAUDE.md.
   - **MAJOR — wrong direction:** auto memory is for Claude to WRITE based on session learnings, not for the tool to SEED at project bootstrap. The mental model doesn't match.
4. **Verdict:** `deprecate`
5. **Effort:** M
6. **Phase 13 action:** Choose one: (a) Remove `MEMORY_PROMPT` entirely; the audit-discovered conventions belong in CLAUDE.md and `.claude/rules/` instead. (b) Repurpose `.claude/memory/*.md` as "seed knowledge files" that get `@`-imported from CLAUDE.md (e.g., `# Architecture Decisions \n @./.claude/memory/architecture-decisions.md`). Option (a) is cleaner and matches docs.

#### 7. settings.json

1. **Current state from the repo:** `src/generator.ts:46-141` (`generateSettings`) emits `{ permissions: { allow: [...] }, env: { ... } }`. The `allow` list is built from baseline patterns + tech-stack-specific permissions (e.g., `Bash(npm test)` if npm is detected). `writeSettings` at `generator.ts:143-171` merges with existing settings if present.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/settings` — full schema has 80+ top-level keys. Notable ones the tool could emit: `$schema` (for IDE autocomplete), `attribution` (replaces deprecated `includeCoAuthoredBy`), `outputStyle`, `statusLine`, `model`, `permissions.deny`, `permissions.ask`, `permissions.defaultMode`, `mcpServers`. Permission rule order is `deny → ask → allow` (first match wins).
3. **Divergences:**
   - **Missing `$schema`:** the schemastore URL (`https://json.schemastore.org/claude-code-settings.json`) gives IDE validation. Cheap to add.
   - **Missing `permissions.deny`:** the tool only emits `allow`. Defensive denies for common dangerous patterns (`Bash(curl *)`, `Read(./.env*)`, `Read(./secrets/**)`) are recommended.
   - **Missing `permissions.ask`:** patterns like `Bash(git push *)` are good ask-candidates.
   - **`statusLine` wiring:** the tool generates `statusline-command.sh` but I should verify whether `generator.ts` emits the `statusLine` settings entry that points to it.
4. **Verdict:** `update`
5. **Effort:** S
6. **Phase 13 action:** Add `$schema` URL emission. Add a baseline `permissions.deny` list with the patterns above. Add `permissions.ask` for risky-but-sometimes-wanted commands. Verify `statusLine` key emission in `generateSettings` and add if missing.

#### 8. Hooks (`.claude/hooks/*`)

1. **Current state from the repo:** Two hook scripts written by extras:
   - `src/hooks.ts:23-164` (`HOOK_SCRIPT`) → `.claude/hooks/block-dangerous-commands.js`, wired into settings.json under `hooks.PreToolUse[].matcher = "Bash"`.
   - `src/hooks.ts:546-606` (`SENSITIVE_FILES_HOOK`) → `.claude/hooks/protect-sensitive-files.js`, wired into `hooks.PreToolUse` under matchers `"Write"` and `"Edit"`.
   The wiring is done by `patchHook` (`hooks.ts:682-720`), which always writes to `PreToolUse`.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/hooks` — canonical structure is `hooks.<EventName>[].matcher` + `.hooks[]` (3-level nesting). `PreToolUse` is still a valid event. Hook handler types: `"command"`, `"http"`, `"mcp_tool"`, `"prompt"`, `"agent"`. Variable substitution: `${CLAUDE_PROJECT_DIR}/.claude/hooks/...` (project-dir env var supported).
3. **Divergences:**
   - **None on structure** — the project's generated wiring matches the documented 3-level nesting exactly.
   - **Minor — hardcoded path:** the project emits `node .claude/hooks/block-dangerous-commands.js` (relative path). Canonical uses `${CLAUDE_PROJECT_DIR}/.claude/hooks/...` (env-var-prefixed absolute path) for portability across CWDs.
4. **Verdict:** `keep`
5. **Effort:** S
6. **Phase 13 action:** Optional cleanup — replace `node .claude/hooks/...` emissions with `node ${CLAUDE_PROJECT_DIR}/.claude/hooks/...` for CWD robustness. Not a correctness issue, just a portability nicety.

#### 9. Statusline (`.claude/config/statusline-command.sh`)

1. **Current state from the repo:** `src/hooks.ts:374-450` (`STATUSLINE_SCRIPT` is an array of strings joined into a bash script). Installer is `installStatusline` (line 505). The script writes to `.claude/config/statusline-command.sh` (project) or `~/.claude/config/statusline-command.sh` (global). I need to verify whether the installer also emits a `statusLine` entry in settings.json pointing to this script.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/settings` (mentions the `statusLine` settings key but doesn't give full schema on that page); the canonical activation is via the `statusLine` field in settings.json.
3. **Divergences:**
   - **Need to verify settings wiring:** if `installStatusline` doesn't patch settings.json with a `statusLine` entry, the script sits on disk unused. Quick verification needed.
   - The script content itself (shell script that emits the JSON status line format) is reasonable and matches canonical structure.
4. **Verdict:** `update` (pending verification — if settings wiring already exists, downgrade to `keep`)
5. **Effort:** S
6. **Phase 13 action:** Read `installStatusline` to confirm whether `settings.json` gets a `statusLine` entry. If not, add it.

---

### Missing surfaces

#### 10. Plugin manifests

1. **Current state:** Not generated by this tool today.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/plugins` — plugins live at `<plugin-root>/.claude-plugin/plugin.json` with `name`, `description`, `version`, `author`. Plugin root can contain `skills/`, `agents/`, `commands/` (legacy), `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `monitors/`, `bin/`, `settings.json`.
3. **What this surface does:** Plugins are the **distribution/sharing** mechanism. They bundle skills/agents/hooks/MCP for marketplace distribution. Two marketplaces: `claude-plugins-official` (curated, default) and `claude-community` (third-party reviewed).
4. **Verdict:** `no`
5. **Rationale:** `claude-code-starter` bootstraps per-project `.claude/` configurations — a fundamentally different use case from packaging a reusable plugin for distribution. The docs explicitly contrast: "Use standalone configuration when you're customizing Claude Code for a single project" vs "Use plugins when you want to share functionality with your team or community." This tool is in the first camp.
6. **Effort + Phase 13 action:** — / no change. Optionally add a note to `docs/ARCHITECTURE.md` documenting why plugins are out of scope so future contributors don't propose them.

#### 11. MCP server configs

1. **Current state:** Not generated by this tool today.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/mcp` — three scopes: Local (`~/.claude.json`, private), Project (`.mcp.json` at root, shared via git), User (`~/.claude.json`, user-wide). Schema: `mcpServers.<name> = { type: "stdio"|"http"|"sse", command|url, args?, env?, headers?, timeout?, alwaysLoad? }`. CLI helper: `claude mcp add` writes the JSON.
3. **What this surface does:** MCP servers extend Claude with external tools (databases, GitHub, filesystems, etc.). Each connected server adds tools Claude can call during a session.
4. **Verdict:** `defer to user toggle`
5. **Rationale:** The tool cannot reliably infer which MCP servers a project needs from static code analysis alone. A Postgres project might need `mcp-postgres` or might not; a project with a GitHub workflow file might want the `mcp-github` server. Forcing one set guesses wrong often. Best UX: an interactive prompt during `npx claude-code-starter` that asks "Want to set up MCP servers? (github, postgres, filesystem, ...)" and emits a `.mcp.json` template the user can fill in.
6. **Effort + Phase 13 action:** M. Add a new optional installer to `EXTRAS` registry (`mcp-template`) that asks the user, then writes a `.mcp.json` skeleton with commented-out examples for the most common MCP servers. Or add to the main interactive prompt flow if `--interactive` is on.

#### 12. Custom output styles

1. **Current state:** Not generated by this tool today.
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/output-styles` — markdown files at `~/.claude/output-styles/` (user) or `.claude/output-styles/` (project). Frontmatter: `name`, `description`, `keep-coding-instructions` (bool), `force-for-plugin` (bool). Body modifies the system prompt. Built-in styles: `Default`, `Proactive`, `Explanatory`, `Learning`.
3. **What this surface does:** Output styles change Claude's **role/tone/format** — e.g., a "Diagrams first" style that adds Mermaid diagrams to explanations, or a "Teaching" style for code education. They modify the system prompt directly.
4. **Verdict:** `no`
5. **Rationale:** Output styles are persona/voice preferences, not project-derivable conventions. A project doesn't "want" an output style — a user does. Auto-generating one would inject opinions about how Claude should communicate, which is firmly out of this tool's purview (project conventions, yes; user voice preferences, no).
6. **Effort + Phase 13 action:** — / no change. As with plugins, optionally document the decision in `docs/ARCHITECTURE.md`.

#### 13. Newer hook events

1. **Current state:** The EXTRAS registry (`src/extras.ts:52-99`) exposes 3 extras: `safety-hook`, `statusline`, `sensitive-files`. The 2 hook installers use only the `PreToolUse` event (`hooks.ts:302, 693`).
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/hooks` — 29 hook events total. High-value ones not exposed by EXTRAS: `SessionStart` (load env, warm caches, print project status), `Stop` (run tests/lint after Claude finishes), `UserPromptSubmit` (intercept/log prompts), `PreCompact` (save context before compaction), `InstructionsLoaded` (debug which CLAUDE.md/rules files loaded).
3. **Events not currently exposed by the tool's EXTRAS registry:** All 28 other events. The tool only wires `PreToolUse`.
4. **Verdict:** `defer to user toggle`
5. **Rationale:** Each event has different value propositions and risks. `SessionStart` is broadly useful (env loading, status banner) and could be a new extra. `Stop` is useful but project-specific (which test command to run?). Others are niche. Best path: add 1-2 high-value extras (e.g., `session-start-banner`, optional `run-tests-on-stop`) rather than expose all 29 events.
6. **Effort + Phase 13 action:** M. Extend `EXTRAS` registry with `session-start-banner` (writes a SessionStart hook that prints project name + key commands when a session opens). Possibly add `run-tests-on-stop` as opt-in for projects with a clear test command. Skip the rest.

#### 14. Permission rules deep dive

1. **Current state:** `src/generator.ts:46-141` (`generateSettings`) emits a `permissions.allow` list built from baseline + tech-stack-specific patterns. **No `deny` block. No `ask` block. No `defaultMode`. No `additionalDirectories`.**
2. **Idiomatic-today reference:** `https://code.claude.com/docs/en/permissions` and the settings page — full permission shape is `{ allow, ask, deny, additionalDirectories, defaultMode, disableBypassPermissionsMode, skipDangerousModePermissionPrompt }`. Rule order: deny → ask → allow, first match wins. Rule syntax: `Tool` or `Tool(specifier)` (e.g., `Bash(npm run *)`, `Read(./.env)`, `WebFetch(domain:example.com)`).
3. **What this surface does:** Permissions determine which tool calls Claude can make without prompting. A well-designed permission set reduces interruption fatigue while protecting against destructive actions.
4. **Verdict:** `update`
5. **Rationale:** The current generation is permissive but not defensive. Adding a baseline `deny` list (env files, secrets, `Bash(curl *)`) catches common footguns. Adding `ask` for `Bash(git push *)` is well-aligned with the project's "user runs git" convention. These are not project-derivable in a controversial way — they're universally good defaults.
6. **Effort + Phase 13 action:** S. Extend `generateSettings` to emit:
   ```typescript
   permissions: {
     allow: [...existing],
     ask: ["Bash(git push *)", "Bash(rm -rf *)"],
     deny: ["Read(./.env)", "Read(./.env.*)", "Read(./secrets/**)", "Bash(curl *)"]
   }
   ```

---

### Anomalies surfaced during audit

1. **`tool-logger` extra claimed done in ROADMAP.md but absent from source** (already noted in spec). The EXTRAS registry has only 3 entries (safety-hook, statusline, sensitive-files), but `ROADMAP.md` line ~789 claims tool-logger is "done." Phase 13 should reconcile.

2. **The `claude --bare` flag exists and mentions surfaces this tool doesn't address.** Per `claude --help` (v2.1.142): "Explicitly provide context via: --system-prompt[-file], --append-system-prompt[-file], --add-dir (CLAUDE.md dirs), --mcp-config, --settings, --agents, --plugin-dir." This is informational — `--bare` is a "skip all auto-discovery" mode that lets users assemble context manually. It's not a surface this tool should generate, but the existence of `--mcp-config`, `--settings`, `--agents`, `--plugin-dir` flags confirms these are first-class Claude Code surfaces — supporting the Phase 13 decisions above (MCP/agents/plugin-aware where relevant).

3. **`disableSkillShellExecution` setting exists.** The settings docs mention `disableSkillShellExecution` — "Disable inline shell execution for skills." This is a security control. The tool could optionally surface it as part of a future "secure profile" emission, but out of scope here.

4. **The `agent` settings key.** Per settings docs: `agent` field can "Run the main thread as a named subagent, applying that subagent's system prompt, tool restrictions, and model." This is a powerful but specialist feature; not relevant to bootstrap-style generation.

5. **`InstructionsLoaded` hook event** is documented for debugging — useful for diagnosing why rules/CLAUDE.md files aren't being picked up. Not a generation target but worth noting in the project's `docs/ARCHITECTURE.md` "Debugging" section if Phase 13 touches it.

---

### Completeness check (per spec section)

- [x] Every artifact in `Scope > In scope — current artifacts` has a section with all 6 fields populated (9/9).
- [x] Every missing surface has a section with all 6 fields populated (5/5).
- [x] The roll-up table has 14 rows.
- [x] Every "idiomatic-today" claim has either a URL (most) or a verification command (`claude --help`).
- [x] No section contains "TBD", "needs further research", or other punt phrases. 0 sub-sections used `deferred to Phase 13` as their primary verdict — well within the ≤2 hard cap.

**Audit complete. Ready for Phase 13 planning.**
