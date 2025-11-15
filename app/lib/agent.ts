import { RealtimeAgent } from '@openai/agents/realtime';
import type { RealtimeSession } from '@openai/agents/realtime';

// Function to create the agent with a disconnect callback
export function createConversationalAgent(
  onDisconnect: () => void,
  getSession: () => RealtimeSession | null
) {
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

          // Wait for the agent to finish speaking before disconnecting
          const session = getSession();
          if (session) {
            // Track both agent response and audio completion
            let agentDone = false;
            let audioDone = false;
            let disconnected = false;

            const checkAndDisconnect = () => {
              // Disconnect only when both agent finishes AND audio stops
              if ((agentDone && audioDone) && !disconnected) {
                disconnected = true;
                // Small delay to ensure audio fully completes
                setTimeout(() => {
                  session.off('agent_end', onAgentEnd);
                  session.off('audio_stopped', onAudioStopped);
                  onDisconnect();
                }, 1000);
              }
            };

            const onAgentEnd = () => {
              console.log('Agent response completed');
              agentDone = true;
              checkAndDisconnect();
            };

            const onAudioStopped = () => {
              console.log('Audio playback stopped');
              audioDone = true;
              checkAndDisconnect();
            };

            // Listen for both agent completion and audio stopping
            session.on('agent_end', onAgentEnd);
            session.on('audio_stopped', onAudioStopped);

            // Fallback timeout in case events don't fire (max 10 seconds)
            setTimeout(() => {
              if (!disconnected) {
                console.log('Disconnect timeout reached, forcing disconnect');
                session.off('agent_end', onAgentEnd);
                session.off('audio_stopped', onAudioStopped);
                disconnected = true;
                onDisconnect();
              }
            }, 10000);
          } else {
            // Fallback if no session available
            setTimeout(() => {
              onDisconnect();
            }, 500);
          }

          return JSON.stringify({ success: true, message: 'Session ended successfully' });
        },
        needsApproval: async () => false,
      },
    ],
    handoffs: [],
  });
}
