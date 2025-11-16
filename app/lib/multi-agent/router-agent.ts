import OpenAI from 'openai';
import {
  RoutingDecision,
  IntentType,
  ConversationMessage,
  ToolDefinition
} from './types';

const ROUTER_SYSTEM_PROMPT = `You are a Router Agent responsible for analyzing user messages and determining the appropriate intent and tools to use.

Your responsibilities:
1. Classify the user's intent into one of these categories:
   - knowledge_retrieval: User wants information from knowledge base
   - memory_access: User references past conversations or stored information
   - clarification_needed: User's request is ambiguous and needs clarification
   - general_conversation: General chat, greetings, or simple questions
   - multi_step_task: Complex request requiring multiple tools
   - end_session: User wants to end the conversation

2. Select which tools should be executed (if any)
3. Determine if clarification is needed before proceeding
4. Provide reasoning for your decisions

Available tools will be provided in the user message.

Respond ONLY with valid JSON in this exact format:
{
  "intent": "intent_type",
  "confidence": 0.0 to 1.0,
  "selectedTools": ["tool1", "tool2"],
  "reasoning": "Brief explanation",
  "needsClarification": true/false,
  "clarificationQuestion": "Question to ask if clarification needed"
}`;

export class RouterAgent {
  private client: OpenAI;
  private model: string;

  constructor(model: string = 'gpt-4o-mini') {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async route(
    userMessage: string,
    conversationHistory: ConversationMessage[],
    availableTools: ToolDefinition[]
  ): Promise<RoutingDecision> {
    const toolDescriptions = availableTools.map(tool =>
      `- ${tool.name}: ${tool.description}`
    ).join('\n');

    const historyContext = conversationHistory
      .slice(-5) // Last 5 messages for context
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `
Available Tools:
${toolDescriptions}

Recent Conversation History:
${historyContext || 'No previous history'}

Current User Message:
"${userMessage}"

Analyze this message and provide your routing decision.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: ROUTER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for more consistent classification
        max_tokens: 500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from Router Agent');
      }

      const decision = JSON.parse(content) as RoutingDecision;

      // Validate the response
      if (!this.isValidIntent(decision.intent)) {
        decision.intent = 'general_conversation';
      }

      if (!Array.isArray(decision.selectedTools)) {
        decision.selectedTools = [];
      }

      // Filter to only available tools
      const availableToolNames = availableTools.map(t => t.name);
      decision.selectedTools = decision.selectedTools.filter(
        tool => availableToolNames.includes(tool)
      );

      return decision;
    } catch (error) {
      console.error('Router Agent error:', error);
      // Return safe default
      return {
        intent: 'general_conversation',
        confidence: 0.5,
        selectedTools: [],
        reasoning: 'Fallback due to routing error',
        needsClarification: false
      };
    }
  }

  private isValidIntent(intent: string): intent is IntentType {
    const validIntents: IntentType[] = [
      'knowledge_retrieval',
      'memory_access',
      'clarification_needed',
      'general_conversation',
      'multi_step_task',
      'end_session'
    ];
    return validIntents.includes(intent as IntentType);
  }
}
