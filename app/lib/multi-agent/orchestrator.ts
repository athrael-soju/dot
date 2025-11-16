import { RouterAgent } from './router-agent';
import { ToolExecutorAgent } from './tool-executor-agent';
import { ContextBuilderAgent } from './context-builder-agent';
import { createResponseAgent, formatContextForResponse } from './response-agent';
import {
  ConversationMessage,
  PipelineState,
  MultiAgentConfig,
  ToolDefinition,
  ResponseContext,
  MemoryEntry
} from './types';
import { RealtimeAgent } from '@openai/agents/realtime';
import type { RealtimeSession } from '@openai/agents/realtime';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_CONFIG: MultiAgentConfig = {
  maxToolExecutionTime: 30000,
  maxConversationHistory: 50,
  enableParallelToolExecution: true,
  debugMode: false
};

export class MultiAgentOrchestrator {
  private routerAgent: RouterAgent;
  private toolExecutorAgent: ToolExecutorAgent;
  private contextBuilderAgent: ContextBuilderAgent;
  private responseAgent: RealtimeAgent | null = null;
  private state: PipelineState;
  private config: MultiAgentConfig;
  private apiKey: string;

  constructor(apiKey: string, config: Partial<MultiAgentConfig> = {}) {
    this.apiKey = apiKey;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize text-based agents
    this.routerAgent = new RouterAgent(apiKey);
    this.toolExecutorAgent = new ToolExecutorAgent(
      apiKey,
      'gpt-4o-mini',
      this.config.maxToolExecutionTime,
      this.config.enableParallelToolExecution
    );
    this.contextBuilderAgent = new ContextBuilderAgent(apiKey);

    // Initialize pipeline state
    this.state = {
      conversationHistory: [],
      memory: new Map(),
      sessionId: uuidv4(),
      startTime: Date.now()
    };
  }

  // Initialize the Response Agent (voice-enabled)
  createResponseAgent(
    onDisconnect: () => void,
    getSession: () => RealtimeSession | null
  ): RealtimeAgent {
    this.responseAgent = createResponseAgent(onDisconnect, getSession);
    return this.responseAgent;
  }

  // Register tools that can be used by the system
  registerTool(tool: ToolDefinition): void {
    this.toolExecutorAgent.registerTool(tool);
  }

  registerTools(tools: ToolDefinition[]): void {
    this.toolExecutorAgent.registerTools(tools);
  }

  // Main pipeline: Process user message through all agents
  async processMessage(userMessage: string): Promise<string> {
    const startTime = Date.now();

    // Add user message to history
    this.addToHistory('user', userMessage);

    if (this.config.debugMode) {
      console.log(`[Orchestrator] Processing: "${userMessage}"`);
    }

    try {
      // Step 1: Route the message
      const availableTools = this.toolExecutorAgent.getAvailableTools();
      const routingDecision = await this.routerAgent.route(
        userMessage,
        this.state.conversationHistory,
        availableTools
      );

      if (this.config.debugMode) {
        console.log('[Router] Decision:', routingDecision);
      }

      // Step 2: Check if clarification is needed
      if (routingDecision.needsClarification && routingDecision.clarificationQuestion) {
        const clarificationContext: ResponseContext = {
          originalMessage: userMessage,
          intent: 'clarification_needed',
          toolResults: [],
          conversationHistory: this.state.conversationHistory,
          formattedContext: `The user's request needs clarification. Suggested question: "${routingDecision.clarificationQuestion}"`,
          suggestedResponseStyle: {
            tone: 'friendly',
            verbosity: 'concise',
            includeFollowUp: true
          }
        };

        const response = formatContextForResponse(clarificationContext);
        this.addToHistory('assistant', response);
        return response;
      }

      // Step 3: Execute selected tools
      const toolResults = await this.toolExecutorAgent.executeTools(
        routingDecision.selectedTools,
        userMessage,
        this.state.conversationHistory
      );

      if (this.config.debugMode) {
        console.log('[Tool Executor] Results:', toolResults);
      }

      // Step 4: Build context for response
      const responseContext = await this.contextBuilderAgent.buildContext(
        userMessage,
        routingDecision.intent,
        toolResults,
        this.state.conversationHistory
      );

      if (this.config.debugMode) {
        console.log('[Context Builder] Context:', responseContext);
      }

      // Step 5: Format for Response Agent
      const formattedResponse = formatContextForResponse(responseContext);

      // Track processing time
      const processingTime = Date.now() - startTime;
      if (this.config.debugMode) {
        console.log(`[Orchestrator] Total processing time: ${processingTime}ms`);
      }

      return formattedResponse;
    } catch (error) {
      console.error('[Orchestrator] Pipeline error:', error);

      // Return a fallback context
      const fallbackContext: ResponseContext = {
        originalMessage: userMessage,
        intent: 'general_conversation',
        toolResults: [],
        conversationHistory: this.state.conversationHistory,
        formattedContext: 'Unable to process additional context. Please respond based on the user message directly.',
        suggestedResponseStyle: {
          tone: 'friendly',
          verbosity: 'balanced',
          includeFollowUp: false
        }
      };

      return formatContextForResponse(fallbackContext);
    }
  }

  // Manage conversation history
  private addToHistory(role: 'user' | 'assistant' | 'system', content: string): void {
    this.state.conversationHistory.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Trim history if too long
    if (this.state.conversationHistory.length > this.config.maxConversationHistory) {
      this.state.conversationHistory = this.state.conversationHistory.slice(-this.config.maxConversationHistory);
    }
  }

  // Memory management
  setMemory(key: string, value: unknown, ttl?: number): void {
    this.state.memory.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttl
    });
  }

  getMemory(key: string): unknown | undefined {
    const entry = this.state.memory.get(key);
    if (!entry) return undefined;

    // Check TTL
    if (entry.ttl && Date.now() - entry.timestamp > entry.ttl) {
      this.state.memory.delete(key);
      return undefined;
    }

    return entry.value;
  }

  deleteMemory(key: string): boolean {
    return this.state.memory.delete(key);
  }

  getAllMemory(): Map<string, MemoryEntry> {
    // Clean expired entries
    const now = Date.now();
    for (const [key, entry] of this.state.memory.entries()) {
      if (entry.ttl && now - entry.timestamp > entry.ttl) {
        this.state.memory.delete(key);
      }
    }
    return this.state.memory;
  }

  // Get conversation history
  getConversationHistory(): ConversationMessage[] {
    return [...this.state.conversationHistory];
  }

  // Clear conversation history
  clearHistory(): void {
    this.state.conversationHistory = [];
  }

  // Get session information
  getSessionInfo(): { sessionId: string; startTime: number; uptime: number } {
    return {
      sessionId: this.state.sessionId,
      startTime: this.state.startTime,
      uptime: Date.now() - this.state.startTime
    };
  }

  // Reset the entire pipeline
  reset(): void {
    this.state = {
      conversationHistory: [],
      memory: new Map(),
      sessionId: uuidv4(),
      startTime: Date.now()
    };
    this.responseAgent = null;
  }
}
