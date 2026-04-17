# Opt-Out Auto-Report Design

**Date:** 2026-04-17
**Issue:** [ant-design/ant-design-cli#82](https://github.com/ant-design/ant-design-cli/issues/82)

## Problem

The `skills/antd/SKILL.md` file instructs AI assistants to **proactively** report CLI bugs via `antd bug-cli` (section 10: "Auto-reporting CLI issues"). This feels like automatic bug reporting to users who don't want it — the AI initiates the report without the user asking.

Quote from SKILL.md:

> **IMPORTANT: Whenever you use any `antd` CLI command and notice something wrong, you should proactively initiate a bug report using `antd bug-cli`.**

This creates a mismatch: the CLI `bug`/`bug-cli` commands are opt-in (require `--submit`), but the SKILL.md overrides that by instructing the AI to proactively suggest filing reports.

## Design

### 1. Change `antd bug-cli` reporting to user-initiated only

Align section 10 ("Auto-reporting CLI issues") with section 9 ("Reporting antd bugs"):

- **Before:** AI proactively detects issues and initiates bug reports
- **After:** AI only suggests reporting when the user explicitly asks or complains about a problem

Remove all "proactively" / "IMPORTANT" / "you should" language from section 10. Rewrite as "Reporting CLI issues" — a reference for how to report when the user wants to.

### 2. Add `ANTD_NO_AUTO_REPORT` opt-out environment variable

Add a global opt-out mechanism:

- **Environment variable:** `ANTD_NO_AUTO_REPORT=1`
- **Effect:** When set, the SKILL.md instructs AI assistants to skip all bug-reporting suggestions entirely — no `antd bug` or `antd bug-cli` guidance
- **Scope:** Applies to both section 9 (antd bugs) and section 10 (CLI bugs)

In the SKILL.md, add a check instruction at the top of the bug-reporting sections:

```
If the environment variable `ANTD_NO_AUTO_REPORT=1` is set, skip all bug-reporting suggestions below.
```

### 3. Update MCP prompt

In `src/mcp/prompts.ts`, add a rule to `SHARED_TOOL_WORKFLOW`:

```
- Do not suggest filing bug reports (antd bug / antd bug-cli) unless the user explicitly asks. If the user has set ANTD_NO_AUTO_REPORT=1, never suggest reporting.
```

### 4. Update spec.md

Add documentation for the `ANTD_NO_AUTO_REPORT` environment variable in the spec under the "Environment Variables" / "Update Check" section.

### 5. Update Key Rules in SKILL.md

- **Rule 6:** Keep as-is (already states "Always preview first, get user confirmation, then submit")
- **Rule 7:** Remove "Auto-report CLI issues — ... proactively use `antd bug-cli`". Replace with: "Report CLI issues — If a user asks about a CLI problem, use `antd bug-cli` to help them file a report."

## Files to Modify

| File | Change |
|------|--------|
| `skills/antd/SKILL.md` | Rewrite section 10 as user-initiated; add opt-out env var check; update Key Rules |
| `src/mcp/prompts.ts` | Add rule about not suggesting bug reports unless user asks |
| `spec.md` | Document `ANTD_NO_AUTO_REPORT` environment variable |

## Not In Scope

- Changes to the `antd bug` / `antd bug-cli` CLI commands themselves — they already require `--submit` explicitly
- Changes to the `--submit` flag behavior
- Telemetry or analytics (none exists in the codebase)