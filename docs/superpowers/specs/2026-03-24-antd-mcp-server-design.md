# antd mcp — MCP Server Design

**Date:** 2026-03-24
**Status:** Approved

## Overview

Add `antd mcp` command that starts a Model Context Protocol (MCP) stdio server. IDEs and agents (Claude Desktop, Cursor, etc.) configure it in their `mcpServers` config, after which agents can query antd knowledge directly as MCP Tools without knowing CLI command syntax.

## Goals

- Let agents use antd knowledge via MCP protocol natively in IDE integrations
- Reuse all existing command logic — no duplicate business logic
- Focus on knowledge query tools only (not project analysis commands)

## Architecture

```
IDE / Agent
    │  MCP stdio (JSON-RPC)
    ▼
antd mcp  (long-running process, managed by IDE)
    │  reuses
    ▼
Existing command logic (info, doc, demo, list, token, semantic, changelog)
```

The process lifecycle is managed by the IDE — spawned on IDE start, killed on exit.

## MCP Tools

7 tools exposed, mapping to knowledge query commands:

| MCP Tool | Equivalent Command | Description |
|---|---|---|
| `antd_list` | `antd list` | List all components with categories |
| `antd_info` | `antd info <Component>` | Query component props API |
| `antd_doc` | `antd doc <Component>` | Get full component documentation |
| `antd_demo` | `antd demo <Component> [name]` | Get component demo source code |
| `antd_token` | `antd token [component]` | Query Design Tokens |
| `antd_semantic` | `antd semantic <Component>` | Query semantic structure (classNames/styles keys) |
| `antd_changelog` | `antd changelog` | Query version changelog |

Each tool's `description` field clearly describes when to use it, enabling agents to auto-select the right tool.

All tool outputs are JSON (reusing existing `--format json` logic).

## Global Parameters

`--version` and `--lang` are passed at server startup (not per tool call):

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

If omitted, version auto-detection and `en` lang defaults apply.

## Implementation

### Dependencies

Add `@modelcontextprotocol/sdk` — the official MCP SDK. Use `Server` + `StdioServerTransport`.

### New Files

- `src/commands/mcp.ts` — registers the `antd mcp` command, initializes the MCP Server, registers all 7 tools
- `src/mcp/tools.ts` — tool definitions (name, description, inputSchema) and handlers (call existing command logic)

### Modified Files

- `src/index.ts` — import and register the new `mcp` command
- `package.json` — add `@modelcontextprotocol/sdk` dependency

### Reuse Pattern

Each tool handler calls the existing command module's core function directly:

```typescript
// Example: antd_info tool handler
import { getComponentInfo } from '../commands/info.js';

server.tool('antd_info', schema, async ({ component, detail }) => {
  const result = await getComponentInfo(component, { detail, format: 'json', lang, version });
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});
```

This requires refactoring command modules to export their core logic as callable functions (currently they are registered as commander actions).

### Testing

New `src/__tests__/mcp.test.ts`:
- All 7 tools are registered
- Each handler returns valid JSON matching expected schema
- Error cases (component not found) return proper error structure

## Out of Scope

Project analysis commands are excluded from this version:
- `antd doctor`
- `antd usage`
- `antd lint`
- `antd migrate`
- `antd bug` / `antd bug-cli`

These can be added as MCP tools in a future version.
