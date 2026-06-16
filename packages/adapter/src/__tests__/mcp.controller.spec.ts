import { McpController } from '../mcp.controller';
import { MCP_ERROR_UNKNOWN_METHOD, MCP_ERROR_UNKNOWN_TOOL } from '../constants';
import { ToolsRegistry } from '../tools.registry';
import type {
  McpToolDef,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcSuccess,
  JsonRpcError,
} from '../types';

// ─── helpers ──────────────────────────────────────────────────────────────────

function isSuccess(r: JsonRpcResponse): r is JsonRpcSuccess {
  return 'result' in r;
}
function isError(r: JsonRpcResponse): r is JsonRpcError {
  return 'error' in r;
}

function req(method: string, params?: unknown, id: number | string | null = 1): JsonRpcRequest {
  return {
    jsonrpc: '2.0',
    ...(id !== null ? { id } : {}),
    method,
    ...(params !== undefined ? { params } : {}),
  };
}

const stubTool = (name: string, handler?: McpToolDef['handler']): McpToolDef => ({
  name,
  description: `Tool ${name}`,
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  handler: handler ?? jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'ok' }] }),
});

// ─── tests ────────────────────────────────────────────────────────────────────

describe('McpController', () => {
  let registry: ToolsRegistry;
  let controller: McpController;

  beforeEach(() => {
    registry = new ToolsRegistry();
    controller = new McpController(registry);
  });

  // ── initialize ──────────────────────────────────────────────────────────────

  describe('initialize', () => {
    it('returns server info and capabilities', async () => {
      const res = await controller.handle(req('initialize'), {});
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        const r = res.result as Record<string, unknown>;
        expect(r.serverInfo).toMatchObject({ name: '@reliqio/nestjs-swagger-mcp' });
        expect(r.capabilities).toEqual({ tools: {} });
      }
    });

    it('uses mcp-protocol-version header value', async () => {
      const res = await controller.handle(req('initialize'), {
        'mcp-protocol-version': '2024-11-05',
      });
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        expect((res.result as Record<string, unknown>).protocolVersion).toBe('2024-11-05');
      }
    });

    it('falls back to default protocol version when header absent', async () => {
      const res = await controller.handle(req('initialize'), {});
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        expect((res.result as Record<string, unknown>).protocolVersion).toBe('2025-06-18');
      }
    });
  });

  // ── tools/list ──────────────────────────────────────────────────────────────

  describe('tools/list', () => {
    it('returns empty tools list when registry is empty', async () => {
      const res = await controller.handle(req('tools/list'), {});
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        expect((res.result as Record<string, unknown[]>).tools).toEqual([]);
      }
    });

    it('returns name, description and inputSchema for each tool', async () => {
      registry.setTools([stubTool('my.tool')]);
      const res = await controller.handle(req('tools/list'), {});
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        const tools = (res.result as Record<string, unknown[]>).tools;
        expect(tools).toHaveLength(1);
        expect(tools[0]).toMatchObject({
          name: 'my.tool',
          description: 'Tool my.tool',
        });
      }
    });

    it('does not expose the handler function in the list', async () => {
      registry.setTools([stubTool('hidden')]);
      const res = await controller.handle(req('tools/list'), {});
      if (isSuccess(res)) {
        const tools = (res.result as Record<string, unknown[]>).tools;
        expect(tools[0]).not.toHaveProperty('handler');
      }
    });
  });

  // ── tools/call ──────────────────────────────────────────────────────────────

  describe('tools/call', () => {
    it('invokes the matching tool and returns its content', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [{ type: 'text', text: 'result' }] });
      registry.setTools([stubTool('echo', handler)]);

      const res = await controller.handle(
        req('tools/call', { name: 'echo', arguments: { x: 1 } }),
        {},
      );
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        const r = res.result as Record<string, unknown>;
        expect(r.isError).toBe(false);
        expect(r.content).toEqual([{ type: 'text', text: 'result' }]);
      }
    });

    it('passes arguments and headers to the handler', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [] });
      registry.setTools([stubTool('auth', handler)]);

      await controller.handle(req('tools/call', { name: 'auth', arguments: { key: 'val' } }), {
        authorization: 'Bearer x',
      });
      expect(handler).toHaveBeenCalledWith(
        { key: 'val' },
        { headers: { authorization: 'Bearer x' } },
      );
    });

    it('passes empty arguments object when none provided', async () => {
      const handler = jest.fn().mockResolvedValue({ content: [] });
      registry.setTools([stubTool('noop', handler)]);

      await controller.handle(req('tools/call', { name: 'noop' }), {});
      expect(handler).toHaveBeenCalledWith({}, { headers: {} });
    });

    it('returns -32601 error for unknown tool name', async () => {
      const res = await controller.handle(req('tools/call', { name: 'no.such.tool' }), {});
      expect(isError(res)).toBe(true);
      if (isError(res)) {
        expect(res.error.code).toBe(MCP_ERROR_UNKNOWN_TOOL);
      }
    });

    it('returns isError:true and error message when handler throws an Error', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('boom'));
      registry.setTools([stubTool('bad', handler)]);

      const res = await controller.handle(req('tools/call', { name: 'bad' }), {});
      expect(isSuccess(res)).toBe(true);
      if (isSuccess(res)) {
        const r = res.result as Record<string, unknown>;
        expect(r.isError).toBe(true);
        expect((r.content as Array<{ text: string }>)[0].text).toBe('boom');
      }
    });

    it('converts non-Error throws to string in isError response', async () => {
      const handler = jest.fn().mockRejectedValue('raw string error');
      registry.setTools([stubTool('weird', handler)]);

      const res = await controller.handle(req('tools/call', { name: 'weird' }), {});
      if (isSuccess(res)) {
        const r = res.result as Record<string, unknown>;
        expect(r.isError).toBe(true);
        expect((r.content as Array<{ text: string }>)[0].text).toBe('raw string error');
      }
    });
  });

  // ── unknown method ──────────────────────────────────────────────────────────

  describe('unknown method', () => {
    it('returns -32601 error', async () => {
      const res = await controller.handle(req('no/such/method'), {});
      expect(isError(res)).toBe(true);
      if (isError(res)) {
        expect(res.error.code).toBe(MCP_ERROR_UNKNOWN_METHOD);
      }
    });
  });

  // ── id propagation ──────────────────────────────────────────────────────────

  describe('id propagation', () => {
    it('echoes numeric id in every response', async () => {
      const res = await controller.handle(req('tools/list', undefined, 42), {});
      expect(res.id).toBe(42);
    });

    it('echoes string id in every response', async () => {
      const res = await controller.handle(req('tools/list', undefined, 'req-abc'), {});
      expect(res.id).toBe('req-abc');
    });

    it('uses null when id is absent from request', async () => {
      const res = await controller.handle({ jsonrpc: '2.0', method: 'tools/list' }, {});
      expect(res.id).toBeNull();
    });
  });
});
