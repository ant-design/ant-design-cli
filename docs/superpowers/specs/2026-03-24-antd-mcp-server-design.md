# antd mcp — MCP Server Design

**Date:** 2026-03-24
**Status:** Approved

## Overview

Add `antd mcp` command that starts a Model Context Protocol (MCP) stdio server. IDEs and agents (Claude Desktop, Cursor, etc.) configure it in their `mcpServers` config, after which agents can query antd knowledge directly as MCP Tools without knowing CLI command syntax.

## Goals

- Let agents use antd knowledge via MCP protocol natively in IDE integrations
- Reuse all existing command logic — no duplicate business logic
- Focus on knowledge query tools only (not project analysis commands)
- Provide MCP Prompts to guide LLMs on tool usage and reduce hallucination

## Architecture

```
IDE / Agent
    │  MCP stdio (JSON-RPC)
    ▼
antd mcp  (long-running process, managed by IDE)
    │  reuses
    ▼
Core logic functions extracted from command modules
(info, doc, demo, list, token, semantic, changelog)
```

The process lifecycle is managed by the IDE — spawned on IDE start, killed on exit.

## Critical Constraint: No stdout Writes in Core Logic

The MCP server uses **stdout as the JSON-RPC transport channel**. Any `console.log` or `output()` call inside core logic will corrupt the protocol. All refactored core functions must **return data as JavaScript values** — never write to stdout. Only the MCP tool handler serializes and sends data.

## Refactoring: Extract Core Logic

All 7 command modules currently embed logic inside `commander` `.action()` callbacks. These must be refactored to export standalone core functions. The commander action becomes a thin wrapper that calls the core function and passes result to `output()`.

### Extracted Function Signatures

```typescript
// src/commands/list.ts
export function listComponents(opts: { lang: string; version: string }): ComponentSummary[]

// src/commands/info.ts
export function getComponentInfo(
  component: string,
  opts: { lang: string; version: string; detail: boolean }
): ComponentInfoResult | CLIError

// src/commands/doc.ts
export function getComponentDoc(
  component: string,
  opts: { lang: string; version: string }
): ComponentDocResult | CLIError

// src/commands/demo.ts
export function getComponentDemo(
  component: string,
  opts: { lang: string; version: string; name?: string }
): DemoResult | DemoListResult | CLIError

// src/commands/token.ts
export function getTokens(
  component: string | undefined,
  opts: { lang: string; version: string }
): TokenResult | CLIError

// src/commands/semantic.ts
export function getSemanticStructure(
  component: string,
  opts: { lang: string; version: string }
): SemanticResult | CLIError

// src/commands/changelog.ts
// snapshotVersion: antd version used to load metadata (e.g. "5.20.0")
// entryFilter: optional version or range to filter entries (e.g. "5.10.0" or "5.10.0..5.20.0")
export function queryChangelog(
  opts: { snapshotVersion: string; entryFilter?: string }
): ChangelogResult | CLIError

export function diffChangelog(
  opts: { v1: string; v2: string; component?: string }
): DiffResult | CLIError
```

### Error Handling Contract

- Core functions **never call `process.exitCode`** or `process.exit()`
- On user error (component not found, etc.), return a `CLIError` object: `{ error: true, code, message, suggestion? }`
- On success, return the data object directly
- Commander wrappers check `result.error` and call `printError()` + `process.exitCode = 1`

## MCP Tools

7 tools exposed, mapping to knowledge query commands:

| MCP Tool | Core Function | Description for Agent |
|---|---|---|
| `antd_list` | `listComponents` | List all antd components with names, categories, and descriptions. Call this first to discover available components. |
| `antd_info` | `getComponentInfo` | Get props API for a specific component. Use when you need to know what props a component accepts. |
| `antd_doc` | `getComponentDoc` | Get full markdown documentation for a component including When To Use, API tables, and FAQ. |
| `antd_demo` | `getComponentDemo` | Get demo source code for a component. Omit `name` to list available demos; provide `name` to get specific demo code. |
| `antd_token` | `getTokens` | Query Design Tokens. Omit `component` for global tokens; provide `component` for component-level tokens. |
| `antd_semantic` | `getSemanticStructure` | Get semantic classNames/styles structure for a component. Use when customizing component appearance. |
| `antd_changelog` | `queryChangelog` / `diffChangelog` | Query version changelog entries or diff API changes between two versions. |

### Tool Input Schemas

**`antd_list`**
```json
{ "type": "object", "properties": {}, "required": [] }
```

**`antd_info`**
```json
{
  "type": "object",
  "properties": {
    "component": { "type": "string", "description": "Component name, e.g. \"Button\"" },
    "detail": { "type": "boolean", "description": "Include full description, since, deprecated fields" }
  },
  "required": ["component"]
}
```

**`antd_doc`**
```json
{
  "type": "object",
  "properties": {
    "component": { "type": "string", "description": "Component name, e.g. \"Table\"" }
  },
  "required": ["component"]
}
```

**`antd_demo`**
```json
{
  "type": "object",
  "properties": {
    "component": { "type": "string" },
    "name": { "type": "string", "description": "Demo name (e.g. \"basic\"). Omit to list available demos." }
  },
  "required": ["component"]
}
```

**`antd_token`**
```json
{
  "type": "object",
  "properties": {
    "component": { "type": "string", "description": "Component name. Omit for global tokens." }
  },
  "required": []
}
```

**`antd_semantic`**
```json
{
  "type": "object",
  "properties": {
    "component": { "type": "string" }
  },
  "required": ["component"]
}
```

**`antd_changelog`**
```json
{
  "type": "object",
  "properties": {
    "version": { "type": "string", "description": "Single version (\"5.10.0\") or range (\"5.10.0..5.20.0\"). Omit for last 5 entries." },
    "v1": { "type": "string", "description": "For API diff: from-version (e.g. \"4.24.0\")" },
    "v2": { "type": "string", "description": "For API diff: to-version (e.g. \"5.0.0\")" },
    "component": { "type": "string", "description": "Filter diff to a specific component" }
  },
  "required": []
}
```

### `antd_changelog` Dual-Mode Behavior and Parameter Mapping

A single `antd_changelog` tool handles both modes. The handler branches on whether `v1`+`v2` are present:

```typescript
// In antd_changelog tool handler:
if (params.v1 && params.v2) {
  // diff mode
  return diffChangelog({ v1: params.v1, v2: params.v2, component: params.component });
} else {
  // changelog query mode
  // `snapshotVersion` comes from the server-level --version flag (resolved at startup)
  // `entryFilter` maps to the `version` field in the MCP schema
  return queryChangelog({ snapshotVersion: serverVersion, entryFilter: params.version });
}
```

The `version` field in the schema is the entry filter (single version or range). The snapshot version used to load metadata is the server-level `--version` flag, not a per-call parameter.

### `antd_list` Payload Size

`antd_list` returns 100+ components. For MCP context, the response includes `name`, `nameZh`, `category`, and `description` only — no props or details. Agents should use `antd_info` or `antd_doc` for detailed component data.

## MCP Prompts

Two prompts are registered on the MCP server to guide LLMs on how to use the tools effectively. Prompts reduce hallucination and repetitive tool calls.

### `antd-expert`

General-purpose antd expert assistant. Teaches the LLM:
- Query workflow: use `antd_list` to discover components → `antd_info` for props → `antd_doc` for full docs → `antd_demo` for code examples
- Avoid duplicate tool calls for the same component in a conversation
- Always query component docs/props before generating code
- Use `antd_token` when customizing themes, `antd_semantic` when using classNames/styles

### `antd-page-generator`

Page generation focused variant. Same rules as `antd-expert` plus:
- Before generating any page code, query all relevant components' docs and examples first
- Produce complete, runnable code with all imports

### Implementation

Prompts are registered via `server.prompt()` in `src/commands/mcp.ts`. Each prompt returns a `messages` array with a single `user` role message containing the system prompt text. Prompt content is stored as constants in `src/mcp/prompts.ts`.

## MCP Error Response Format

Tool errors use the MCP-native error shape:

```typescript
return {
  content: [{ type: 'text', text: JSON.stringify(cliError) }],
  isError: true
}
```

This allows agents to distinguish tool failures from successful output while still receiving structured error info (code, message, suggestion).

## Global Parameters

`--version` and `--lang` are passed at server startup:

```json
{
  "mcpServers": {
    "antd": {
      "command": "antd",
      "args": ["mcp", "--version", "5.20.0", "--lang", "zh"]
    }
  }
}
```

**Note:** `--version` is strongly recommended for reproducible behavior. If omitted, auto-detection reads `node_modules/antd/package.json` relative to the IDE's working directory, which is environment-dependent and may not reflect the intended project.

## Implementation Plan

### New Files

- `src/commands/mcp.ts` — registers `antd mcp` command, initializes `Server` + `StdioServerTransport`, registers 7 tools and 2 prompts
- `src/mcp/tools.ts` — tool definitions and handlers
- `src/mcp/prompts.ts` — prompt content constants (`ANTD_EXPERT_PROMPT`, `ANTD_PAGE_GENERATOR_PROMPT`)

### Modified Files

- `src/commands/info.ts` — extract `getComponentInfo()`, keep commander wrapper
- `src/commands/doc.ts` — extract `getComponentDoc()`. **Critical:** current code has a direct `process.stdout.write(doc + '\n')` call at line 51 (for non-JSON text/markdown format) that bypasses the `output()` abstraction. The extracted core function must return the doc string as a value; the commander wrapper handles printing.
- `src/commands/demo.ts` — extract `getComponentDemo()`
- `src/commands/list.ts` — extract `listComponents()`
- `src/commands/token.ts` — extract `getTokens()`
- `src/commands/semantic.ts` — extract `getSemanticStructure()`
- `src/commands/changelog.ts` — extract `queryChangelog()` and `diffChangelog()`
- `src/index.ts` — register `mcp` command
- `package.json` — add `@modelcontextprotocol/sdk` as production dependency

**Note on stderr:** `console.error` and `process.stderr.write` in the codebase (used by `printError`, loader warnings) write to stderr, which is **safe** in MCP stdio transport — only stdout is the JSON-RPC channel. Core functions must never write to stdout; stderr is fine for debug/warning output.

### Build / Bundling

`tsup` currently externalizes all `dependencies`. `@modelcontextprotocol/sdk` must be listed in `package.json` `dependencies` (not devDependencies) so it is installed when users run `npm i -g @ant-design/cli`. No tsup config change needed.

### Testing

`src/__tests__/mcp.test.ts`:
- All 7 tools registered with correct names
- Each handler returns valid JSON for a known-good input
- Error case (component not found) returns `{ isError: true }` shape
- `antd_changelog` dual-mode: query mode and diff mode both work

## Out of Scope

Project analysis commands excluded from this version:
- `antd doctor`, `antd usage`, `antd lint`, `antd migrate`, `antd bug` / `antd bug-cli`
