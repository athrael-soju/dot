import { Message, MemoryEntry, MemorySearchResult } from '../types';

export class MemoryManager {
  private sessionHistory: Message[] = [];
  private longTermMemory: MemoryEntry[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = this.generateId();
    console.log('[MemoryManager] Initialized with session ID:', this.sessionId);
    this.initializeMockMemory();
    console.log('[MemoryManager] Loaded', this.longTermMemory.length, 'long-term memories');
  }

  private generateId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private initializeMockMemory(): void {
    // Initialize with some mock long-term memory for demonstration
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    this.longTermMemory = [
      {
        id: 'mem_1',
        content: 'User discussed implementing a caching strategy for API responses',
        timestamp: now - 2 * dayMs,
        topics: ['caching', 'api', 'performance'],
      },
      {
        id: 'mem_2',
        content: 'User asked about best practices for error handling in TypeScript',
        timestamp: now - 5 * dayMs,
        topics: ['typescript', 'error-handling', 'best-practices'],
      },
      {
        id: 'mem_3',
        content: 'User mentioned they are building a voice-first AI assistant',
        timestamp: now - 7 * dayMs,
        topics: ['voice', 'ai', 'assistant', 'project'],
      },
      {
        id: 'mem_4',
        content: 'User prefers functional programming patterns over OOP',
        timestamp: now - 10 * dayMs,
        topics: ['programming', 'functional', 'preferences'],
      },
    ];
  }

  addToSession(message: Message): void {
    this.sessionHistory.push(message);
  }

  getSessionHistory(): Message[] {
    return [...this.sessionHistory];
  }

  getRecentHistory(count: number = 10): Message[] {
    return this.sessionHistory.slice(-count);
  }

  clearSession(): void {
    this.sessionHistory = [];
    this.sessionId = this.generateId();
  }

  addToLongTermMemory(
    content: string,
    topics: string[] = []
  ): MemoryEntry {
    const entry: MemoryEntry = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      content,
      timestamp: Date.now(),
      topics,
    };

    this.longTermMemory.push(entry);
    return entry;
  }

  search(
    query: string,
    options: {
      timeframe?: string;
      keywords?: string[];
      maxResults?: number;
    } = {}
  ): MemorySearchResult {
    const { timeframe, keywords = [], maxResults = 5 } = options;

    // Filter by timeframe if specified
    let filteredMemory = this.filterByTimeframe(timeframe);

    // Calculate relevance scores
    const queryKeywords = this.extractQueryKeywords(query);
    const allKeywords = [...queryKeywords, ...keywords];

    const scoredMemory = filteredMemory.map((entry) => ({
      ...entry,
      relevanceScore: this.calculateRelevance(entry, allKeywords),
    }));

    // Sort by relevance and filter out low scores
    const relevantMemory = scoredMemory
      .filter((entry) => entry.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, maxResults);

    return {
      entries: relevantMemory,
      totalFound: relevantMemory.length,
      searchQuery: query,
    };
  }

  private filterByTimeframe(timeframe?: string): MemoryEntry[] {
    if (!timeframe) {
      return [...this.longTermMemory];
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    let cutoffTime: number;
    switch (timeframe) {
      case 'day':
        cutoffTime = now - dayMs;
        break;
      case 'week':
        cutoffTime = now - 7 * dayMs;
        break;
      case 'month':
        cutoffTime = now - 30 * dayMs;
        break;
      default:
        return [...this.longTermMemory];
    }

    return this.longTermMemory.filter((entry) => entry.timestamp >= cutoffTime);
  }

  private extractQueryKeywords(query: string): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
      'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'can', 'to', 'of', 'in', 'for', 'on',
      'with', 'at', 'by', 'from', 'about', 'what', 'when', 'where',
      'why', 'how', 'i', 'you', 'we', 'they', 'me', 'my', 'your',
      'remember', 'recall', 'mentioned', 'said', 'discussed', 'talked',
    ]);

    return query
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));
  }

  private calculateRelevance(entry: MemoryEntry, keywords: string[]): number {
    if (keywords.length === 0) {
      return 0.1; // Base relevance for all entries when no keywords
    }

    let score = 0;
    const contentLower = entry.content.toLowerCase();
    const topicsLower = entry.topics.map((t) => t.toLowerCase());

    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();

      // Check content match
      if (contentLower.includes(keywordLower)) {
        score += 1;
      }

      // Check topic match (higher weight)
      if (topicsLower.some((topic) => topic.includes(keywordLower))) {
        score += 2;
      }
    }

    // Normalize score based on keyword count
    return score / keywords.length;
  }

  getSummary(): string {
    const recentCount = Math.min(3, this.sessionHistory.length);
    const totalMemories = this.longTermMemory.length;

    let summary = `Session ID: ${this.sessionId}\n`;
    summary += `Messages in session: ${this.sessionHistory.length}\n`;
    summary += `Long-term memories: ${totalMemories}\n`;

    if (recentCount > 0) {
      summary += `\nRecent conversation:\n`;
      this.sessionHistory.slice(-recentCount).forEach((msg) => {
        summary += `- [${msg.role}]: ${msg.content.substring(0, 100)}...\n`;
      });
    }

    return summary;
  }

  formatMemoryForContext(memories: MemoryEntry[]): string {
    if (memories.length === 0) {
      return 'No relevant memories found.';
    }

    return memories
      .map((mem) => {
        const date = new Date(mem.timestamp).toLocaleDateString();
        const relevance = mem.relevanceScore
          ? ` (relevance: ${(mem.relevanceScore * 100).toFixed(0)}%)`
          : '';
        return `[${date}]${relevance}: ${mem.content}`;
      })
      .join('\n');
  }
}

// Singleton instance
let memoryInstance: MemoryManager | null = null;

export function getMemoryManager(): MemoryManager {
  if (!memoryInstance) {
    memoryInstance = new MemoryManager();
  }
  return memoryInstance;
}

export function resetMemoryManager(): void {
  memoryInstance = null;
}
