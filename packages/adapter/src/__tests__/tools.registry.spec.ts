import { ToolsRegistry } from '../tools.registry';
import type { McpToolDef } from '../types';

const stubTool = (name: string): McpToolDef => ({
  name,
  inputSchema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  handler: async () => ({ content: [] }),
});

describe('ToolsRegistry', () => {
  let registry: ToolsRegistry;

  beforeEach(() => {
    registry = new ToolsRegistry();
  });

  it('starts empty', () => {
    expect(registry.getAll()).toEqual([]);
  });

  it('returns tools after setTools', () => {
    const tools = [stubTool('a'), stubTool('b')];
    registry.setTools(tools);
    expect(registry.getAll()).toBe(tools);
  });

  it('replaces tools on successive setTools calls', () => {
    registry.setTools([stubTool('old')]);
    const next = [stubTool('new')];
    registry.setTools(next);
    expect(registry.getAll()).toBe(next);
    expect(registry.getAll()).toHaveLength(1);
  });
});
