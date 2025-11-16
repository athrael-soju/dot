import OpenAI from 'openai';
import {
  ResponseContext,
  ToolExecutionResult,
  ConversationMessage,
  IntentType,
  ResponseStyle
} from './types';

const CONTEXT_BUILDER_SYSTEM_PROMPT = `You are a Context Builder Agent. Your job is to synthesize tool execution results and conversation history into a well-structured context for the Response Agent.

Your responsibilities:
1. Summarize and format tool results in a clear, usable way
2. Extract key information from tool outputs
3. Identify any errors or missing information
4. Suggest an appropriate response style based on the context
5. Create a coherent narrative from multiple tool results

Respond with JSON in this format:
{
  "formattedContext": "A clear summary of all relevant information the Response Agent needs",
  "keyFacts": ["fact1", "fact2"],
  "hasErrors": true/false,
  "errorSummary": "Description of any errors if present",
  "suggestedResponseStyle": {
    "tone": "friendly|professional|empathetic|informative",
    "verbosity": "concise|detailed|balanced",
    "includeFollowUp": true/false
  }
}`;

export class ContextBuilderAgent {
  private client: OpenAI;
  private model: string;

  constructor(apiKey: string, model: string = 'gpt-4o-mini') {
    this.client = new OpenAI({ apiKey });
    this.model = model;
  }

  async buildContext(
    originalMessage: string,
    intent: IntentType,
    toolResults: ToolExecutionResult[],
    conversationHistory: ConversationMessage[]
  ): Promise<ResponseContext> {
    // If no tools were executed, create a simple context
    if (toolResults.length === 0) {
      return this.createSimpleContext(
        originalMessage,
        intent,
        conversationHistory
      );
    }

    // Build rich context using LLM
    const formattedToolResults = toolResults.map(result => ({
      tool: result.toolName,
      success: result.output.success,
      data: result.output.data,
      error: result.output.error,
      executionTime: result.executionTime
    }));

    const historyContext = conversationHistory
      .slice(-5)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `
Original User Message: "${originalMessage}"

Intent: ${intent}

Tool Execution Results:
${JSON.stringify(formattedToolResults, null, 2)}

Recent Conversation History:
${historyContext || 'No previous history'}

Analyze these results and create a formatted context for the Response Agent.`;

    try {
      const response = await this.client.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: CONTEXT_BUILDER_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.4,
        max_tokens: 1500,
        response_format: { type: 'json_object' }
      });

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error('Empty response from Context Builder Agent');
      }

      const parsed = JSON.parse(content);

      return {
        originalMessage,
        intent,
        toolResults,
        conversationHistory,
        formattedContext: parsed.formattedContext || this.fallbackFormatting(toolResults),
        suggestedResponseStyle: this.validateResponseStyle(parsed.suggestedResponseStyle)
      };
    } catch (error) {
      console.error('Context Builder Agent error:', error);
      // Return fallback context
      return {
        originalMessage,
        intent,
        toolResults,
        conversationHistory,
        formattedContext: this.fallbackFormatting(toolResults),
        suggestedResponseStyle: {
          tone: 'friendly',
          verbosity: 'balanced',
          includeFollowUp: false
        }
      };
    }
  }

  private createSimpleContext(
    originalMessage: string,
    intent: IntentType,
    conversationHistory: ConversationMessage[]
  ): ResponseContext {
    const styleMap: Record<IntentType, ResponseStyle> = {
      knowledge_retrieval: {
        tone: 'informative',
        verbosity: 'detailed',
        includeFollowUp: true
      },
      memory_access: {
        tone: 'friendly',
        verbosity: 'balanced',
        includeFollowUp: false
      },
      clarification_needed: {
        tone: 'professional',
        verbosity: 'concise',
        includeFollowUp: true
      },
      general_conversation: {
        tone: 'friendly',
        verbosity: 'concise',
        includeFollowUp: false
      },
      multi_step_task: {
        tone: 'professional',
        verbosity: 'detailed',
        includeFollowUp: true
      },
      end_session: {
        tone: 'friendly',
        verbosity: 'concise',
        includeFollowUp: false
      }
    };

    return {
      originalMessage,
      intent,
      toolResults: [],
      conversationHistory,
      formattedContext: `User message: "${originalMessage}"\nIntent: ${intent}\nNo additional context from tools.`,
      suggestedResponseStyle: styleMap[intent]
    };
  }

  private fallbackFormatting(toolResults: ToolExecutionResult[]): string {
    if (toolResults.length === 0) {
      return 'No tool results available.';
    }

    const parts: string[] = [];

    for (const result of toolResults) {
      if (result.output.success && result.output.data) {
        parts.push(`[${result.toolName}]: ${JSON.stringify(result.output.data)}`);
      } else if (!result.output.success) {
        parts.push(`[${result.toolName}]: Error - ${result.output.error}`);
      }
    }

    return parts.join('\n\n');
  }

  private validateResponseStyle(style: unknown): ResponseStyle {
    const defaultStyle: ResponseStyle = {
      tone: 'friendly',
      verbosity: 'balanced',
      includeFollowUp: false
    };

    if (!style || typeof style !== 'object') {
      return defaultStyle;
    }

    const s = style as Record<string, unknown>;

    const validTones = ['friendly', 'professional', 'empathetic', 'informative'];
    const validVerbosity = ['concise', 'detailed', 'balanced'];

    return {
      tone: validTones.includes(s.tone as string)
        ? (s.tone as ResponseStyle['tone'])
        : defaultStyle.tone,
      verbosity: validVerbosity.includes(s.verbosity as string)
        ? (s.verbosity as ResponseStyle['verbosity'])
        : defaultStyle.verbosity,
      includeFollowUp: typeof s.includeFollowUp === 'boolean'
        ? s.includeFollowUp
        : defaultStyle.includeFollowUp
    };
  }
}
