import { orchestrator } from './agents';
import { memoryManager } from './memory/manager';

// Initialize orchestrator on module load
orchestrator.initialize();

// Single orchestration tool that routes ALL messages through the multi-agent pipeline
export function getRealtimeTools() {
  return [
    {
      type: 'function' as const,
      name: 'process_user_message',
      description:
        'ALWAYS call this tool first for EVERY user message. Routes the message through the multi-agent pipeline: Router Agent analyzes intent → Tool Executor runs appropriate tools (memory search, knowledge base, etc.) → Context Builder compiles results → Returns enriched context for response generation.',
      parameters: {
        type: 'object' as const,
        properties: {
          message: {
            type: 'string',
            description: 'The user message to process through the pipeline',
          },
        },
        required: ['message'],
        additionalProperties: false,
      },
      strict: false,
      invoke: async (_context: unknown, input: string) => {
        const args = JSON.parse(input);
        console.log('[Pipeline] Processing message:', args.message);

        const result = await orchestrator.processMessage(args.message);

        console.log('[Pipeline] Routing decision:', {
          intent: result.routing.intent,
          tools: result.routing.tools,
          confidence: result.routing.confidence,
        });

        if (result.toolResults.length > 0) {
          console.log(
            '[Pipeline] Tool results:',
            result.toolResults.map((r) => ({
              tool: r.tool,
              success: r.success,
              time: r.executionTime,
            }))
          );
        }

        // Return comprehensive context for the Response Agent
        return JSON.stringify({
          routing: {
            intent: result.routing.intent,
            confidence: result.routing.confidence,
            reasoning: result.routing.reasoning,
            requiresClarification: result.routing.requiresClarification,
          },
          toolResults: result.toolResults.map((tr) => ({
            tool: tr.tool,
            success: tr.success,
            data: tr.rawData,
          })),
          suggestedResponse: result.response.content,
          processingTime: result.processingTime,
        });
      },
      needsApproval: async () => false,
    },
  ];
}

// Store session messages for memory
export function addMessageToMemory(
  role: 'user' | 'assistant',
  content: string
) {
  memoryManager.addToSession({
    role,
    content,
    timestamp: Date.now(),
  });
}

// Get current session history
export function getSessionHistory() {
  return memoryManager.getSessionHistory();
}

// Clear current session
export function clearSessionMemory() {
  memoryManager.clearSession();
}
