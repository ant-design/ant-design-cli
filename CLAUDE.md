# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Coding Principles

Principles inspired by [andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills). Bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## Core Constraints for New Features

**These are non-negotiable. Every new feature must satisfy both.**

### Multi-Version Support

Any new feature MUST support querying across multiple antd major versions (v4 / v5 / v6).

- Resolve the target version through `detectVersion()` and honor the `--version` flag — never assume a single version.
- Output and behavior must be correct for every supported major version, not just the latest.

### No Hardcoded Data

Feature data MUST NOT be hardcoded inside this CLI. It must be derived from the antd repo (or a related upstream repo) and bundled via the extraction pipeline.

- Add or extend an extractor under `scripts/extractors/` that reads from an antd source checkout; regenerate `data/v{4,5,6}.json` via `scripts/extract.ts`.
- The CLI loads bundled JSON at runtime (no remote fetch), but that JSON must be *generated from upstream*, not authored by hand.
- If the data you need doesn't exist upstream, stop and discuss — don't inline a hardcoded copy.

## Spec

See [spec.md](./spec.md) for the full design specification.

**Always update `spec.md` after modifying any functionality, commands, flags, or output formats.**

## Development

```bash
npm run build        # Build with tsup (required before running e2e tests)
npm run dev          # Watch mode
npm run test         # Run all tests with vitest
npm run typecheck    # TypeScript type check
node dist/index.js   # Run built CLI
```

To run a single test file:
```bash
npx vitest run src/__tests__/cli.test.ts
```

Note: The e2e tests in `src/__tests__/cli.test.ts` run against the built `dist/index.js` — always `npm run build` first.

## Architecture

### Data Flow

```
CLI invocation
  → src/index.ts         (parses global flags, dispatches to command)
  → src/commands/*.ts    (command logic)
  → src/data/version.ts  (resolves antd version: --flag > node_modules > package.json > fallback)
  → src/data/loader.ts   (loads data/v4.json | v5.json | v6.json)
  → src/output/          (formats output as text/json/markdown)
```

### Adding a New Command

1. Create `src/commands/<name>.ts` exporting `registerXxxCommand(program: Command): void`
2. Import and call it in `src/index.ts` under the appropriate comment block
3. Follow the pattern: read global opts via `program.opts<GlobalOptions>()`, call `detectVersion()`, load metadata, then `output()` or `printError()`

### Key Modules

- **`src/types.ts`** — All shared types (`ComponentData`, `MetadataStore`, `GlobalOptions`, `CLIError`) and the `localize()` helper for en/zh switching
- **`src/data/loader.ts`** — `loadMetadata(majorVersion)` loads bundled JSON; `findComponent()` does case-insensitive lookup
- **`src/data/version.ts`** — `detectVersion(flagVersion?)` returns `{ version, majorVersion, source }`; also exports `compare()` and `valid()` semver helpers
- **`src/output/error.ts`** — `createError()`, `printError()`, `fuzzyMatch()` (Levenshtein-based typo suggestions), and `ErrorCodes` constants
- **`src/output/formatter.ts`** — `output(data, format)` and `formatTable(headers, rows, format)` for aligned text/markdown/json tables
- **`src/utils/scan.ts`** — `collectFiles(dir)` and `getJSXElementName(node)` used by `lint` and `usage` commands

## Project Structure

```
src/
  index.ts          # CLI entry point, registers all commands
  types.ts          # Shared TypeScript types + localize() helper
  commands/         # One file per command (list, info, demo, token, semantic, changelog/diff, doctor, usage, lint, migrate, mcp)
  mcp/              # MCP server: tools.ts (7 tool definitions + handlers), prompts.ts (prompt constants)
  data/             # loader.ts, version.ts, cache.ts
  output/           # formatter.ts, error.ts
  utils/            # scan.ts (file collection + antd import parsing)
  __tests__/        # e2e CLI tests (require built dist/), unit tests in commands/ subdir

data/
  v4.json           # Bundled antd v4 metadata
  v5.json           # Bundled antd v5 metadata
  v6.json           # Bundled antd v6 metadata

scripts/
  extract.ts        # Data extraction from antd source checkout
  extractors/       # Per-data-type extractor modules
```

## Tech Stack

- TypeScript + Node.js (ESM, `"type": "module"`)
- CLI framework: `commander`
- Build: `tsup`
- Tests: `vitest`
- Node minimum: 20+

## Git Workflow

- **Never commit directly to main.** Always create a feature branch and submit a PR.

## Release Workflow

Every publish (including beta/pre-release) must follow this checklist:

1. Update `CHANGELOG.md` with a version section describing all changes
2. Run tests (`npm run test`)
3. `npm publish --otp=<code>` (add `--tag beta` for pre-releases)
4. `git tag v{version} && git push origin v{version}`
5. Create GitHub Release: `gh release create v{version} --title "v{version}" --notes "<changelog content>"` (add `--prerelease` for beta)

**CHANGELOG.md and GitHub Release notes must have identical content.** Never use auto-generated release notes — always write them manually to match the CHANGELOG.

## Testing Safety

**Tests must NEVER cause real-world side effects.** Any function that interacts with external services (GitHub API, npm registry, network requests, file system outside temp dirs, etc.) must be fully mocked in tests. Specifically:

- **`submitViaGh`**, **`checkGhAvailable`** and any function that calls `gh` CLI or creates GitHub issues must use `vi.fn()` with a safe default implementation (e.g. `vi.fn(() => false)`), **never** `vi.fn(actualFunction)` which would use the real function as fallback
- **`vi.restoreAllMocks()`** resets mocks to their default implementation — if the default is the real function, it will execute after restore. Always use safe no-op defaults in `vi.mock()` factories
- Network-calling functions (`node:https`, `fetch`, etc.) must be mocked to prevent real HTTP requests
- Tests that create temp files/directories must clean up in `finally` blocks or `afterEach`

## Key Conventions

- All commands support `--format json|text|markdown` and `--lang en|zh`
- JSON output must be machine-parseable with no decoration
- Error output follows the standard shape: `{ error, code, message, suggestion }`; errors go to stderr, normal output to stdout
- Exit codes: `0` success, `1` user error, `2` system error
- Data is fully bundled — no remote fetch at runtime
- CLI version flag is `-V` / `--cli-version` (not `--version`, which targets antd version)
- Bilingual data stored as paired fields: `description` / `descriptionZh`, use `localize(en, zh, lang)` to pick
