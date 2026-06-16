# @reliqio/nestjs-swagger-mcp

**Turn your NestJS REST API into an MCP server — automatically.**

This library automatically mounts a single `/mcp` endpoint in your NestJS app and converts your existing API routes into Model Context Protocol (MCP) tools. It lets LLM clients discover and call your routes as `tools/list` and `tools/call` without manual wrappers.

---

## Table of Contents

- [Overview](#overview)
- [What is MCP?](#what-is-mcp)
- [Why Use This Adapter?](#why-use-this-adapter)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Usage Example](#usage-example)
- [How It Works](#how-it-works)
- [API Reference](#api-reference)
- [Advanced Options](#advanced-options)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

A lightweight NestJS module that:

1. Discovers your routes via Nest's OpenAPI doc (`SwaggerModule.createDocument`).
2. Converts them into MCP tools with JSON-RPC 2.0 transport (`initialize`, `tools/list`, `tools/call`).
3. Adds a `/mcp` endpoint that LLMs and clients can use to list and invoke your API routes generically.

---

## What is MCP?

The Model Context Protocol (MCP) is a standardized protocol for communication between LLM-powered applications and external tools or services. It enables:

- **Tool Discovery**: Applications can discover what tools are available
- **Tool Invocation**: Applications can call tools with structured arguments
- **Standardized Communication**: Using JSON-RPC 2.0 as the transport layer

MCP is particularly useful for AI agents that need to interact with external systems in a consistent way. This adapter implements the MCP specification, allowing your NestJS API to be easily integrated with LLM-powered applications.

---

## Why Use This Adapter?

- **No manual wiring** — your existing controllers become tools automatically.
- **Consistent API spec** — uses OpenAPI for discovery and JSON-RPC for tool calls.
- **Great for LLM workflows** — allows LLM-powered agents to introspect and call your API dynamically.
- **Scalable** — works with large route sets and supports fine-grained control (tags, headers, streaming).
- **Minimal overhead** — lightweight adapter that doesn't modify your existing API.
- **Easy integration** — just import the module and initialize it after your app is listening.

---

## Installation

### 1. Install the package

```bash
npm install @reliqio/nestjs-swagger-mcp
```

### 2. Import the module in your NestJS application

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

### 3. Initialize the adapter after your app is listening

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

---

## Quick Start

To try out the example application included in this repository:

```bash
# 1. Clone or unzip the project
cd @reliqio/nestjs-swagger-mcp

# 2. Install dependencies & build the adapter
npm install
npm run build:adapter

# 3. Start the sample NestJS app (port 3000)
cd examples/nest-app
npm install
npm run start:dev

# 4. (Optional) Run React client (port 5173)
cd ../react-client
npm install
npm run dev
```

### Visit

- API: http://127.0.0.1:3000
- MCP endpoint: http://127.0.0.1:3000/mcp
- React UI (demo tool calls): http://127.0.0.1:5173

---

## Usage Example

### 1. Verify the MCP endpoint with curl

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

### 2. Using the MCP endpoint from JavaScript/TypeScript

```typescript
async function mcp(payload) {
  const res = await fetch('http://127.0.0.1:3000/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'MCP-Protocol-Version': '2025-06-18',
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// Initialize
const init = await mcp({ 
  jsonrpc: '2.0', 
  id: 1, 
  method: 'initialize', 
  params: { clientInfo: { name: 'js-client', version: '0.1.0' }}
});

// List tools
const tools = await mcp({ 
  jsonrpc: '2.0', 
  id: 2, 
  method: 'tools/list' 
});

// Call a tool
const result = await mcp({ 
  jsonrpc: '2.0', 
  id: 3, 
  method: 'tools/call', 
  params: { 
    name: 'Users.getUser', 
    arguments: { id: '1' }
  }
});
```

---

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

4. **Execution**: When a client calls a tool, the adapter:
   - Validates the arguments against the tool's input schema
   - Makes an HTTP request to the corresponding API endpoint
   - Returns the response as MCP content

This approach allows your existing API to be used as an MCP server without any changes to your controllers or routes.

---

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

### Types

```typescript
// MCP tool definition
export type McpToolDef = {
  name: string;
  description?: string;
  inputSchema: any; // JSON Schema
  handler: (args: Record<string, any>, ctx: { headers: Record<string, string> }) => Promise<{ content: McpContent[] }>;
};

// MCP content (returned by tools)
export type McpContent =
  | { type: 'text'; text: string }
  | { type: 'json'; data: any };

// Adapter options
export type McpAdapterOptions = {
  path?: string; // Path for the MCP endpoint (default: /mcp)
  restBaseUrl?: string; // Base URL for REST API calls
  includeTags?: string[]; // OpenAPI tags to include
  forwardHeaders?: string[]; // Headers to forward from MCP requests to API calls
};
```

---

## Advanced Options

### Customizing Tool Names

By default, tool names are derived from the OpenAPI tag and operation ID or path. You can customize the names by:

1. Using the `@ApiTags` decorator to set the tag for a controller:
   ```typescript
   @ApiTags('Users')
   @Controller('users')
   export class UsersController {}
   ```

2. Using the `@ApiOperation` decorator to set the operation ID for a route:
   ```typescript
   @Get(':id')
   @ApiOperation({ operationId: 'findUserById' })
   getUser(@Param('id') id: string) {}
   ```

### Filtering Tools

You can filter which routes are converted to tools by using the `includeTags` option:

```typescript
await initMcpAdapter(app, {
  includeTags: ['Users', 'Products'] // Only include routes with these tags
});
```

### Forwarding Headers

You can specify which headers should be forwarded from MCP requests to API calls:

```typescript
await initMcpAdapter(app, {
  forwardHeaders: ['authorization', 'x-api-key']
});
```

### CORS Configuration

If your MCP endpoint will be called from a different origin, you need to configure CORS:

```typescript
app.enableCors({
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
  methods: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'MCP-Protocol-Version', 'Authorization'],
  credentials: true
});
```

---

## Troubleshooting

### Common Issues

#### Tool names are not as expected

Check your OpenAPI tags and operation IDs. Tool names are derived from:
1. The first tag of the operation (or 'http' if no tag)
2. The operation ID (or method + path if no operation ID)

#### Missing parameters in tool input schema

Make sure your parameters are properly documented with:
- `@ApiParam` for path parameters
- `@ApiQuery` for query parameters
- `@ApiBody` for request body

#### CORS errors when calling from a frontend

Configure CORS in your NestJS application to allow the MCP-Protocol-Version header:

```typescript
app.enableCors({
  origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
  methods: ['POST', 'GET', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'MCP-Protocol-Version', 'Authorization'],
  credentials: true
});
```

#### Error: "Unknown tool"

This means the tool name in the tools/call request doesn't match any registered tool. Check the tools/list response to see the correct tool names.

---

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## License

This project is licensed under the MIT License - see the LICENSE file for details.