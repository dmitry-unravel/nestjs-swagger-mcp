import { DynamicModule, Module } from '@nestjs/common';
import { McpController } from './mcp.controller';
import { ToolsRegistry } from './tools.registry';

@Module({})
export class McpAdapterModule {
  static forRoot(): DynamicModule {
    return {
      module: McpAdapterModule,
      controllers: [McpController],
      providers: [ToolsRegistry],
      exports: [ToolsRegistry],
      global: true,
    };
  }
}
