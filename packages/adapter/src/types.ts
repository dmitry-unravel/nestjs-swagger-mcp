export type McpPropertySchema = {
  type?: string | string[];
  description?: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  nullable?: boolean;
  'x-in'?: string;
  [key: string]: unknown;
};

export type McpInputSchema = {
  type: 'object';
  properties: Record<string, McpPropertySchema>;
  required: string[];
  additionalProperties: false;
};

export type McpTextContent = { type: 'text'; text: string };
export type McpContent = McpTextContent;

export type McpToolResult = { content: McpContent[] };

export type McpHandlerContext = { headers: Record<string, string> };

export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema: McpInputSchema;
  handler: (args: Record<string, unknown>, ctx: McpHandlerContext) => Promise<McpToolResult>;
};

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete';

export type RouteInfo = {
  path: string;
  method: HttpMethod;
  tags: string[];
  operationId?: string;
};

export type McpAdapterOptions = {
  path?: string;
  restBaseUrl?: string;
  includeTags?: string[];
  includeMethods?: HttpMethod[];
  forwardHeaders?: string[];
  filter?: (route: RouteInfo) => boolean;
};

export type JsonRpcId = number | string | null;

export type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: unknown;
};

export type JsonRpcSuccess<T = unknown> = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  result: T;
};

export type JsonRpcError = {
  jsonrpc: '2.0';
  id: JsonRpcId;
  error: {
    code: number;
    message: string;
    data?: unknown;
  };
};

export type JsonRpcResponse<T = unknown> = JsonRpcSuccess<T> | JsonRpcError;
