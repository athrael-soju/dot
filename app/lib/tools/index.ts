import { getToolRegistry } from './registry';
import { memoryRecallTool } from './memory-recall';
import { knowledgeSearchTool } from './knowledge-search';
import { clarificationCheckTool } from './clarification-check';

export function initializeTools(): void {
  const registry = getToolRegistry();

  // Register all core tools
  registry.register(memoryRecallTool);
  registry.register(knowledgeSearchTool);
  registry.register(clarificationCheckTool);
}

export { getToolRegistry, resetToolRegistry } from './registry';
export { memoryRecallTool } from './memory-recall';
export { knowledgeSearchTool } from './knowledge-search';
export { clarificationCheckTool } from './clarification-check';
