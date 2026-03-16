# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
- **`src/utils/scan.ts`** — `collectFiles(dir)` and `parseAntdImports(content)` used by `lint` and `usage` commands

## Project Structure

```
src/
  index.ts          # CLI entry point, registers all commands
  types.ts          # Shared TypeScript types + localize() helper
  commands/         # One file per command (list, info, demo, token, semantic, changelog/diff, doctor, usage, lint, migrate)
  data/             # loader.ts, version.ts, cache.ts
  output/           # formatter.ts, error.ts
  utils/            # scan.ts (file collection + antd import parsing)
  __tests__/        # e2e CLI tests (require built dist/)

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
- Node minimum: 18+

## Key Conventions

- All commands support `--format json|text|markdown` and `--lang en|zh`
- JSON output must be machine-parseable with no decoration
- Error output follows the standard shape: `{ error, code, message, suggestion }`; errors go to stderr, normal output to stdout
- Exit codes: `0` success, `1` user error, `2` system error
- Data is fully bundled — no remote fetch at runtime
- CLI version flag is `-V` / `--cli-version` (not `--version`, which targets antd version)
- Bilingual data stored as paired fields: `description` / `descriptionZh`, use `localize(en, zh, lang)` to pick
