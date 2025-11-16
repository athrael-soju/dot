import { Tool, ToolResult, ToolInput } from '../types';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  has(name: string): boolean {
    return this.tools.has(name);
  }

  list(): string[] {
    return Array.from(this.tools.keys());
  }

  async executeSingle(
    toolName: string,
    input: ToolInput
  ): Promise<ToolResult> {
    console.log(`[ToolRegistry] ⚙️ Invoking tool: ${toolName}`);
    console.log(`[ToolRegistry] Tool input:`, JSON.stringify(input, null, 2));

    const tool = this.tools.get(toolName);
    if (!tool) {
      console.error(`[ToolRegistry] ❌ Tool '${toolName}' not found`);
      return {
        toolName,
        success: false,
        data: null,
        error: `Tool '${toolName}' not found in registry`,
        executionTime: 0,
      };
    }

    const startTime = performance.now();
    try {
      const result = await tool.execute(input);
      console.log(`[ToolRegistry] ✓ Tool ${toolName} completed in ${result.executionTime.toFixed(2)}ms`);
      console.log(`[ToolRegistry] Tool ${toolName} success: ${result.success}`);
      return result;
    } catch (error) {
      const executionTime = performance.now() - startTime;
      console.error(`[ToolRegistry] ❌ Tool ${toolName} failed:`, error);
      return {
        toolName,
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error',
        executionTime,
      };
    }
  }

  async executeMultiple(
    toolInputs: Record<string, ToolInput>
  ): Promise<ToolResult[]> {
    const toolNames = Object.keys(toolInputs);

    if (toolNames.length === 0) {
      console.log('[ToolRegistry] No tools to execute');
      return [];
    }

    console.log(`[ToolRegistry] Executing ${toolNames.length} tools in parallel: ${toolNames.join(', ')}`);

    // Execute all tools in parallel
    const results = await Promise.all(
      toolNames.map((name) => this.executeSingle(name, toolInputs[name]))
    );

    console.log(`[ToolRegistry] All tools completed. Results:`, results.map(r => `${r.toolName}: ${r.success ? '✓' : '❌'}`).join(', '));

    return results;
  }

  formatResult(toolName: string, result: ToolResult): string {
    const tool = this.tools.get(toolName);
    if (!tool) {
      return `[${toolName}] Error: Tool not found`;
    }
    return tool.formatOutput(result);
  }
}

// Singleton registry instance
let registryInstance: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!registryInstance) {
    registryInstance = new ToolRegistry();
  }
  return registryInstance;
}

export function resetToolRegistry(): void {
  registryInstance = null;
}
