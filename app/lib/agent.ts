import { RealtimeAgent } from '@openai/agents/realtime';

// Function to create the agent with a disconnect callback
export function createConversationalAgent(onDisconnect: () => void) {
  return new RealtimeAgent({
    name: 'assistant',
    handoffDescription: 'A helpful AI assistant.',
    instructions:
      'You are a friendly and helpful AI assistant. Engage in natural conversation with the user. Be concise but warm in your responses. When the user indicates they want to end the conversation or says goodbye, use the end_session tool to properly disconnect.',
    tools: [
      {
        type: 'function',
        name: 'end_session',
        description: 'Ends the current conversation session and disconnects the AI assistant. Use this when the user indicates they want to end the conversation or says goodbye.',
        parameters: {
          type: 'object',
          properties: {
            farewell_message: {
              type: 'string',
              description: 'A very brief farewell message to say to the user before disconnecting',
            },
          },
          required: ['farewell_message'],
          additionalProperties: false,
        },
        strict: false,
        invoke: async (_context, input: string) => {
          const args = JSON.parse(input);
          console.log('Ending session with farewell:', args.farewell_message);

          // Delay disconnect to allow AI to respond
          setTimeout(() => {
            onDisconnect();
          }, 500);

          return JSON.stringify({ success: true, message: 'Session ended successfully' });
        },
        needsApproval: async () => false,
      },
    ],
    handoffs: [],
  });
}
