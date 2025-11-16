import OpenAI from 'openai';
import {
  ToolDefinition,
  ToolExecutionResult,
  ConversationMessage
} from './types';

const EXECUTOR_SYSTEM_PROMPT = `You are a Tool Executor Agent. Your job is to determine the correct parameters for each tool based on the user's message and conversation context.

For each tool you need to execute, analyze the user's message and determine what parameters to pass.

Respond with a JSON object where keys are tool names and values are the parameter objects to pass to each tool.

Example:
{
  "search_knowledge": {
    "query": "artificial intelligence applications"
  },
  "get_memory": {
    "key": "user_preferences"
  }
}

If you cannot determine parameters for a tool, set its value to null.`;

export class ToolExecutorAgent {
  private client: OpenAI;
  private model: string;
  private toolRegistry: Map<string, ToolDefinition>;
  private maxExecutionTime: number;
  private enableParallel: boolean;

  constructor(
    maxExecutionTime: number = 30000,
    enableParallel: boolean = true
  ) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    this.client = new OpenAI({ apiKey });
    this.model = process.env.OPENAI_MODEL || 'gpt-realtime-mini';
    this.toolRegistry = new Map();
    this.maxExecutionTime = maxExecutionTime;
    this.enableParallel = enableParallel;
  }

  registerTool(tool: ToolDefinition): void {
    this.toolRegistry.set(tool.name, tool);
  }

  registerTools(tools: ToolDefinition[]): void {
    tools.forEach(tool => this.registerTool(tool));
  }

  getAvailableTools(): ToolDefinition[] {
    return Array.from(this.toolRegistry.values());
  }

  async executeTools(
    toolNames: string[],
    userMessage: string,
    conversationHistory: ConversationMessage[]
  ): Promise<ToolExecutionResult[]> {
    if (toolNames.length === 0) {
      return [];
    }

    // Filter to only registered tools
    const validToolNames = toolNames.filter(name => this.toolRegistry.has(name));
    if (validToolNames.length === 0) {
      return [];
    }

    // Get parameter values from the LLM
    const toolParams = await this.determineToolParameters(
      validToolNames,
      userMessage,
      conversationHistory
    );

    // Execute tools
    if (this.enableParallel) {
      return this.executeInParallel(validToolNames, toolParams);
    } else {
      return this.executeSequentially(validToolNames, toolParams);
    }
  }

  private async determineToolParameters(
    toolNames: string[],
    userMessage: string,
    conversationHistory: ConversationMessage[]
  ): Promise<Record<string, Record<string, unknown> | null>> {
    const toolDescriptions = toolNames.map(name => {
      const tool = this.toolRegistry.get(name)!;
      return `Tool: ${tool.name}
Description: ${tool.description}
Parameters: ${JSON.stringify(tool.parameters, null, 2)}`;
    }).join('\n\n');

    const historyContext = conversationHistory
      .slice(-3)
      .map(msg => `${msg.role}: ${msg.content}`)
      .join('\n');

    const userPrompt = `
Tools to execute:
${toolDescriptions}

Conversation context:
${historyContext || 'No previous history'}

User message: "${userMessage}"

Determine the parameters for each tool.`;

    try {
      const response = await this.client.responses.create({
        model: this.model,
        instructions: EXECUTOR_SYSTEM_PROMPT,
        input: userPrompt,
        temperature: 0.2,
        max_output_tokens: 1000,
        text: {
          format: {
            type: 'json_object'
          }
        }
      });

      const content = response.output_text;
      if (!content) {
        throw new Error('Empty response from Tool Executor Agent');
      }

      return JSON.parse(content) as Record<string, Record<string, unknown> | null>;
    } catch (error) {
      console.error('Error determining tool parameters:', error);
      // Return empty params for all tools
      const emptyParams: Record<string, Record<string, unknown> | null> = {};
      toolNames.forEach(name => {
        emptyParams[name] = {};
      });
      return emptyParams;
    }
  }

  private async executeInParallel(
    toolNames: string[],
    toolParams: Record<string, Record<string, unknown> | null>
  ): Promise<ToolExecutionResult[]> {
    const executionPromises = toolNames.map(async toolName => {
      const tool = this.toolRegistry.get(toolName)!;
      const params = toolParams[toolName] || {};

      return this.executeSingleTool(tool, params);
    });

    return Promise.all(executionPromises);
  }

  private async executeSequentially(
    toolNames: string[],
    toolParams: Record<string, Record<string, unknown> | null>
  ): Promise<ToolExecutionResult[]> {
    const results: ToolExecutionResult[] = [];

    for (const toolName of toolNames) {
      const tool = this.toolRegistry.get(toolName)!;
      const params = toolParams[toolName] || {};
      const result = await this.executeSingleTool(tool, params);
      results.push(result);
    }

    return results;
  }

  private async executeSingleTool(
    tool: ToolDefinition,
    params: Record<string, unknown>
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();

    try {
      // Add timeout to tool execution
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Tool execution timeout after ${this.maxExecutionTime}ms`));
        }, this.maxExecutionTime);
      });

      const executionPromise = tool.execute(params);

      const output = await Promise.race([executionPromise, timeoutPromise]);
      const executionTime = Date.now() - startTime;

      return {
        toolName: tool.name,
        input: params,
        output,
        executionTime
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      return {
        toolName: tool.name,
        input: params,
        output: {
          success: false,
          error: errorMessage
        },
        executionTime
      };
    }
  }
}
