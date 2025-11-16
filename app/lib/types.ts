// Core message types for the multi-agent system

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

export interface ToolResultMessage extends Message {
  role: 'tool';
  toolName: string;
  toolCallId: string;
  success: boolean;
}

// Intent classification types
export type IntentType =
  | 'knowledge_retrieval'
  | 'memory_access'
  | 'clarification_needed'
  | 'conversation'
  | 'multi_tool';

export interface RoutingDecision {
  intent: IntentType;
  confidence: number;
  selectedTools: string[];
  toolInputs: Record<string, ToolInput>;
  reasoning: string;
}

export interface ToolInput {
  query?: string;
  timeframe?: string;
  category?: string;
  keywords?: string[];
  parameters?: Record<string, unknown>;
}

// Tool execution types
export interface ToolResult {
  toolName: string;
  success: boolean;
  data: unknown;
  error?: string;
  executionTime: number;
  metadata?: Record<string, unknown>;
}

export interface Tool {
  name: string;
  description: string;
  execute: (input: ToolInput) => Promise<ToolResult>;
  formatOutput: (result: ToolResult) => string;
}

// Context building types
export interface ContextFrame {
  userMessage: Message;
  conversationHistory: Message[];
  routingDecision: RoutingDecision;
  toolResults: ToolResult[];
  formattedContext: string;
  timestamp: number;
}

// Agent response types
export interface AgentResponse {
  content: string;
  reasoning?: string;
  metadata?: Record<string, unknown>;
}

// Pipeline result
export interface PipelineResult {
  success: boolean;
  response: AgentResponse;
  routingDecision: RoutingDecision;
  toolResults: ToolResult[];
  totalExecutionTime: number;
  error?: string;
}

// Memory types
export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: number;
  topics: string[];
  relevanceScore?: number;
}

export interface MemorySearchResult {
  entries: MemoryEntry[];
  totalFound: number;
  searchQuery: string;
}

// Session management
export interface ConversationSession {
  id: string;
  startTime: number;
  messages: Message[];
  metadata?: Record<string, unknown>;
}
