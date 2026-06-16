# @reliqio/nestjs-swagger-mcp

**Turn your NestJS REST API into an MCP server — automatically.**

This library automatically mounts a single `/mcp` endpoint in your NestJS app and converts your existing API routes into Model Context Protocol (MCP) tools. It lets LLM clients discover and call your routes as `tools/list` and `tools/call` without manual wrappers.

> **Status:** This package is currently in **beta**. It may contain bugs or breaking changes as we gather feedback and improve stability.

## Installation

```bash
npm install @reliqio/nestjs-swagger-mcp
```

## Quick Start

### 1. Import the module in your NestJS application

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { McpAdapterModule } from '@reliqio/nestjs-swagger-mcp';

@Module({
  imports: [McpAdapterModule.forRoot()],
  // ...
})
export class AppModule {}
```

### 2. Initialize the adapter after your app is listening

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { initMcpAdapter } from '@reliqio/nestjs-swagger-mcp';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Create a Swagger document (recommended for better schema definitions)
  const config = new DocumentBuilder().setTitle('Your API').setVersion('1.0').build();
  SwaggerModule.createDocument(app, config);
  
  // Start the application
  await app.listen(3000);
  
  // Initialize the MCP adapter after the app is listening
  await initMcpAdapter(app);
  
  console.log('REST API: http://localhost:3000');
  console.log('MCP endpoint: http://localhost:3000/mcp');
}
bootstrap();
```

## Usage Example

### Verify the MCP endpoint with curl

With your app running on http://127.0.0.1:3000:

**Initialize:**
```bash
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -H 'MCP-Protocol-Version: 2025-06-18' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"curl","version":"0.1"}}}' | jq
```

**List tools:**
```bash
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' | jq
```

**Call a tool (example for GET /users/{id}):**
```bash
curl -s http://127.0.0.1:3000/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"Users.getUser","arguments":{"id":"1"}}}' | jq
```

## How It Works

The adapter works by:

1. **Discovery**: When you call `initMcpAdapter(app)`, the adapter uses NestJS's Swagger module to create an OpenAPI document of your API.

2. **Conversion**: It then converts each path and method in the OpenAPI document into an MCP tool:
   - Tool names are derived from the OpenAPI tag and operation ID or path
   - Input schemas are built from the OpenAPI parameters and request body
   - Handlers make HTTP requests to your actual API endpoints

3. **Serving**: The adapter adds a `/mcp` endpoint to your application that implements the MCP protocol using JSON-RPC 2.0:
   - `initialize`: Returns server info and capabilities
   - `tools/list`: Returns a list of all available tools
   - `tools/call`: Executes a specific tool with the provided arguments

## API Reference

### McpAdapterModule

The main module that should be imported in your NestJS application.

```typescript
import { McpAdapterModule } from '@reliqio/nestjs-swagger-mcp';

@Module({
  imports: [McpAdapterModule.forRoot()],
  // ...
})
export class AppModule {}
```

### initMcpAdapter

Function to initialize the MCP adapter after your app is listening.

```typescript
import { initMcpAdapter } from '@reliqio/nestjs-swagger-mcp';

// In your bootstrap function
await initMcpAdapter(app, {
  // Options (all optional)
  includeTags: ['Users', 'Products'], // Only include routes with these tags
  restBaseUrl: 'http://api.example.com', // Base URL for API calls (default: http://127.0.0.1:port)
  forwardHeaders: ['authorization', 'x-api-key'] // Headers to forward from MCP requests to API calls
});
```

## MCP over HTTP — client requirements

When calling the `/mcp` endpoint, clients **must** follow the MCP Streamable HTTP rules:

1) **HTTP POST with JSON-RPC**  
   Every message is a POST to `/mcp` with a JSON-RPC 2.0 body.  
   Headers:
    - `Content-Type: application/json`
    - `Accept: application/json, text/event-stream`

2) **Protocol version header (required from 2025-06-18)**  
   After initialization, include the negotiated version on every request:  
   `MCP-Protocol-Version: 2025-06-18`

3) **(Optional) Session header**  
   If the server returns `Mcp-Session-Id` on initialize, echo it on subsequent requests.


# Server note
 Server note: the adapter already handles this; you only need to ensure your CORS allows  
 `MCP-Protocol-Version` (as shown below). No extra protocol wiring is required in your Nest app.


**initialize
curl -s http://127.0.0.1:3000/mcp \
-H 'Content-Type: application/json' \
-H 'Accept: application/json, text/event-stream' \
-H 'MCP-Protocol-Version: 2025-06-18' \
-d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"clientInfo":{"name":"curl","version":"0.1"}}}'

**tools/list
curl -s http://127.0.0.1:3000/mcp \
-H 'Content-Type: application/json' \
-H 'Accept: application/json, text/event-stream' \
-H 'MCP-Protocol-Version: 2025-06-18' \
-d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

**tools/call
curl -s http://127.0.0.1:3000/mcp \
-H 'Content-Type: application/json' \
-H 'Accept: application/json, text/event-stream' \
-H 'MCP-Protocol-Version: 2025-06-18' \
-d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"Users.getUser","arguments":{"id":"1"}}}'

## Advanced Options

For more advanced options, troubleshooting, and detailed documentation, please visit the [GitHub repository](https://github.com/giladg1/@reliqio/nestjs-swagger-mcp).

## License

This project is licensed under the MIT License - see the LICENSE file for details.