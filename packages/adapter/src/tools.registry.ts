import { Injectable } from '@nestjs/common';
import type { McpToolDef } from './types';

@Injectable()
export class ToolsRegistry {
  private tools: McpToolDef[] = [];
  setTools(tools: McpToolDef[]) {
    this.tools = tools;
  }
  getAll(): McpToolDef[] {
    return this.tools;
  }
}
