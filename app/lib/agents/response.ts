import { ContextFrame, AgentResponse } from '../types';

export class ResponseAgent {
  private systemPrompt: string;

  constructor() {
    console.log('[ResponseAgent] Initialized');
    this.systemPrompt = `You are a helpful AI assistant. Your task is to generate natural, conversational responses based on the provided context.

Guidelines:
- Be concise but thorough
- Use information from tools when available
- Maintain a warm, helpful tone
- Ask clarifying questions when context suggests ambiguity
- Reference past conversations naturally when relevant
- Keep responses suitable for voice output (avoid overly long lists or complex formatting)`;
  }

  async generateResponse(contextFrame: ContextFrame): Promise<AgentResponse> {
    console.log('[ResponseAgent] ← Received handoff from Context Builder');
    console.log('[ResponseAgent] Generating response for intent:', contextFrame.routingDecision.intent);

    const { routingDecision, toolResults, userMessage } = contextFrame;

    let response: AgentResponse;

    // Handle different intents
    switch (routingDecision.intent) {
      case 'clarification_needed':
        console.log('[ResponseAgent] Processing: Clarification request');
        response = this.handleClarification(contextFrame);
        break;

      case 'memory_access':
        console.log('[ResponseAgent] Processing: Memory-based response');
        response = this.handleMemoryResponse(contextFrame);
        break;

      case 'knowledge_retrieval':
        console.log('[ResponseAgent] Processing: Knowledge-based response');
        response = this.handleKnowledgeResponse(contextFrame);
        break;

      case 'multi_tool':
        console.log('[ResponseAgent] Processing: Multi-tool synthesized response');
        response = this.handleMultiToolResponse(contextFrame);
        break;

      case 'conversation':
      default:
        console.log('[ResponseAgent] Processing: Direct conversation response');
        response = this.handleConversation(contextFrame);
        break;
    }

    console.log('[ResponseAgent] ✓ Response generated');
    console.log('[ResponseAgent] Reasoning:', response.reasoning);
    console.log('[ResponseAgent] → Returning to Orchestrator');

    return response;
  }

  private handleClarification(contextFrame: ContextFrame): AgentResponse {
    const clarificationResult = contextFrame.toolResults.find(
      (r) => r.toolName === 'clarification_check'
    );

    if (
      !clarificationResult?.success ||
      !clarificationResult.data
    ) {
      return {
        content:
          'I want to make sure I understand you correctly. Could you provide more details about what you need help with?',
        reasoning: 'Clarification check failed, using generic clarification request',
      };
    }

    const analysis = clarificationResult.data as {
      suggestedQuestions: string[];
      possibleIntents: string[];
      ambiguityLevel: string;
    };

    // Use the first suggested question
    const question =
      analysis.suggestedQuestions[0] ||
      'Could you tell me more about what you need?';

    return {
      content: question,
      reasoning: `Ambiguity level: ${analysis.ambiguityLevel}. Asking for clarification.`,
      metadata: {
        possibleIntents: analysis.possibleIntents,
      },
    };
  }

  private handleMemoryResponse(contextFrame: ContextFrame): AgentResponse {
    const memoryResult = contextFrame.toolResults.find(
      (r) => r.toolName === 'memory_recall'
    );

    if (!memoryResult?.success) {
      return {
        content:
          "I couldn't find any relevant information from our past conversations. Could you remind me what we discussed?",
        reasoning: 'Memory recall failed or returned no results',
      };
    }

    const searchResult = memoryResult.data as {
      entries: Array<{ content: string }>;
      totalFound: number;
    };

    if (searchResult.totalFound === 0) {
      return {
        content:
          "I don't have any memories related to that topic. Perhaps we haven't discussed it yet?",
        reasoning: 'No relevant memories found',
      };
    }

    // Synthesize a response from memories
    const memories = searchResult.entries
      .map((e) => e.content)
      .slice(0, 3);

    const content = this.synthesizeMemoryResponse(
      contextFrame.userMessage.content,
      memories
    );

    return {
      content,
      reasoning: `Found ${searchResult.totalFound} relevant memories`,
      metadata: {
        memoriesUsed: memories.length,
      },
    };
  }

  private handleKnowledgeResponse(contextFrame: ContextFrame): AgentResponse {
    const knowledgeResult = contextFrame.toolResults.find(
      (r) => r.toolName === 'knowledge_search'
    );

    if (!knowledgeResult?.success) {
      return {
        content:
          "I couldn't find specific information on that topic. Could you be more specific about what you'd like to know?",
        reasoning: 'Knowledge search failed',
      };
    }

    const data = knowledgeResult.data as {
      results: string[];
      totalResults: number;
    };

    if (data.totalResults === 0) {
      return {
        content:
          "I don't have specific documentation on that topic, but I'd be happy to help based on general knowledge. What aspect interests you most?",
        reasoning: 'No knowledge base results found',
      };
    }

    // Format knowledge into a helpful response
    const content = this.synthesizeKnowledgeResponse(
      contextFrame.userMessage.content,
      data.results
    );

    return {
      content,
      reasoning: `Found ${data.totalResults} knowledge items`,
      metadata: {
        knowledgeItemsUsed: data.results.length,
      },
    };
  }

  private handleMultiToolResponse(contextFrame: ContextFrame): AgentResponse {
    const responses: string[] = [];
    let reasoning = 'Combined information from multiple sources: ';

    // Process memory results
    const memoryResult = contextFrame.toolResults.find(
      (r) => r.toolName === 'memory_recall'
    );
    if (memoryResult?.success) {
      const memData = memoryResult.data as { entries: Array<{ content: string }>; totalFound: number };
      if (memData.totalFound > 0) {
        responses.push(
          `Based on our previous discussions: ${memData.entries[0].content}`
        );
        reasoning += 'memory_recall, ';
      }
    }

    // Process knowledge results
    const knowledgeResult = contextFrame.toolResults.find(
      (r) => r.toolName === 'knowledge_search'
    );
    if (knowledgeResult?.success) {
      const knowData = knowledgeResult.data as { results: string[]; totalResults: number };
      if (knowData.totalResults > 0) {
        responses.push(`Additionally, ${knowData.results[0].toLowerCase()}`);
        reasoning += 'knowledge_search, ';
      }
    }

    if (responses.length === 0) {
      return {
        content:
          "I searched both our conversation history and my knowledge base, but couldn't find relevant information. Could you provide more context?",
        reasoning: 'Multi-tool search returned no results',
      };
    }

    return {
      content: responses.join(' '),
      reasoning: reasoning.slice(0, -2),
    };
  }

  private handleConversation(contextFrame: ContextFrame): AgentResponse {
    // For general conversation, provide a direct response
    // In a full implementation, this would use an LLM
    const userContent = contextFrame.userMessage.content.toLowerCase();

    // Simple pattern matching for common conversational patterns
    if (/^(hello|hi|hey|greetings)/i.test(userContent)) {
      return {
        content: 'Hello! How can I help you today?',
        reasoning: 'Greeting detected, responding with greeting',
      };
    }

    if (/^(thanks|thank you|appreciate)/i.test(userContent)) {
      return {
        content: "You're welcome! Is there anything else I can help with?",
        reasoning: 'Thanks detected, acknowledging gratitude',
      };
    }

    if (/^(bye|goodbye|see you|talk later)/i.test(userContent)) {
      return {
        content: 'Goodbye! Feel free to reach out whenever you need assistance.',
        reasoning: 'Farewell detected, saying goodbye',
      };
    }

    // Default conversational response
    return {
      content: `I understand you're saying: "${contextFrame.userMessage.content}". How would you like me to help with this?`,
      reasoning: 'General conversation, seeking clarification on how to assist',
    };
  }

  private synthesizeMemoryResponse(query: string, memories: string[]): string {
    if (memories.length === 1) {
      return `Yes, I remember that. ${memories[0]}.`;
    }

    let response = "Here's what I recall from our conversations: ";
    response += memories[0];

    if (memories.length > 1) {
      response += ` I also remember that ${memories[1].toLowerCase()}`;
    }

    return response;
  }

  private synthesizeKnowledgeResponse(query: string, results: string[]): string {
    if (results.length === 1) {
      return `Here's what I found: ${results[0]}`;
    }

    let response = 'Based on best practices, ';
    response += results[0].toLowerCase();

    if (results.length > 1) {
      response += ` Additionally, ${results[1].toLowerCase()}`;
    }

    if (results.length > 2) {
      response += ' Would you like me to share more recommendations?';
    }

    return response;
  }
}

// Singleton instance
let responseAgentInstance: ResponseAgent | null = null;

export function getResponseAgent(): ResponseAgent {
  if (!responseAgentInstance) {
    responseAgentInstance = new ResponseAgent();
  }
  return responseAgentInstance;
}

export function resetResponseAgent(): void {
  responseAgentInstance = null;
}
