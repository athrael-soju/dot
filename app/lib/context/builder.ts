import {
  Message,
  ContextFrame,
  RoutingDecision,
  ToolResult,
} from '../types';
import { getToolRegistry } from '../tools/registry';

export class ContextBuilder {
  private maxHistoryLength: number;

  constructor(options: { maxHistoryLength?: number } = {}) {
    this.maxHistoryLength = options.maxHistoryLength || 10;
    console.log('[ContextBuilder] Initialized with max history length:', this.maxHistoryLength);
  }

  build(
    userMessage: Message,
    conversationHistory: Message[],
    routingDecision: RoutingDecision,
    toolResults: ToolResult[]
  ): ContextFrame {
    console.log('[ContextBuilder] ← Received handoff from Tool Executor');
    console.log('[ContextBuilder] Building context frame...');
    console.log('[ContextBuilder] - User message:', userMessage.content.substring(0, 50) + '...');
    console.log('[ContextBuilder] - History messages:', conversationHistory.length);
    console.log('[ContextBuilder] - Tool results:', toolResults.length);

    const trimmedHistory = conversationHistory.slice(-this.maxHistoryLength);

    const formattedContext = this.formatContext(
      userMessage,
      trimmedHistory,
      routingDecision,
      toolResults
    );

    console.log('[ContextBuilder] Context frame built successfully');
    console.log('[ContextBuilder] → Handing off to Response Agent');

    return {
      userMessage,
      conversationHistory: trimmedHistory,
      routingDecision,
      toolResults,
      formattedContext,
      timestamp: Date.now(),
    };
  }

  private formatContext(
    userMessage: Message,
    history: Message[],
    routingDecision: RoutingDecision,
    toolResults: ToolResult[]
  ): string {
    const sections: string[] = [];

    // Section 1: User Intent
    sections.push(this.formatIntentSection(routingDecision));

    // Section 2: Tool Results (if any)
    if (toolResults.length > 0) {
      sections.push(this.formatToolResultsSection(toolResults));
    }

    // Section 3: Conversation Context (if needed)
    if (history.length > 0 && this.needsConversationContext(routingDecision)) {
      sections.push(this.formatHistorySection(history));
    }

    // Section 4: Current Query
    sections.push(this.formatCurrentQuerySection(userMessage));

    return sections.join('\n\n---\n\n');
  }

  private formatIntentSection(routingDecision: RoutingDecision): string {
    let section = '## User Intent\n';
    section += `- Type: ${routingDecision.intent}\n`;
    section += `- Confidence: ${(routingDecision.confidence * 100).toFixed(0)}%\n`;
    section += `- Reasoning: ${routingDecision.reasoning}\n`;

    if (routingDecision.selectedTools.length > 0) {
      section += `- Tools Used: ${routingDecision.selectedTools.join(', ')}`;
    }

    return section;
  }

  private formatToolResultsSection(toolResults: ToolResult[]): string {
    const registry = getToolRegistry();
    let section = '## Retrieved Information\n';

    for (const result of toolResults) {
      const formatted = registry.formatResult(result.toolName, result);
      section += `\n### ${this.formatToolName(result.toolName)}\n`;
      section += formatted;
      section += `\n(Execution time: ${result.executionTime.toFixed(2)}ms)`;
    }

    return section;
  }

  private formatToolName(toolName: string): string {
    // Convert snake_case to Title Case
    return toolName
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }

  private formatHistorySection(history: Message[]): string {
    let section = '## Recent Conversation\n';

    // Only include last few exchanges for context
    const recentMessages = history.slice(-6);

    for (const message of recentMessages) {
      const role =
        message.role.charAt(0).toUpperCase() + message.role.slice(1);
      const timestamp = new Date(message.timestamp).toLocaleTimeString();
      const content = this.truncateContent(message.content, 200);

      section += `\n[${timestamp}] ${role}:\n${content}\n`;
    }

    return section;
  }

  private formatCurrentQuerySection(userMessage: Message): string {
    let section = '## Current User Message\n';
    section += userMessage.content;
    return section;
  }

  private needsConversationContext(routingDecision: RoutingDecision): boolean {
    // Include conversation context for certain intents
    return (
      routingDecision.intent === 'clarification_needed' ||
      routingDecision.intent === 'conversation' ||
      routingDecision.intent === 'memory_access'
    );
  }

  private truncateContent(content: string, maxLength: number): string {
    if (content.length <= maxLength) {
      return content;
    }
    return content.substring(0, maxLength) + '...';
  }

  buildMinimalContext(
    userMessage: Message,
    toolResults: ToolResult[]
  ): string {
    // For simpler scenarios, build a more compact context
    let context = `User says: ${userMessage.content}\n\n`;

    if (toolResults.length > 0) {
      const registry = getToolRegistry();
      context += 'Available information:\n';
      for (const result of toolResults) {
        if (result.success) {
          context += registry.formatResult(result.toolName, result);
          context += '\n\n';
        }
      }
    }

    return context;
  }
}

// Singleton instance
let builderInstance: ContextBuilder | null = null;

export function getContextBuilder(): ContextBuilder {
  if (!builderInstance) {
    builderInstance = new ContextBuilder();
  }
  return builderInstance;
}

export function resetContextBuilder(): void {
  builderInstance = null;
}
