// Multi-Agent System Type Definitions

// Tool definition for the system
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
}

// Result from tool execution
export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
  metadata?: Record<string, unknown>;
}

// Intent classification from Router Agent
export interface RoutingDecision {
  intent: IntentType;
  confidence: number;
  selectedTools: string[];
  reasoning: string;
  needsClarification: boolean;
  clarificationQuestion?: string;
}

// Types of intents the system can handle
export type IntentType =
  | 'knowledge_retrieval'
  | 'memory_access'
  | 'clarification_needed'
  | 'general_conversation'
  | 'multi_step_task'
  | 'end_session';

// Message in the conversation
export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, unknown>;
}

// Context built for the Response Agent
export interface ResponseContext {
  originalMessage: string;
  intent: IntentType;
  toolResults: ToolExecutionResult[];
  conversationHistory: ConversationMessage[];
  formattedContext: string;
  suggestedResponseStyle?: ResponseStyle;
}

// Result of executing a tool
export interface ToolExecutionResult {
  toolName: string;
  input: Record<string, unknown>;
  output: ToolResult;
  executionTime: number;
}

// Style hints for the Response Agent
export interface ResponseStyle {
  tone: 'friendly' | 'professional' | 'empathetic' | 'informative';
  verbosity: 'concise' | 'detailed' | 'balanced';
  includeFollowUp: boolean;
}

// Memory entry for conversation context
export interface MemoryEntry {
  key: string;
  value: unknown;
  timestamp: number;
  ttl?: number; // Time to live in milliseconds
}

// Knowledge base item
export interface KnowledgeItem {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  relevanceScore?: number;
}

// Agent pipeline state
export interface PipelineState {
  conversationHistory: ConversationMessage[];
  memory: Map<string, MemoryEntry>;
  sessionId: string;
  startTime: number;
}

// Configuration for the multi-agent system
export interface MultiAgentConfig {
  maxToolExecutionTime: number; // ms
  maxConversationHistory: number;
  enableParallelToolExecution: boolean;
  debugMode: boolean;
}
