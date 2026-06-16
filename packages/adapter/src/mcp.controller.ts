import { Body, Controller, Headers, HttpCode, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { MCP_ERROR_UNKNOWN_METHOD, MCP_ERROR_UNKNOWN_TOOL } from './constants';
import { ToolsRegistry } from './tools.registry';
import type {
  JsonRpcError,
  JsonRpcId,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
} from './types';

@ApiTags('MCP')
@Controller('mcp')
export class McpController {
  constructor(private readonly registry: ToolsRegistry) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'MCP JSON-RPC 2.0 endpoint',
    description: 'Handles MCP protocol methods: initialize, tools/list, tools/call',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['jsonrpc', 'method'],
      properties: {
        jsonrpc: { type: 'string', enum: ['2.0'] },
        id: { oneOf: [{ type: 'number' }, { type: 'string' }, { nullable: true, type: 'null' }] },
        method: {
          type: 'string',
          enum: ['initialize', 'tools/list', 'tools/call'],
          example: 'tools/list',
        },
        params: { type: 'object', additionalProperties: true },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'JSON-RPC 2.0 response' })
  async handle(
    @Body() body: JsonRpcRequest,
    @Headers() headers: Record<string, string>,
  ): Promise<JsonRpcResponse> {
    const id: JsonRpcId = body?.id ?? null;
    const ok = <T>(result: T): JsonRpcSuccess<T> => ({ jsonrpc: '2.0', id, result });
    const err = (code: number, message: string, data?: unknown): JsonRpcError => ({
      jsonrpc: '2.0',
      id,
      error: { code, message, ...(data !== undefined ? { data } : {}) },
    });

    switch (body.method) {
      case 'initialize': {
        const protocolVersion = headers['mcp-protocol-version'] ?? '2025-06-18';
        return ok({
          protocolVersion,
          serverInfo: { name: '@reliqio/nestjs-swagger-mcp', version: '0.1.1' },
          capabilities: { tools: {} },
        });
      }

      case 'tools/list': {
        const tools = this.registry.getAll().map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        }));
        return ok({ tools });
      }

      case 'tools/call': {
        const params = body.params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined;
        const { name, arguments: args } = params ?? {};
        const tool = this.registry.getAll().find((t) => t.name === name);
        if (!tool) return err(MCP_ERROR_UNKNOWN_TOOL, `Unknown tool: ${name}`);
        try {
          const result = await tool.handler(args ?? {}, { headers });
          return ok({ content: result.content, isError: false });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : String(e);
          return ok({ content: [{ type: 'text', text: message }], isError: true });
        }
      }

      default:
        return err(MCP_ERROR_UNKNOWN_METHOD, `Unknown method: ${body.method}`);
    }
  }
}
