import { ToolDefinition, ToolResult, KnowledgeItem } from './types';

// In-memory knowledge base for demonstration
const knowledgeBase: KnowledgeItem[] = [
  {
    id: 'kb-1',
    content: 'The multi-agent system consists of four specialized agents: Router, Tool Executor, Context Builder, and Response Agent.',
    metadata: { topic: 'architecture', keywords: ['agents', 'system', 'architecture'] }
  },
  {
    id: 'kb-2',
    content: 'Eva uses the Marin voice and communicates with natural warmth and intelligence.',
    metadata: { topic: 'assistant', keywords: ['eva', 'voice', 'personality'] }
  },
  {
    id: 'kb-3',
    content: 'Tools can be executed in parallel for better performance when they have no dependencies.',
    metadata: { topic: 'tools', keywords: ['parallel', 'execution', 'performance'] }
  },
  {
    id: 'kb-4',
    content: 'The system uses WebRTC for real-time audio streaming with low latency.',
    metadata: { topic: 'technology', keywords: ['webrtc', 'audio', 'streaming', 'realtime'] }
  },
  {
    id: 'kb-5',
    content: 'Memory can be stored with optional TTL (time-to-live) for automatic expiration.',
    metadata: { topic: 'memory', keywords: ['storage', 'ttl', 'expiration'] }
  }
];

// Knowledge Base Search Tool
export const searchKnowledgeTool: ToolDefinition = {
  name: 'search_knowledge',
  description: 'Search the knowledge base for relevant information about a topic or query. Use this when the user asks factual questions or needs information.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query or topic to find information about'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum number of results to return (default: 3)'
      }
    },
    required: ['query']
  },
  execute: async (params): Promise<ToolResult> => {
    const query = (params.query as string).toLowerCase();
    const maxResults = (params.maxResults as number) || 3;

    try {
      // Simple keyword matching for demonstration
      const results = knowledgeBase
        .map(item => {
          const contentMatch = item.content.toLowerCase().includes(query);
          const keywords = item.metadata.keywords as string[] | undefined;
          const keywordMatch = keywords?.some(
            (kw: string) => kw.toLowerCase().includes(query) || query.includes(kw.toLowerCase())
          );
          const topicMatch = (item.metadata.topic as string)?.toLowerCase().includes(query);

          let score = 0;
          if (contentMatch) score += 0.5;
          if (keywordMatch) score += 0.3;
          if (topicMatch) score += 0.2;

          return { ...item, relevanceScore: score };
        })
        .filter(item => item.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, maxResults);

      return {
        success: true,
        data: {
          query,
          results,
          totalFound: results.length
        },
        metadata: {
          searchTime: Date.now()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Knowledge base search failed'
      };
    }
  }
};

// Memory Store for the session
const sessionMemory = new Map<string, { value: unknown; timestamp: number; ttl?: number }>();

// Get Memory Tool
export const getMemoryTool: ToolDefinition = {
  name: 'get_memory',
  description: 'Retrieve stored information from session memory. Use this when the user references something from earlier in the conversation or asks about stored preferences.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key to retrieve from memory'
      },
      keys: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple keys to retrieve at once'
      }
    },
    required: []
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const singleKey = params.key as string | undefined;
      const multipleKeys = params.keys as string[] | undefined;

      if (singleKey) {
        const entry = sessionMemory.get(singleKey);
        if (!entry) {
          return {
            success: true,
            data: { key: singleKey, found: false, value: null }
          };
        }

        // Check TTL
        if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
          sessionMemory.delete(singleKey);
          return {
            success: true,
            data: { key: singleKey, found: false, value: null, reason: 'expired' }
          };
        }

        return {
          success: true,
          data: { key: singleKey, found: true, value: entry.value }
        };
      }

      if (multipleKeys) {
        const results: Record<string, unknown> = {};
        for (const key of multipleKeys) {
          const entry = sessionMemory.get(key);
          if (entry && (!entry.ttl || Date.now() - entry.timestamp <= entry.ttl)) {
            results[key] = entry.value;
          } else {
            results[key] = null;
          }
        }
        return {
          success: true,
          data: results
        };
      }

      // Return all memory if no specific key
      const allMemory: Record<string, unknown> = {};
      for (const [key, entry] of sessionMemory.entries()) {
        if (!entry.ttl || Date.now() - entry.timestamp <= entry.ttl) {
          allMemory[key] = entry.value;
        }
      }
      return {
        success: true,
        data: { allMemory }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Memory retrieval failed'
      };
    }
  }
};

// Set Memory Tool
export const setMemoryTool: ToolDefinition = {
  name: 'set_memory',
  description: 'Store information in session memory for later retrieval. Use this to remember user preferences, important facts, or context for future interactions.',
  parameters: {
    type: 'object',
    properties: {
      key: {
        type: 'string',
        description: 'The key to store the value under'
      },
      value: {
        type: 'any',
        description: 'The value to store'
      },
      ttl: {
        type: 'number',
        description: 'Optional time-to-live in milliseconds'
      }
    },
    required: ['key', 'value']
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const key = params.key as string;
      const value = params.value;
      const ttl = params.ttl as number | undefined;

      sessionMemory.set(key, {
        value,
        timestamp: Date.now(),
        ttl
      });

      return {
        success: true,
        data: {
          key,
          stored: true,
          ttl: ttl ? `Expires in ${ttl}ms` : 'No expiration'
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Memory storage failed'
      };
    }
  }
};

// User Context Tool - Gets information about the current user/session
export const getUserContextTool: ToolDefinition = {
  name: 'get_user_context',
  description: 'Get contextual information about the current user session, including session duration, interaction count, and preferences.',
  parameters: {
    type: 'object',
    properties: {},
    required: []
  },
  execute: async (): Promise<ToolResult> => {
    try {
      const sessionStart = sessionMemory.get('session_start')?.value as number || Date.now();
      const interactionCount = (sessionMemory.get('interaction_count')?.value as number) || 0;

      // Increment interaction count
      sessionMemory.set('interaction_count', {
        value: interactionCount + 1,
        timestamp: Date.now()
      });

      return {
        success: true,
        data: {
          sessionDuration: Date.now() - sessionStart,
          interactionCount: interactionCount + 1,
          preferences: sessionMemory.get('user_preferences')?.value || {},
          lastInteraction: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get user context'
      };
    }
  }
};

// Sentiment Analysis Tool (simplified simulation)
export const analyzeSentimentTool: ToolDefinition = {
  name: 'analyze_sentiment',
  description: 'Analyze the sentiment and emotional tone of a user message. Use this to better understand the user\'s emotional state.',
  parameters: {
    type: 'object',
    properties: {
      text: {
        type: 'string',
        description: 'The text to analyze'
      }
    },
    required: ['text']
  },
  execute: async (params): Promise<ToolResult> => {
    try {
      const text = (params.text as string).toLowerCase();

      // Simple keyword-based sentiment (for demonstration)
      const positiveWords = ['happy', 'great', 'love', 'excellent', 'wonderful', 'good', 'thanks', 'thank you', 'awesome', 'perfect'];
      const negativeWords = ['sad', 'bad', 'hate', 'terrible', 'awful', 'wrong', 'problem', 'issue', 'frustrated', 'angry'];
      const urgentWords = ['urgent', 'asap', 'immediately', 'help', 'emergency', 'critical', 'important'];

      let positiveScore = 0;
      let negativeScore = 0;
      let urgencyScore = 0;

      positiveWords.forEach(word => {
        if (text.includes(word)) positiveScore++;
      });

      negativeWords.forEach(word => {
        if (text.includes(word)) negativeScore++;
      });

      urgentWords.forEach(word => {
        if (text.includes(word)) urgencyScore++;
      });

      const totalScore = positiveScore - negativeScore;
      let sentiment: 'positive' | 'negative' | 'neutral';
      if (totalScore > 0) sentiment = 'positive';
      else if (totalScore < 0) sentiment = 'negative';
      else sentiment = 'neutral';

      return {
        success: true,
        data: {
          sentiment,
          confidence: Math.min(1, (positiveScore + negativeScore) / 3),
          urgency: urgencyScore > 0 ? 'high' : 'normal',
          emotionalIntensity: Math.min(1, (positiveScore + negativeScore) / 5)
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Sentiment analysis failed'
      };
    }
  }
};

// Get all default tools
export function getDefaultTools(): ToolDefinition[] {
  // Initialize session start time
  if (!sessionMemory.has('session_start')) {
    sessionMemory.set('session_start', {
      value: Date.now(),
      timestamp: Date.now()
    });
  }

  return [
    searchKnowledgeTool,
    getMemoryTool,
    setMemoryTool,
    getUserContextTool,
    analyzeSentimentTool
  ];
}

// Clear session memory (for testing or reset)
export function clearSessionMemory(): void {
  sessionMemory.clear();
}

// Export the memory map for direct access if needed
export { sessionMemory };
