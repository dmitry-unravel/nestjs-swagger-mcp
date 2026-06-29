import { openApiToMcpTools } from '../openapi-to-mcp';
import type { OpenAPIObject } from 'openapi3-ts/oas30';

function doc(paths: OpenAPIObject['paths']): OpenAPIObject {
  return { openapi: '3.0.0', info: { title: 'Test', version: '1' }, paths };
}

describe('openApiToMcpTools', () => {
  // ─── tool name generation ──────────────────────────────────────────────────

  describe('tool naming', () => {
    it('uses tag.operationId when both present', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': { get: { tags: ['Users'], operationId: 'listUsers', responses: {} } },
        }),
        'http://base',
      );
      expect(tool.name).toBe('Users.listUsers');
    });

    it('uses http.operationId when no tags', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/health': { get: { operationId: 'healthCheck', responses: {} } },
        }),
        'http://base',
      );
      expect(tool.name).toBe('http.healthCheck');
    });

    it('uses first tag when multiple tags are present', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/things': { get: { tags: ['Alpha', 'Beta'], operationId: 'listThings', responses: {} } },
        }),
        'http://base',
      );
      expect(tool.name).toBe('Alpha.listThings');
    });

    it('derives name from method + path when no operationId', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': { get: { responses: {} } },
        }),
        'http://base',
      );
      expect(tool.name).toBe('http.get.users');
    });

    it('converts path params in name without trailing dot', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users/{id}': { get: { operationId: 'getUser', responses: {} } },
        }),
        'http://base',
      );
      expect(tool.name).toBe('http.getUser');
    });

    it('collapses nested path segments correctly', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/a/b/c': { get: { responses: {} } },
        }),
        'http://base',
      );
      expect(tool.name).toBe('http.get.a.b.c');
    });
  });

  // ─── description ──────────────────────────────────────────────────────────

  describe('description', () => {
    it('uses summary', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': { get: { summary: 'List users', responses: {} } },
        }),
        'http://base',
      );
      expect(tool.description).toBe('List users');
    });

    it('falls back to description when no summary', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': { get: { description: 'Long desc', responses: {} } },
        }),
        'http://base',
      );
      expect(tool.description).toBe('Long desc');
    });

    it('generates a description when both absent', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': { get: { responses: {} } },
        }),
        'http://base',
      );
      expect(tool.description).toBe('Call GET /users');
    });
  });

  // ─── input schema ──────────────────────────────────────────────────────────

  describe('input schema', () => {
    it('maps path params with x-in:path and marks required', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users/{id}': {
            get: {
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              responses: {},
            },
          },
        }),
        'http://base',
      );
      expect(tool.inputSchema.properties.id).toMatchObject({ type: 'string', 'x-in': 'path' });
      expect(tool.inputSchema.required).toContain('id');
    });

    it('maps optional query params without adding to required', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': {
            get: {
              parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer' } }],
              responses: {},
            },
          },
        }),
        'http://base',
      );
      expect(tool.inputSchema.properties.limit).toMatchObject({ type: 'integer', 'x-in': 'query' });
      expect(tool.inputSchema.required).not.toContain('limit');
    });

    it('maps required request body', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': {
            post: {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object' } } },
              },
              responses: {},
            },
          },
        }),
        'http://base',
      );
      expect(tool.inputSchema.properties.body).toBeDefined();
      expect(tool.inputSchema.required).toContain('body');
    });

    it('maps optional request body without adding to required', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users': {
            post: {
              requestBody: {
                required: false,
                content: { 'application/json': { schema: { type: 'object' } } },
              },
              responses: {},
            },
          },
        }),
        'http://base',
      );
      expect(tool.inputSchema.required).not.toContain('body');
    });

    it('sets additionalProperties: false', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/ping': { get: { responses: {} } },
        }),
        'http://base',
      );
      expect(tool.inputSchema.additionalProperties).toBe(false);
    });

    it('carries description from parameter onto property', () => {
      const [tool] = openApiToMcpTools(
        doc({
          '/users/{id}': {
            get: {
              parameters: [
                { name: 'id', in: 'path', description: 'User ID', schema: { type: 'string' } },
              ],
              responses: {},
            },
          },
        }),
        'http://base',
      );
      expect(tool.inputSchema.properties.id.description).toBe('User ID');
    });
  });

  // ─── filtering ─────────────────────────────────────────────────────────────

  describe('filtering', () => {
    const multiDoc = doc({
      '/users': {
        get: { tags: ['Users'], operationId: 'listUsers', responses: {} },
        post: { tags: ['Users'], operationId: 'createUser', responses: {} },
      },
      '/orders': {
        get: { tags: ['Orders'], operationId: 'listOrders', responses: {} },
        post: { tags: ['Orders'], operationId: 'createOrder', responses: {} },
      },
    });

    it('returns all operations when no filters set', () => {
      expect(openApiToMcpTools(multiDoc, 'http://base')).toHaveLength(4);
    });

    it('includeTags keeps only matching tags', () => {
      const tools = openApiToMcpTools(multiDoc, 'http://base', { includeTags: ['Users'] });
      expect(tools).toHaveLength(2);
      expect(tools.every((t) => t.name.startsWith('Users.'))).toBe(true);
    });

    it('includeMethods keeps only matching HTTP methods', () => {
      const tools = openApiToMcpTools(multiDoc, 'http://base', { includeMethods: ['get'] });
      expect(tools).toHaveLength(2);
      expect(tools.map((t) => t.name)).toEqual(
        expect.arrayContaining(['Users.listUsers', 'Orders.listOrders']),
      );
    });

    it('includes every OpenAPI operation method', () => {
      const tools = openApiToMcpTools(
        doc({
          '/resource': {
            get: { responses: {} },
            post: { responses: {} },
            put: { responses: {} },
            patch: { responses: {} },
            delete: { responses: {} },
            head: { responses: {} },
            options: { responses: {} },
            trace: { responses: {} },
          },
        }),
        'http://base',
      );

      expect(tools.map((tool) => tool.name)).toEqual([
        'http.get.resource',
        'http.post.resource',
        'http.put.resource',
        'http.patch.resource',
        'http.delete.resource',
        'http.head.resource',
        'http.options.resource',
        'http.trace.resource',
      ]);
    });

    it('filter predicate receives correct RouteInfo', () => {
      const seen: string[] = [];
      openApiToMcpTools(multiDoc, 'http://base', {
        filter: ({ path, method, tags, operationId }) => {
          seen.push(`${method}:${path}:${tags[0]}:${operationId}`);
          return false;
        },
      });
      expect(seen).toContain('get:/users:Users:listUsers');
      expect(seen).toContain('post:/orders:Orders:createOrder');
    });

    it('filter can combine method and tag logic', () => {
      const tools = openApiToMcpTools(multiDoc, 'http://base', {
        filter: ({ method, tags }) => method === 'get' || tags.includes('Orders'),
      });
      expect(tools).toHaveLength(3);
    });

    it('combinig includeTags + includeMethods applies both', () => {
      const tools = openApiToMcpTools(multiDoc, 'http://base', {
        includeTags: ['Users'],
        includeMethods: ['post'],
      });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('Users.createUser');
    });

    it('returns empty array for doc with no paths', () => {
      expect(openApiToMcpTools(doc({}), 'http://base')).toHaveLength(0);
    });

    it('skips HTTP methods not present on a path item', () => {
      const tools = openApiToMcpTools(
        doc({
          '/only-get': { get: { responses: {} } },
        }),
        'http://base',
      );
      expect(tools).toHaveLength(1);
    });
  });

  // ─── handler ───────────────────────────────────────────────────────────────

  describe('handler', () => {
    let fetchMock: jest.MockedFunction<typeof fetch>;

    beforeEach(() => {
      fetchMock = jest.fn();
      global.fetch = fetchMock;
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function mockResponse(body: unknown, status = 200): void {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      fetchMock.mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        text: () => Promise.resolve(text),
      } as unknown as Response);
    }

    it('substitutes path params in the URL', async () => {
      mockResponse({});
      const [tool] = openApiToMcpTools(
        doc({
          '/users/{id}/posts/{postId}': {
            get: {
              parameters: [
                { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
              ],
              responses: {},
            },
          },
        }),
        'http://base',
      );

      await tool.handler({ id: '42', postId: '7' }, { headers: {} });
      expect(fetchMock).toHaveBeenCalledWith('http://base/users/42/posts/7', expect.anything());
    });

    it('URL-encodes special characters in path params', async () => {
      mockResponse({});
      const [tool] = openApiToMcpTools(
        doc({
          '/items/{id}': {
            get: {
              parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
              responses: {},
            },
          },
        }),
        'http://base',
      );

      await tool.handler({ id: 'hello world' }, { headers: {} });
      expect(fetchMock).toHaveBeenCalledWith('http://base/items/hello%20world', expect.anything());
    });

    it('appends query params', async () => {
      mockResponse([]);
      const [tool] = openApiToMcpTools(
        doc({
          '/users': {
            get: {
              parameters: [
                { name: 'limit', in: 'query', schema: { type: 'integer' } },
                { name: 'offset', in: 'query', schema: { type: 'integer' } },
              ],
              responses: {},
            },
          },
        }),
        'http://base',
      );

      await tool.handler({ limit: 10, offset: 20 }, { headers: {} });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).toContain('limit=10');
      expect(url).toContain('offset=20');
    });

    it('omits null/undefined query params', async () => {
      mockResponse([]);
      const [tool] = openApiToMcpTools(
        doc({
          '/users': {
            get: {
              parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }],
              responses: {},
            },
          },
        }),
        'http://base',
      );

      await tool.handler({ search: null }, { headers: {} });
      const url = fetchMock.mock.calls[0][0] as string;
      expect(url).not.toContain('search');
    });

    it('serialises request body as JSON', async () => {
      mockResponse({ id: 1 });
      const [tool] = openApiToMcpTools(
        doc({
          '/users': {
            post: {
              requestBody: {
                required: true,
                content: { 'application/json': { schema: { type: 'object' } } },
              },
              responses: {},
            },
          },
        }),
        'http://base',
      );

      await tool.handler({ body: { name: 'Alice' } }, { headers: {} });
      const init = fetchMock.mock.calls[0][1] as RequestInit;
      expect(init.body).toBe(JSON.stringify({ name: 'Alice' }));
    });

    it('forwards specified headers case-sensitively', async () => {
      mockResponse({});
      const [tool] = openApiToMcpTools(
        doc({
          '/secure': { get: { responses: {} } },
        }),
        'http://base',
        { forwardHeaders: ['authorization', 'x-tenant'] },
      );

      await tool.handler({}, { headers: { authorization: 'Bearer tok', 'x-tenant': 'acme' } });
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer tok');
      expect(headers['x-tenant']).toBe('acme');
    });

    it('falls back to uppercase header lookup', async () => {
      mockResponse({});
      const [tool] = openApiToMcpTools(
        doc({
          '/secure': { get: { responses: {} } },
        }),
        'http://base',
        { forwardHeaders: ['authorization'] },
      );

      await tool.handler({}, { headers: { AUTHORIZATION: 'Bearer up' } });
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers.authorization).toBe('Bearer up');
    });

    it('always sends Content-Type: application/json', async () => {
      mockResponse({});
      const [tool] = openApiToMcpTools(
        doc({
          '/ping': { get: { responses: {} } },
        }),
        'http://base',
      );

      await tool.handler({}, { headers: {} });
      const headers = fetchMock.mock.calls[0][1]?.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('returns pretty-printed JSON text for object response', async () => {
      const payload = { foo: 'bar', n: 1 };
      mockResponse(payload);
      const [tool] = openApiToMcpTools(
        doc({
          '/data': { get: { responses: {} } },
        }),
        'http://base',
      );

      const result = await tool.handler({}, { headers: {} });
      expect(result.content[0]).toEqual({
        type: 'text',
        text: JSON.stringify(payload, null, 2),
      });
    });

    it('returns plain text for non-JSON string response', async () => {
      mockResponse('pong');
      const [tool] = openApiToMcpTools(
        doc({
          '/ping': { get: { responses: {} } },
        }),
        'http://base',
      );

      const result = await tool.handler({}, { headers: {} });
      expect(result.content[0]).toEqual({ type: 'text', text: 'pong' });
    });

    it('returns error text for non-2xx response', async () => {
      mockResponse('Not Found', 404);
      const [tool] = openApiToMcpTools(
        doc({
          '/missing': { get: { responses: {} } },
        }),
        'http://base',
      );

      const result = await tool.handler({}, { headers: {} });
      expect(result.content[0].text).toMatch(/HTTP 404 GET \/missing/);
    });

    it('uses correct HTTP method on fetch', async () => {
      for (const method of [
        'get',
        'post',
        'put',
        'patch',
        'delete',
        'head',
        'options',
        'trace',
      ] as const) {
        fetchMock.mockResolvedValue({
          ok: true,
          status: 200,
          text: () => Promise.resolve('{}'),
        } as unknown as Response);
        const [tool] = openApiToMcpTools(
          doc({
            '/x': { [method]: { responses: {} } },
          }),
          'http://base',
        );
        await tool.handler({}, { headers: {} });
        expect(fetchMock.mock.lastCall?.[1]?.method).toBe(method.toUpperCase());
        fetchMock.mockReset();
      }
    });
  });
});
