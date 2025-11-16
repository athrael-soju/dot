import { Tool, ToolResult, ToolInput, Message } from '../types';

export const clarificationCheckTool: Tool = {
  name: 'clarification_check',
  description:
    'Analyzes ambiguous user messages and suggests clarification questions',

  execute: async (input: ToolInput): Promise<ToolResult> => {
    const startTime = performance.now();

    try {
      const query = input.query || '';
      const lastMessages = (input.parameters?.lastMessages as Message[]) || [];

      const analysis = analyzeAmbiguity(query, lastMessages);

      const executionTime = performance.now() - startTime;

      return {
        toolName: 'clarification_check',
        success: true,
        data: analysis,
        executionTime,
        metadata: {
          ambiguityLevel: analysis.ambiguityLevel,
          hasSufficientContext: analysis.hasSufficientContext,
        },
      };
    } catch (error) {
      const executionTime = performance.now() - startTime;
      return {
        toolName: 'clarification_check',
        success: false,
        data: null,
        error:
          error instanceof Error
            ? error.message
            : 'Clarification check failed',
        executionTime,
      };
    }
  },

  formatOutput: (result: ToolResult): string => {
    if (!result.success) {
      return `Clarification check failed: ${result.error}`;
    }

    const analysis = result.data as ClarificationAnalysis;

    let output = `Ambiguity Level: ${analysis.ambiguityLevel}\n`;
    output += `Context Available: ${analysis.hasSufficientContext ? 'Yes' : 'No'}\n\n`;

    if (analysis.suggestedQuestions.length > 0) {
      output += 'Suggested clarification questions:\n';
      analysis.suggestedQuestions.forEach((q, i) => {
        output += `${i + 1}. ${q}\n`;
      });
    }

    if (analysis.possibleIntents.length > 0) {
      output += '\nPossible user intents:\n';
      analysis.possibleIntents.forEach((intent) => {
        output += `- ${intent}\n`;
      });
    }

    return output;
  },
};

interface ClarificationAnalysis {
  ambiguityLevel: 'low' | 'medium' | 'high';
  hasSufficientContext: boolean;
  suggestedQuestions: string[];
  possibleIntents: string[];
  reasoning: string;
}

function analyzeAmbiguity(
  query: string,
  lastMessages: Message[]
): ClarificationAnalysis {
  const queryLower = query.toLowerCase().trim();
  const wordCount = queryLower.split(/\s+/).length;

  // Determine ambiguity level
  let ambiguityLevel: 'low' | 'medium' | 'high' = 'low';
  const suggestedQuestions: string[] = [];
  const possibleIntents: string[] = [];

  // Check for very short messages
  if (wordCount <= 2) {
    ambiguityLevel = 'high';
    suggestedQuestions.push('Could you provide more details about what you need?');
    possibleIntents.push('Confirmation of previous topic');
    possibleIntents.push('New topic introduction');
  }

  // Check for pronoun-heavy messages without context
  const pronouns = queryLower.match(/\b(it|this|that|they|them)\b/gi) || [];
  if (pronouns.length > 0 && lastMessages.length === 0) {
    ambiguityLevel = 'high';
    suggestedQuestions.push('What are you referring to?');
  }

  // Check for yes/no responses without clear context
  if (/^(yes|no|ok|sure|maybe|probably)$/i.test(queryLower)) {
    if (lastMessages.length === 0) {
      ambiguityLevel = 'high';
      suggestedQuestions.push('Could you provide more context about what you mean?');
    } else {
      ambiguityLevel = 'medium';
      // Try to infer from last message
      const lastAssistant = lastMessages
        .filter((m) => m.role === 'assistant')
        .pop();
      if (lastAssistant) {
        possibleIntents.push(
          `Responding to: "${lastAssistant.content.substring(0, 50)}..."`
        );
      }
    }
  }

  // Check for single word requests
  if (wordCount === 1 && !/^(help|hello|hi|bye|thanks)$/i.test(queryLower)) {
    ambiguityLevel = 'high';
    suggestedQuestions.push(`What would you like to know about "${query}"?`);
    suggestedQuestions.push(`Are you looking for information, help, or something else related to "${query}"?`);
    possibleIntents.push('Topic exploration');
    possibleIntents.push('Definition request');
    possibleIntents.push('Help with specific task');
  }

  // Check if there's sufficient context from history
  const hasSufficientContext =
    lastMessages.length >= 2 || ambiguityLevel === 'low';

  // Add generic clarification questions based on ambiguity level
  if (ambiguityLevel === 'medium' && suggestedQuestions.length === 0) {
    suggestedQuestions.push('Could you elaborate on what you need help with?');
  }

  if (ambiguityLevel === 'high' && suggestedQuestions.length < 2) {
    suggestedQuestions.push('What specific aspect are you interested in?');
  }

  // Generate reasoning
  let reasoning = '';
  if (ambiguityLevel === 'high') {
    reasoning = 'Message lacks sufficient context or specificity for a helpful response.';
  } else if (ambiguityLevel === 'medium') {
    reasoning = 'Message could benefit from additional details but may be answerable.';
  } else {
    reasoning = 'Message is clear enough to provide a helpful response.';
  }

  return {
    ambiguityLevel,
    hasSufficientContext,
    suggestedQuestions: suggestedQuestions.slice(0, 3),
    possibleIntents: possibleIntents.slice(0, 3),
    reasoning,
  };
}
