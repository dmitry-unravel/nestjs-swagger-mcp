import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { initMcpAdapter } from '@reliqio/nestjs-swagger-mcp';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // CORS so the React client can call /mcp
  app.enableCors({
    origin: ['http://127.0.0.1:5173', 'http://localhost:5173'],
    methods: ['POST','GET','PUT','PATCH','DELETE','OPTIONS'],
    allowedHeaders: ['Content-Type','Accept','MCP-Protocol-Version','Authorization'],
    credentials: true
  });

  // Create a Swagger document (adapter also creates its own—but this helps enrich schemas from your decorators)
  const config = new DocumentBuilder().setTitle('Sample API').setVersion('1.0').build();
  SwaggerModule.createDocument(app, config);

  await app.listen(3000, '127.0.0.1');
  await initMcpAdapter(app); // build tools after app is listening

  console.log('REST: http://127.0.0.1:3000');
  console.log('MCP : http://127.0.0.1:3000/mcp');
}
bootstrap();
