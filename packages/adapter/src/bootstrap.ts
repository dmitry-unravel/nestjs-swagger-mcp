import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ToolsRegistry } from './tools.registry';
import { openApiToMcpTools } from './openapi-to-mcp';
import type { AddressInfo } from 'node:net';
import type { INestApplication } from '@nestjs/common';
import type { OpenAPIObject } from 'openapi3-ts/oas30';
import type { McpAdapterOptions } from './types';

export function initMcpAdapter(app: INestApplication, opts: McpAdapterOptions = {}): Promise<void> {
  const httpServer = app.getHttpServer() as { address?: () => AddressInfo | string | null };
  const addr = httpServer.address?.();
  const port =
    (typeof addr === 'object' && addr !== null ? addr.port : undefined) ??
    (process.env.PORT ? Number(process.env.PORT) : 3000);
  const baseUrl = opts.restBaseUrl ?? `http://127.0.0.1:${port}`;

  const doc = SwaggerModule.createDocument(
    app,
    new DocumentBuilder().setTitle('MCP Adapter').setVersion('1.0').build(),
  );

  const tools = openApiToMcpTools(doc as unknown as OpenAPIObject, baseUrl, {
    includeTags: opts.includeTags,
    includeMethods: opts.includeMethods,
    forwardHeaders: opts.forwardHeaders ?? ['authorization'],
    filter: opts.filter,
  });
  app.get(ToolsRegistry).setTools(tools);
  return Promise.resolve();
}
