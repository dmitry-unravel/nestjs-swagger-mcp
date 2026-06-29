import type {
  OpenAPIObject,
  OperationObject,
  ParameterObject,
  RequestBodyObject,
  SchemaObject,
} from 'openapi3-ts/oas30';
import type { McpToolDef, McpInputSchema, McpPropertySchema, HttpMethod, RouteInfo } from './types';

type MappingOptions = {
  includeTags?: string[];
  includeMethods?: HttpMethod[];
  forwardHeaders?: string[];
  filter?: (route: RouteInfo) => boolean;
};

const pathToName = (p: string) =>
  p.replace(/^\//, '').replace(/[/{}]/g, '.').replace(/\.\.+/g, '.').replace(/\.$/, '');

const toParamString = (val: unknown): string =>
  typeof val === 'string' || typeof val === 'number' || typeof val === 'boolean' ? String(val) : '';

function buildInputSchema(op: OperationObject): McpInputSchema {
  const params = (op.parameters as ParameterObject[] | undefined)?.filter(Boolean) ?? [];
  const props: Record<string, McpPropertySchema> = {};
  const required: string[] = [];

  for (const p of params) {
    const sch = (p.schema as SchemaObject) ?? { type: 'string' };
    props[p.name] = { ...sch, description: p.description, ...(p.in ? { 'x-in': p.in } : {}) };
    if (p.required) required.push(p.name);
  }

  const rb = op.requestBody as RequestBodyObject | undefined;
  const bodySchema = rb?.content?.['application/json']?.schema as McpPropertySchema | undefined;
  if (bodySchema) {
    props.body = bodySchema;
    if (rb?.required) required.push('body');
  }

  return { type: 'object', properties: props, required, additionalProperties: false };
}

export function openApiToMcpTools(
  doc: OpenAPIObject,
  baseUrl: string,
  opts: MappingOptions = {},
): McpToolDef[] {
  const { includeTags, includeMethods, forwardHeaders = ['authorization'], filter } = opts;
  const tools: McpToolDef[] = [];
  const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;

  for (const [rawPath, item] of Object.entries(doc.paths ?? {})) {
    for (const m of METHODS) {
      const op = item[m];
      if (!op) continue;
      if (includeTags?.length && !(op.tags ?? []).some((t) => includeTags.includes(t))) continue;
      if (includeMethods?.length && !includeMethods.includes(m)) continue;
      const routeInfo: RouteInfo = {
        path: rawPath,
        method: m,
        tags: op.tags ?? [],
        operationId: op.operationId,
      };
      if (filter && !filter(routeInfo)) continue;

      const toolName =
        (op.tags?.[0] ? `${op.tags[0]}.` : 'http.') +
        (op.operationId ?? `${m}.${pathToName(rawPath)}`);
      const inputSchema = buildInputSchema(op);
      const description = op.summary ?? op.description ?? `Call ${m.toUpperCase()} ${rawPath}`;

      tools.push({
        name: toolName,
        description,
        inputSchema,
        handler: async (args, ctx) => {
          let url =
            baseUrl +
            rawPath.replace(/\{([^}]+)\}/g, (_, name: string) =>
              encodeURIComponent(toParamString(args[name])),
            );

          const query = new URLSearchParams();
          for (const [k, v] of Object.entries(args)) {
            if (inputSchema.properties[k]?.['x-in'] === 'query' && v != null) {
              query.append(k, toParamString(v));
            }
          }
          const qs = query.toString();
          if (qs) url += (url.includes('?') ? '&' : '?') + qs;

          const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
          for (const h of forwardHeaders) {
            const val = ctx.headers[h] ?? ctx.headers[h.toUpperCase()];
            if (val) reqHeaders[h] = val;
          }

          const init: RequestInit = {
            method: m.toUpperCase(),
            headers: reqHeaders,
            ...(inputSchema.properties.body ? { body: JSON.stringify(args.body) } : {}),
          };

          const res = await fetch(url, init);
          const text = await res.text();
          let data: unknown;
          try {
            data = JSON.parse(text);
          } catch {
            data = text;
          }

          if (!res.ok) {
            return {
              content: [
                { type: 'text', text: `HTTP ${res.status} ${m.toUpperCase()} ${rawPath}: ${text}` },
              ],
            };
          }

          return typeof data === 'object' && data !== null
            ? { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] }
            : { content: [{ type: 'text', text: String(data) }] };
        },
      });
    }
  }

  return tools;
}
