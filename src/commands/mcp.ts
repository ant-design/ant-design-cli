import type { Command } from 'commander';
import type { GlobalOptions } from '../types.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { detectVersion } from '../data/version.js';
import { TOOL_DEFINITIONS, createToolHandler } from '../mcp/tools.js';
import { ANTD_EXPERT_PROMPT, ANTD_PAGE_GENERATOR_PROMPT } from '../mcp/prompts.js';

declare const __CLI_VERSION__: string;

export function registerMcpCommand(program: Command): void {
  program
    .command('mcp')
    .description(
      'Start MCP (Model Context Protocol) server for AI assistant integration.\n' +
      'Not meant to be run directly. Configure your AI tool with:\n' +
      '  { "mcpServers": { "antd": { "command": "npx", "args": ["-y", "@ant-design/cli", "mcp"] } } }',
    )
    .action(/* v8 ignore start */ async () => {
      if (process.stdin.isTTY) {
        console.error('Ant Design MCP Server');
        console.error('');
        console.error('This command starts an MCP (Model Context Protocol) server that communicates via stdio.');
        console.error('It is not meant to be run directly in a terminal.');
        console.error('');
        console.error('To use it, configure your AI tool with:');
        console.error('');
        console.error('  {');
        console.error('    "mcpServers": {');
        console.error('      "antd": {');
        console.error('        "command": "npx",');
        console.error('        "args": ["-y", "@ant-design/cli", "mcp"]');
        console.error('      }');
        console.error('    }');
        console.error('  }');
        console.error('');
        console.error('Supported tools: Claude Code, Cursor, VS Code, Codex, etc.');
        console.error('');
        console.error('Starting MCP server on stdio...');
        console.error('');
      }

      const opts = program.opts<GlobalOptions>();
      const versionInfo = detectVersion(opts.version);

      const server = new Server(
        { name: 'antd', version: __CLI_VERSION__ },
        { capabilities: { tools: {}, prompts: {} } },
      );

      const handleTool = createToolHandler({
        version: versionInfo.version,
        lang: opts.lang,
      });

      server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: TOOL_DEFINITIONS,
      }));

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: params } = request.params;
        return handleTool(name, (params as Record<string, unknown>) ?? {});
      });

      server.setRequestHandler(ListPromptsRequestSchema, async () => ({
        prompts: [
          {
            name: 'antd-expert',
            description: 'General Ant Design expert assistant prompt',
          },
          {
            name: 'antd-page-generator',
            description: 'Ant Design page generation assistant prompt',
          },
        ],
      }));

      server.setRequestHandler(GetPromptRequestSchema, async (request) => {
        const { name } = request.params;
        if (name === 'antd-expert') {
          return {
            messages: [{ role: 'user' as const, content: { type: 'text' as const, text: ANTD_EXPERT_PROMPT } }],
          };
        }
        if (name === 'antd-page-generator') {
          return {
            messages: [{ role: 'user' as const, content: { type: 'text' as const, text: ANTD_PAGE_GENERATOR_PROMPT } }],
          };
        }
        throw new Error(`Unknown prompt: ${name}`);
      });

      const transport = new StdioServerTransport();
      await server.connect(transport);
    } /* v8 ignore stop */);

}
