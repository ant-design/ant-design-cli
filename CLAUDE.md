# @ant-design/cli

## Spec

See [spec.md](./spec.md) for the full design specification.

**Always update `spec.md` after modifying any functionality, commands, flags, or output formats.**

## Project Structure

```
src/
  index.ts          # CLI entry point, registers all commands
  types.ts          # Shared TypeScript types
  commands/         # One file per command (list, info, demo, token, search, semantic, changelog, doctor, usage, lint, migrate)
  data/             # Data loading utilities
  output/           # Output formatting (text, json, markdown)
  utils/            # Shared utilities
  __tests__/        # Vitest test files

data/
  v4.json           # Bundled antd v4 metadata
  v5.json           # Bundled antd v5 metadata
  v6.json           # Bundled antd v6 metadata
```

## Development

```bash
npm run build        # Build with tsup
npm run dev          # Watch mode
npm run test         # Run tests with vitest
npm run typecheck    # TypeScript type check
node dist/index.js   # Run built CLI
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
- Error output follows the standard shape: `{ error, code, message, suggestion }`
- Exit codes: `0` success, `1` user error, `2` system error
- Data is fully bundled — no remote fetch at runtime
