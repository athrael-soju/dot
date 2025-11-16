import { Tool, ToolResult, ToolInput } from '../types';

// Mock knowledge base - in production, this would connect to a vector DB or document store
const KNOWLEDGE_BASE: Record<string, string[]> = {
  programming: [
    'Use TypeScript for type safety in large applications',
    'Prefer functional programming patterns for better testability',
    'Implement proper error handling with try-catch and custom error types',
    'Use dependency injection for better code modularity',
    'Follow SOLID principles for maintainable code',
  ],
  design: [
    'Prioritize user experience over visual aesthetics',
    'Use consistent spacing and typography throughout the UI',
    'Implement responsive design for multi-device support',
    'Follow accessibility guidelines (WCAG) for inclusive design',
    'Use design systems for consistency across the application',
  ],
  data: [
    'Normalize database schemas to reduce redundancy',
    'Use indexes on frequently queried columns',
    'Implement proper data validation at both client and server',
    'Consider eventual consistency for distributed systems',
    'Use caching strategies to improve query performance',
  ],
  performance: [
    'Lazy load components that are not immediately visible',
    'Implement code splitting to reduce initial bundle size',
    'Use memoization for expensive computations',
    'Optimize images and assets for faster loading',
    'Profile and measure before optimizing',
  ],
  security: [
    'Never store sensitive data in plain text',
    'Implement proper authentication and authorization',
    'Sanitize all user inputs to prevent injection attacks',
    'Use HTTPS for all communications',
    'Follow the principle of least privilege',
  ],
};

export const knowledgeSearchTool: Tool = {
  name: 'knowledge_search',
  description:
    'Searches the knowledge base for relevant information, best practices, and documentation',

  execute: async (input: ToolInput): Promise<ToolResult> => {
    const startTime = performance.now();

    try {
      const query = input.query || '';
      const category = input.category;
      const keywords = input.keywords || [];

      // Extract keywords from query if not provided
      const searchTerms =
        keywords.length > 0 ? keywords : extractSearchTerms(query);

      let results: string[] = [];
      let searchedCategories: string[] = [];

      // If category specified, search that category
      if (category && KNOWLEDGE_BASE[category]) {
        searchedCategories.push(category);
        results = searchInCategory(category, searchTerms);
      } else {
        // Search all categories
        searchedCategories = Object.keys(KNOWLEDGE_BASE);
        for (const cat of searchedCategories) {
          const categoryResults = searchInCategory(cat, searchTerms);
          results.push(...categoryResults);
        }
      }

      // Deduplicate and limit results
      const uniqueResults = [...new Set(results)].slice(0, 5);

      const executionTime = performance.now() - startTime;

      return {
        toolName: 'knowledge_search',
        success: true,
        data: {
          results: uniqueResults,
          searchTerms,
          categoriesSearched: searchedCategories,
          totalResults: uniqueResults.length,
        },
        executionTime,
        metadata: {
          category,
          queryLength: query.length,
        },
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        toolName: 'knowledge_search',
        success: false,
        data: null,
        error:
          error instanceof Error ? error.message : 'Knowledge search failed',
        executionTime,
      };
    }
  },

  formatOutput: (result: ToolResult): string => {
    if (!result.success) {
      return `Knowledge search failed: ${result.error}`;
    }

    const data = result.data as {
      results: string[];
      searchTerms: string[];
      categoriesSearched: string[];
      totalResults: number;
    };

    if (data.totalResults === 0) {
      return 'No relevant knowledge found for this query.';
    }

    let output = `Found ${data.totalResults} relevant knowledge items:\n\n`;
    data.results.forEach((item, index) => {
      output += `${index + 1}. ${item}\n`;
    });

    return output;
  },
};

function extractSearchTerms(query: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'can', 'to', 'of', 'in', 'for', 'on',
    'with', 'at', 'by', 'from', 'about', 'what', 'when', 'where',
    'why', 'how', 'i', 'you', 'we', 'they', 'me', 'my', 'your',
    'tell', 'explain', 'describe', 'information', 'know', 'best',
    'practice', 'practices',
  ]);

  return query
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word));
}

function searchInCategory(category: string, searchTerms: string[]): string[] {
  const categoryKnowledge = KNOWLEDGE_BASE[category] || [];

  if (searchTerms.length === 0) {
    // Return first few items if no search terms
    return categoryKnowledge.slice(0, 2);
  }

  // Score each knowledge item
  const scoredItems = categoryKnowledge.map((item) => {
    const itemLower = item.toLowerCase();
    let score = 0;

    for (const term of searchTerms) {
      if (itemLower.includes(term)) {
        score += 1;
      }
    }

    return { item, score };
  });

  // Return items with score > 0, sorted by score
  return scoredItems
    .filter((si) => si.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((si) => si.item);
}
