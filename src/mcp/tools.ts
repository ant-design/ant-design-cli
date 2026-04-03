import { listComponents } from '../commands/list.js';
import { getComponentInfo } from '../commands/info.js';
import { getComponentDoc } from '../commands/doc.js';
import { getComponentDemo } from '../commands/demo.js';
import { getTokens } from '../commands/token.js';
import { getSemanticStructure } from '../commands/semantic.js';
import { queryChangelog, diffChangelog } from '../commands/changelog.js';
import { createError, ErrorCodes } from '../output/error.js';

export interface McpContext {
  version: string;
  lang: string;
}

function toMcpResult(data: unknown) {
  if (data && typeof data === 'object' && 'error' in data && (data as { error: unknown }).error === true) {
    return { content: [{ type: 'text' as const, text: JSON.stringify(data) }], isError: true };
  }
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

/** Common annotations for all antd tools: read-only, non-destructive, idempotent, no external access. */
const TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export const TOOL_DEFINITIONS = [
  {
    name: 'antd_list',
    description: 'List all available antd components with names, categories, and descriptions.',
    inputSchema: {
      type: 'object' as const,
      properties: {},
      required: [] as string[],
    },
    annotations: { title: 'List Components', ...TOOL_ANNOTATIONS },
  },
  {
    name: 'antd_info',
    description: 'Get component API information including props, types, and default values.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        component: { type: 'string', description: 'Component name (e.g. Button, Table)' },
        detail: { type: 'boolean', description: 'Include full detail (whenToUse, methods, related, faq)' },
      },
      required: ['component'],
    },
    annotations: { title: 'Get Component Info', ...TOOL_ANNOTATIONS },
  },
  {
    name: 'antd_doc',
    description: 'Get the full markdown documentation for a component.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        component: { type: 'string', description: 'Component name (e.g. Button, Table)' },
      },
      required: ['component'],
    },
    annotations: { title: 'Get Component Doc', ...TOOL_ANNOTATIONS },
  },
  {
    name: 'antd_demo',
    description: 'Get demo source code for a component. Without a name, lists all demos; with a name, returns specific demo code.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        component: { type: 'string', description: 'Component name (e.g. Button, Table)' },
        name: { type: 'string', description: 'Demo name to get specific demo code' },
      },
      required: ['component'],
    },
    annotations: { title: 'Get Component Demo', ...TOOL_ANNOTATIONS },
  },
  {
    name: 'antd_token',
    description: 'Query design tokens. Without a component, returns global tokens; with a component, returns component-level tokens.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        component: { type: 'string', description: 'Component name for component-level tokens' },
      },
      required: [] as string[],
    },
    annotations: { title: 'Query Design Tokens', ...TOOL_ANNOTATIONS },
  },
  {
    name: 'antd_semantic',
    description: 'Query the semantic customization structure (classNames/styles) of a component.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        component: { type: 'string', description: 'Component name (e.g. Button, Table)' },
      },
      required: ['component'],
    },
    annotations: { title: 'Query Semantic Structure', ...TOOL_ANNOTATIONS },
  },
  {
    name: 'antd_changelog',
    description: 'Query changelog entries or diff API between two versions. Provide v1+v2 for diff mode, or version for changelog query mode.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        version: { type: 'string', description: 'Version or range filter for changelog query (e.g. 5.20.0 or 5.18.0..5.20.0)' },
        v1: { type: 'string', description: 'Start version for API diff (e.g. 5.18.0)' },
        v2: { type: 'string', description: 'End version for API diff (e.g. 5.20.0)' },
        component: { type: 'string', description: 'Filter diff to a specific component' },
      },
      required: [] as string[],
    },
    annotations: { title: 'Query Changelog', ...TOOL_ANNOTATIONS },
  },
];

export function createToolHandler(ctx: McpContext) {
  return async (name: string, params: Record<string, unknown>) => {
    switch (name) {
      case 'antd_list': {
        const components = listComponents({ version: ctx.version });
        // Trim to MCP-friendly fields only
        const trimmed = components.map(({ name, nameZh, category, description }) => ({
          name,
          nameZh,
          category,
          description,
        }));
        return toMcpResult(trimmed);
      }

      case 'antd_info': {
        const result = getComponentInfo(params.component as string, {
          lang: ctx.lang,
          version: ctx.version,
          detail: (params.detail as boolean) ?? false,
        });
        return toMcpResult(result);
      }

      case 'antd_doc': {
        const result = getComponentDoc(params.component as string, {
          lang: ctx.lang,
          version: ctx.version,
        });
        return toMcpResult(result);
      }

      case 'antd_demo': {
        const result = getComponentDemo(params.component as string, {
          version: ctx.version,
          name: params.name as string | undefined,
        });
        return toMcpResult(result);
      }

      case 'antd_token': {
        const result = getTokens(params.component as string | undefined, {
          lang: ctx.lang,
          version: ctx.version,
        });
        return toMcpResult(result);
      }

      case 'antd_semantic': {
        const result = getSemanticStructure(params.component as string, {
          version: ctx.version,
        });
        return toMcpResult(result);
      }

      case 'antd_changelog': {
        const v1 = params.v1 as string | undefined;
        const v2 = params.v2 as string | undefined;

        if ((v1 && !v2) || (!v1 && v2)) {
          return toMcpResult(
            createError(
              ErrorCodes.INVALID_ARGUMENT,
              'Both v1 and v2 are required for diff mode',
              'Provide both versions (v1 + v2), or omit both to use query mode',
            ),
          );
        }

        if (v1 && v2) {
          const result = diffChangelog({
            v1,
            v2,
            component: params.component as string | undefined,
          });
          return toMcpResult(result);
        }

        // Changelog query mode
        const result = queryChangelog({
          snapshotVersion: ctx.version,
          entryFilter: params.version as string | undefined,
        });
        return toMcpResult(result);
      }

      default:
        return toMcpResult(
          createError(ErrorCodes.UNKNOWN_TOOL, `Unknown tool: ${name}`),
        );
    }
  };
}
