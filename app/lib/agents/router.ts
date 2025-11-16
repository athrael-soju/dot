import { Message, RoutingDecision, IntentType, ToolInput } from '../types';

// Pattern definitions for intent classification
const MEMORY_PATTERNS = [
  /remember|recall|last time|previously|earlier|you said|we discussed|mentioned/i,
  /what did (i|you|we) (say|discuss|talk about)/i,
  /history|past conversation/i,
];

const KNOWLEDGE_PATTERNS = [
  /how (do|does|to|can)|what is|explain|tell me about|describe/i,
  /best practice|documentation|guide|tutorial/i,
  /information (on|about)|learn about/i,
];

const CLARIFICATION_INDICATORS = [
  /^(it|this|that|the thing|something)$/i,
  /^.{1,15}$/,
  /^(yes|no|ok|sure|maybe)$/i,
];

export class RouterAgent {
  private conversationHistory: Message[] = [];

  constructor() {
    console.log('[RouterAgent] Initialized');
  }

  route(userMessage: Message, history: Message[] = []): RoutingDecision {
    console.log('[RouterAgent] ← Received message for routing:', userMessage.content.substring(0, 100));
    console.log('[RouterAgent] Analyzing intent...');

    this.conversationHistory = history;
    const content = userMessage.content.toLowerCase();

    // Check for multi-tool scenarios first
    const multiToolDecision = this.checkMultiTool(content, userMessage);
    if (multiToolDecision) {
      console.log('[RouterAgent] → Decision: MULTI_TOOL');
      console.log('[RouterAgent] Selected tools:', multiToolDecision.selectedTools.join(', '));
      console.log('[RouterAgent] Confidence:', (multiToolDecision.confidence * 100).toFixed(0) + '%');
      return multiToolDecision;
    }

    // Check for memory access patterns
    if (this.matchesPatterns(content, MEMORY_PATTERNS)) {
      const decision = this.createMemoryDecision(userMessage);
      console.log('[RouterAgent] → Decision: MEMORY_ACCESS');
      console.log('[RouterAgent] Selected tools:', decision.selectedTools.join(', '));
      console.log('[RouterAgent] Confidence:', (decision.confidence * 100).toFixed(0) + '%');
      return decision;
    }

    // Check for knowledge retrieval patterns
    if (this.matchesPatterns(content, KNOWLEDGE_PATTERNS)) {
      const decision = this.createKnowledgeDecision(userMessage);
      console.log('[RouterAgent] → Decision: KNOWLEDGE_RETRIEVAL');
      console.log('[RouterAgent] Selected tools:', decision.selectedTools.join(', '));
      console.log('[RouterAgent] Confidence:', (decision.confidence * 100).toFixed(0) + '%');
      return decision;
    }

    // Check if clarification is needed
    if (this.needsClarification(content, userMessage)) {
      const decision = this.createClarificationDecision(userMessage);
      console.log('[RouterAgent] → Decision: CLARIFICATION_NEEDED');
      console.log('[RouterAgent] Selected tools:', decision.selectedTools.join(', '));
      console.log('[RouterAgent] Confidence:', (decision.confidence * 100).toFixed(0) + '%');
      return decision;
    }

    // Default to conversation
    const decision = this.createConversationDecision(userMessage);
    console.log('[RouterAgent] → Decision: CONVERSATION');
    console.log('[RouterAgent] No tools selected (direct response)');
    console.log('[RouterAgent] Confidence:', (decision.confidence * 100).toFixed(0) + '%');
    return decision;
  }

  private matchesPatterns(text: string, patterns: RegExp[]): boolean {
    return patterns.some((pattern) => pattern.test(text));
  }

  private checkMultiTool(
    content: string,
    userMessage: Message
  ): RoutingDecision | null {
    // Check if both memory and knowledge are needed
    const needsMemory = this.matchesPatterns(content, MEMORY_PATTERNS);
    const needsKnowledge = this.matchesPatterns(content, KNOWLEDGE_PATTERNS);

    if (needsMemory && needsKnowledge) {
      return {
        intent: 'multi_tool',
        confidence: 0.85,
        selectedTools: ['memory_recall', 'knowledge_search'],
        toolInputs: {
          memory_recall: this.extractMemoryInput(userMessage),
          knowledge_search: this.extractKnowledgeInput(userMessage),
        },
        reasoning:
          'User query requires both memory recall and knowledge retrieval',
      };
    }

    return null;
  }

  private needsClarification(content: string, userMessage: Message): boolean {
    // Short ambiguous responses
    if (this.matchesPatterns(content, CLARIFICATION_INDICATORS)) {
      return true;
    }

    // Pronoun-heavy without clear context
    const pronounCount = (content.match(/\b(it|this|that|they)\b/gi) || [])
      .length;
    const hasNoContext =
      this.conversationHistory.length === 0 || content.length < 20;

    if (pronounCount > 2 && hasNoContext) {
      return true;
    }

    // Very short message with no clear intent
    if (content.split(' ').length <= 3 && !this.hasVerb(content)) {
      return true;
    }

    return false;
  }

  private hasVerb(text: string): boolean {
    const commonVerbs =
      /\b(is|are|was|were|do|does|did|have|has|had|can|could|will|would|should|get|make|know|think|want|need|see|find|tell|ask|use|try)\b/i;
    return commonVerbs.test(text);
  }

  private createMemoryDecision(userMessage: Message): RoutingDecision {
    return {
      intent: 'memory_access',
      confidence: 0.9,
      selectedTools: ['memory_recall'],
      toolInputs: {
        memory_recall: this.extractMemoryInput(userMessage),
      },
      reasoning: 'User is requesting information from past conversations',
    };
  }

  private createKnowledgeDecision(userMessage: Message): RoutingDecision {
    return {
      intent: 'knowledge_retrieval',
      confidence: 0.9,
      selectedTools: ['knowledge_search'],
      toolInputs: {
        knowledge_search: this.extractKnowledgeInput(userMessage),
      },
      reasoning: 'User is requesting factual information or explanations',
    };
  }

  private createClarificationDecision(userMessage: Message): RoutingDecision {
    return {
      intent: 'clarification_needed',
      confidence: 0.85,
      selectedTools: ['clarification_check'],
      toolInputs: {
        clarification_check: {
          query: userMessage.content,
          parameters: {
            lastMessages: this.conversationHistory.slice(-3),
          },
        },
      },
      reasoning: 'User message is ambiguous or lacks sufficient context',
    };
  }

  private createConversationDecision(userMessage: Message): RoutingDecision {
    return {
      intent: 'conversation',
      confidence: 0.95,
      selectedTools: [],
      toolInputs: {},
      reasoning: 'General conversational exchange, no specific tools needed',
    };
  }

  private extractMemoryInput(userMessage: Message): ToolInput {
    const content = userMessage.content.toLowerCase();

    // Extract timeframe if mentioned
    let timeframe: string | undefined;
    if (/last week|past week/i.test(content)) {
      timeframe = 'week';
    } else if (/yesterday|last day/i.test(content)) {
      timeframe = 'day';
    } else if (/last month|past month/i.test(content)) {
      timeframe = 'month';
    }

    // Extract keywords (nouns and important terms)
    const keywords = this.extractKeywords(userMessage.content);

    return {
      query: userMessage.content,
      timeframe,
      keywords,
    };
  }

  private extractKnowledgeInput(userMessage: Message): ToolInput {
    const content = userMessage.content.toLowerCase();

    // Determine category based on content
    let category: string | undefined;
    if (/code|programming|function|api/i.test(content)) {
      category = 'programming';
    } else if (/design|ui|ux|interface/i.test(content)) {
      category = 'design';
    } else if (/database|sql|query|data/i.test(content)) {
      category = 'data';
    }

    const keywords = this.extractKeywords(userMessage.content);

    return {
      query: userMessage.content,
      category,
      keywords,
    };
  }

  private extractKeywords(text: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'being',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'to',
      'of',
      'in',
      'for',
      'on',
      'with',
      'at',
      'by',
      'from',
      'up',
      'about',
      'into',
      'through',
      'during',
      'before',
      'after',
      'above',
      'below',
      'between',
      'under',
      'again',
      'further',
      'then',
      'once',
      'here',
      'there',
      'when',
      'where',
      'why',
      'how',
      'all',
      'any',
      'both',
      'each',
      'few',
      'more',
      'most',
      'other',
      'some',
      'such',
      'no',
      'nor',
      'not',
      'only',
      'own',
      'same',
      'so',
      'than',
      'too',
      'very',
      'just',
      'i',
      'you',
      'he',
      'she',
      'it',
      'we',
      'they',
      'what',
      'which',
      'who',
      'whom',
      'this',
      'that',
      'these',
      'those',
      'am',
      'and',
      'but',
      'if',
      'or',
      'because',
      'as',
      'until',
      'while',
    ]);

    const words = text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !stopWords.has(word));

    // Return unique keywords
    return [...new Set(words)];
  }
}
