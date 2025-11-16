import { Message, PipelineResult } from './types';
import { RouterAgent } from './agents/router';
import { ResponseAgent, getResponseAgent } from './agents/response';
import { getToolRegistry, initializeTools } from './tools';
import { getContextBuilder } from './context/builder';
import { getMemoryManager } from './memory/manager';

export class Orchestrator {
  private router: RouterAgent;
  private responseAgent: ResponseAgent;
  private initialized: boolean = false;

  constructor() {
    console.log('[Orchestrator] Creating orchestrator...');
    this.router = new RouterAgent();
    this.responseAgent = getResponseAgent();
    console.log('[Orchestrator] Orchestrator created');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log('[Orchestrator] Initializing multi-agent pipeline...');

    // Initialize tools registry
    initializeTools();

    this.initialized = true;
    console.log('[Orchestrator] ✓ Pipeline initialized with tools:', getToolRegistry().list().join(', '));
  }

  async processMessage(userInput: string): Promise<PipelineResult> {
    const startTime = performance.now();

    console.log('\n' + '='.repeat(60));
    console.log('[Orchestrator] 🚀 PIPELINE START');
    console.log('='.repeat(60));
    console.log('[Orchestrator] User input:', userInput);

    // Ensure initialized
    if (!this.initialized) {
      await this.initialize();
    }

    const memoryManager = getMemoryManager();
    const toolRegistry = getToolRegistry();
    const contextBuilder = getContextBuilder();

    // Create user message
    const userMessage: Message = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      role: 'user',
      content: userInput,
      timestamp: Date.now(),
    };

    // Add to session history
    memoryManager.addToSession(userMessage);
    console.log('[Orchestrator] Message added to session history');

    try {
      // Step 1: Route the message
      console.log('\n' + '-'.repeat(60));
      console.log('[Orchestrator] STEP 1/4: ROUTING');
      console.log('-'.repeat(60));
      console.log('[Orchestrator] → Handing off to Router Agent');
      const conversationHistory = memoryManager.getSessionHistory().slice(0, -1); // Exclude current message
      const routingDecision = this.router.route(userMessage, conversationHistory);
      console.log('[Orchestrator] ← Router Agent completed');

      // Step 2: Execute tools
      console.log('\n' + '-'.repeat(60));
      console.log('[Orchestrator] STEP 2/4: TOOL EXECUTION');
      console.log('-'.repeat(60));
      console.log('[Orchestrator] → Handing off to Tool Registry');
      const toolResults = await toolRegistry.executeMultiple(routingDecision.toolInputs);
      console.log('[Orchestrator] ← Tool Registry completed');

      // Step 3: Build context
      console.log('\n' + '-'.repeat(60));
      console.log('[Orchestrator] STEP 3/4: CONTEXT BUILDING');
      console.log('-'.repeat(60));
      console.log('[Orchestrator] → Handing off to Context Builder');
      const contextFrame = contextBuilder.build(
        userMessage,
        conversationHistory,
        routingDecision,
        toolResults
      );
      console.log('[Orchestrator] ← Context Builder completed');

      // Step 4: Generate response
      console.log('\n' + '-'.repeat(60));
      console.log('[Orchestrator] STEP 4/4: RESPONSE GENERATION');
      console.log('-'.repeat(60));
      console.log('[Orchestrator] → Handing off to Response Agent');
      const agentResponse = await this.responseAgent.generateResponse(contextFrame);
      console.log('[Orchestrator] ← Response Agent completed');

      // Add assistant response to session history
      const assistantMessage: Message = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        role: 'assistant',
        content: agentResponse.content,
        timestamp: Date.now(),
        metadata: {
          reasoning: agentResponse.reasoning,
          toolsUsed: routingDecision.selectedTools,
        },
      };
      memoryManager.addToSession(assistantMessage);

      // Store important interactions in long-term memory
      if (this.shouldStoreInLongTermMemory(routingDecision)) {
        const topics = this.extractTopics(userInput, agentResponse.content);
        memoryManager.addToLongTermMemory(
          `User asked about: ${userInput}. Assistant discussed: ${agentResponse.content.substring(0, 100)}`,
          topics
        );
        console.log('[Orchestrator] Stored interaction in long-term memory with topics:', topics.join(', '));
      }

      const totalExecutionTime = performance.now() - startTime;

      console.log('\n' + '='.repeat(60));
      console.log('[Orchestrator] ✅ PIPELINE COMPLETE');
      console.log('='.repeat(60));
      console.log('[Orchestrator] Total execution time:', totalExecutionTime.toFixed(2) + 'ms');
      console.log('[Orchestrator] Intent:', routingDecision.intent);
      console.log('[Orchestrator] Tools used:', routingDecision.selectedTools.join(', ') || 'none');
      console.log('[Orchestrator] Response preview:', agentResponse.content.substring(0, 100) + '...');
      console.log('='.repeat(60) + '\n');

      return {
        success: true,
        response: agentResponse,
        routingDecision,
        toolResults,
        totalExecutionTime,
      };
    } catch (error) {
      const totalExecutionTime = performance.now() - startTime;
      console.error('\n' + '='.repeat(60));
      console.error('[Orchestrator] ❌ PIPELINE FAILED');
      console.error('='.repeat(60));
      console.error('[Orchestrator] Error:', error);
      console.error('[Orchestrator] Execution time before failure:', totalExecutionTime.toFixed(2) + 'ms');
      console.error('='.repeat(60) + '\n');

      return {
        success: false,
        response: {
          content:
            'I apologize, but I encountered an issue processing your request. Could you try rephrasing that?',
          reasoning: 'Pipeline execution failed',
        },
        routingDecision: {
          intent: 'conversation',
          confidence: 0,
          selectedTools: [],
          toolInputs: {},
          reasoning: 'Error occurred during processing',
        },
        toolResults: [],
        totalExecutionTime,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private shouldStoreInLongTermMemory(routingDecision: { intent: string }): boolean {
    // Store meaningful interactions, not simple greetings or clarifications
    return (
      routingDecision.intent === 'knowledge_retrieval' ||
      routingDecision.intent === 'memory_access' ||
      routingDecision.intent === 'multi_tool'
    );
  }

  private extractTopics(userInput: string, response: string): string[] {
    const combined = `${userInput} ${response}`.toLowerCase();
    const topics: string[] = [];

    // Extract topics based on keyword patterns
    const topicPatterns: Record<string, RegExp> = {
      programming: /code|programming|function|api|typescript|javascript/i,
      design: /design|ui|ux|interface|layout/i,
      data: /database|data|query|storage/i,
      performance: /performance|speed|optimize|cache/i,
      security: /security|auth|encrypt|protect/i,
      ai: /ai|machine learning|model|neural/i,
      architecture: /architecture|pattern|system|structure/i,
    };

    for (const [topic, pattern] of Object.entries(topicPatterns)) {
      if (pattern.test(combined)) {
        topics.push(topic);
      }
    }

    return topics.slice(0, 3); // Limit to 3 topics
  }

  getMemorySummary(): string {
    return getMemoryManager().getSummary();
  }

  clearSession(): void {
    getMemoryManager().clearSession();
  }
}

// Singleton instance
let orchestratorInstance: Orchestrator | null = null;

export async function getOrchestrator(): Promise<Orchestrator> {
  if (!orchestratorInstance) {
    orchestratorInstance = new Orchestrator();
    await orchestratorInstance.initialize();
  }
  return orchestratorInstance;
}

export function resetOrchestrator(): void {
  orchestratorInstance = null;
}
