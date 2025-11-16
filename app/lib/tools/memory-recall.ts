import { Tool, ToolResult, ToolInput, MemorySearchResult } from '../types';
import { getMemoryManager } from '../memory/manager';

export const memoryRecallTool: Tool = {
  name: 'memory_recall',
  description:
    'Retrieves relevant information from past conversations and long-term memory',

  execute: async (input: ToolInput): Promise<ToolResult> => {
    const startTime = performance.now();

    try {
      const memoryManager = getMemoryManager();

      const searchResult = memoryManager.search(input.query || '', {
        timeframe: input.timeframe,
        keywords: input.keywords,
        maxResults: 5,
      });

      const executionTime = performance.now() - startTime;

      return {
        toolName: 'memory_recall',
        success: true,
        data: searchResult,
        executionTime,
        metadata: {
          entriesFound: searchResult.totalFound,
          timeframe: input.timeframe,
        },
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        toolName: 'memory_recall',
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Memory search failed',
        executionTime,
      };
    }
  },

  formatOutput: (result: ToolResult): string => {
    if (!result.success) {
      return `Memory recall failed: ${result.error}`;
    }

    const searchResult = result.data as MemorySearchResult;

    if (searchResult.totalFound === 0) {
      return 'No relevant memories found for this query.';
    }

    const memoryManager = getMemoryManager();
    const formatted = memoryManager.formatMemoryForContext(searchResult.entries);

    return `Found ${searchResult.totalFound} relevant memories:\n${formatted}`;
  },
};
