---
name: antd
description: >
  Use when the user's task involves Ant Design (antd) — writing antd components,
  debugging antd issues, querying antd APIs/props/tokens/demos, migrating between
  antd versions, or analyzing antd usage in a project. Triggers on antd-related
  code, imports from 'antd', or explicit antd questions.
allowed-tools:
  - Bash(antd *)
  - Bash(antd bug*)
  - Bash(antd bug-cli*)
  - Bash(npm install -g @ant-design/cli*)
  - Bash(which antd)
---

# Ant Design CLI

You have access to `@ant-design/cli` — a local CLI tool with bundled antd metadata for v4/v5/v6. Use it to query component knowledge, analyze projects, and guide migrations. All data is offline, no network needed.

## Setup

Before first use, check if the CLI is installed. If not, install it automatically:

```bash
which antd || npm install -g @ant-design/cli
```


**Always use `--format json` for structured output you can parse programmatically.**

## Scenarios

### 1. Writing antd component code

Before writing any antd component code, look up its API first — don't rely on memory.

```bash
# Check what props are available
antd info Button --format json

# Get a working demo as starting point
antd demo Button basic --format json

# Check semantic classNames/styles for custom styling
antd semantic Button --format json

# Check component-level design tokens for theming
antd token Button --format json
```

**Workflow:** `antd info` → understand props → `antd demo` → grab a working example → write code.

### 2. Looking up full documentation

When you need comprehensive component docs (not just props):

```bash
antd doc Table --format json        # full markdown docs for Table
antd doc Table --lang zh            # Chinese docs
```

### 3. Debugging antd issues

When code isn't working as expected or the user reports an antd bug:

```bash
# Check if the prop exists for the user's antd version
antd info Select --version 5.12.0 --format json

# Check if the prop is deprecated
antd lint ./src/components/MyForm.tsx --format json

# Diagnose project-level configuration issues
antd doctor --format json
```

**Workflow:** `antd doctor` → check environment → `antd info --version X` → verify API against the user's exact version → `antd lint` → find deprecated or incorrect usage.

### 4. Migrating between versions

When the user wants to upgrade antd (e.g., v4 → v5):

```bash
# Get full migration checklist
antd migrate 4 5 --format json

# Check migration for a specific component
antd migrate 4 5 --component Select --format json

# See what changed between two versions
antd changelog 4.24.0 5.0.0 --format json

# See changes for a specific component
antd changelog 4.24.0 5.0.0 Select --format json
```

**Workflow:** `antd migrate` → get full checklist → `antd changelog <v1> <v2>` → understand breaking changes → apply fixes → `antd lint` → verify no deprecated usage remains.

### 5. Analyzing project antd usage

When the user wants to understand how antd is used in their project:

```bash
# Scan component usage statistics
antd usage ./src --format json

# Filter to a specific component
antd usage ./src --filter Form --format json

# Lint for best practice violations
antd lint ./src --format json

# Check only specific rule categories
antd lint ./src --only deprecated --format json
antd lint ./src --only a11y --format json
antd lint ./src --only performance --format json
```

### 6. Checking changelogs and version history

When the user asks about what changed in a version:

```bash
# Specific version changelog
antd changelog 5.22.0 --format json

# Version range (both ends inclusive)
antd changelog 5.21.0..5.24.0 --format json
```

### 7. Exploring available components

When the user is choosing which component to use:

```bash
# List all components with categories
antd list --format json

# List components for a specific antd version
antd list --version 5.0.0 --format json
```

### 8. Reporting issues

When you encounter a confirmed antd or CLI bug that can't be resolved locally, use the agentic feedback flow:

**Workflow:**
1. First diagnose using `antd doctor`, `antd info`, `antd lint`
2. If it's a genuine bug, assemble the report and preview it:

```bash
# Preview antd bug report for user review
antd bug --title "DatePicker crashes when selecting date" \
  --reproduction "https://codesandbox.io/s/xxx" \
  --steps "1. Open DatePicker 2. Click a date" \
  --expected "Date is selected" \
  --actual "Component crashes with error" \
  --format json

# Preview CLI bug report for user review
antd bug-cli --title "antd info shows wrong props for Select" \
  --description "Running antd info Select shows incorrect data" \
  --steps "1. Run antd info Select --version 5.0.0" \
  --expected "Shows 5.0.0 props" \
  --actual "Shows latest props instead" \
  --format json
```

3. Show the assembled issue content to the user and ask for confirmation
4. After user confirms, submit:

```bash
# Submit antd bug
antd bug --title "DatePicker crashes when selecting date" \
  --reproduction "https://codesandbox.io/s/xxx" \
  --steps "1. Open DatePicker 2. Click a date" \
  --expected "Date is selected" \
  --actual "Component crashes with error" \
  --submit

# Submit CLI bug
antd bug-cli --title "antd info shows wrong props for Select" \
  --description "Running antd info Select shows incorrect data" \
  --steps "1. Run antd info Select --version 5.0.0" \
  --expected "Shows 5.0.0 props" \
  --actual "Shows latest props instead" \
  --submit
```

**Key rules:**
- Always diagnose first before reporting — don't report issues that can be resolved locally
- Always preview and get user confirmation before submitting with `--submit`
- Include reproduction links when possible for antd bugs
- Provide clear, specific steps to reproduce

## Global Flags

| Flag | Purpose |
|---|---|
| `--format json` | Structured output — always use this |
| `--version <v>` | Target a specific antd version (e.g. `5.20.0`) |
| `--lang zh` | Chinese output (default: `en`) |
| `--detail` | Include extra fields (description, since, deprecated, FAQ) |

## Key Rules

1. **Always query before writing** — Don't guess antd APIs from memory. Run `antd info` first.
2. **Match the user's version** — If the project uses antd 4.x, pass `--version 4.24.0`. The CLI auto-detects from `node_modules` if no flag is given.
3. **Use `--format json`** — Every command supports it. Parse the JSON output rather than regex-matching text output.
4. **Check before suggesting migration** — Run `antd changelog <v1> <v2>` and `antd migrate` before advising on version upgrades.
5. **Lint after changes** — After writing or modifying antd code, run `antd lint` on the changed files to catch deprecated or problematic usage.
6. **Report bugs through the CLI** — When you encounter an antd or CLI bug that can't be resolved, use `antd bug` / `antd bug-cli` to report it. Always preview first, get user confirmation, then submit.
