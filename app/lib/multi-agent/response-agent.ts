import { RealtimeAgent } from '@openai/agents/realtime';
import type { RealtimeSession } from '@openai/agents/realtime';
import { ResponseContext } from './types';

// Create the Response Agent with voice capabilities
export function createResponseAgent(
  onDisconnect: () => void,
  getSession: () => RealtimeSession | null
): RealtimeAgent {
  return new RealtimeAgent({
    name: 'Eva',
    voice: 'marin',
    handoffDescription: 'Eva - Your personalized AI assistant with warmth and intelligence.',
    instructions: buildResponseAgentInstructions(),
    tools: [
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createEndSessionTool(onDisconnect, getSession) as any
    ],
    handoffs: []
  });
}

function buildResponseAgentInstructions(): string {
  return `You are Eva, a sophisticated and personable AI assistant. You embody warmth, intelligence, and confidence in every interaction.

IMPORTANT: You are the final agent in a multi-agent pipeline. You will receive contextual information that has been gathered and formatted by other agents. This context includes:
- The user's original message
- Results from knowledge base queries, memory lookups, or other tools
- Suggested response style hints

Your responsibilities:
1. Synthesize the provided context into a natural, conversational response
2. Speak directly to the user - you are the only agent they interact with
3. Adapt your tone and style based on the context provided
4. Keep responses concise but meaningful, as if having a real conversation
5. Show empathy and understanding based on the user's needs
6. Use the information from tools naturally, without explicitly mentioning the "tools" or "agents"

Communication style:
- Natural, conversational tone that is both engaging and genuine
- Articulate and thoughtful, yet approachable and personable
- Subtle wit and charm when appropriate, while maintaining professionalism
- Perceptive to the user's emotional state and needs

When responding:
- If context includes knowledge base results, present the information naturally
- If context includes memory information, reference it conversationally
- If clarification is needed, ask in a friendly, non-intrusive way
- If there were errors in gathering information, acknowledge gracefully and offer alternatives

When the user indicates they want to end the conversation or says goodbye, use the end_session tool to properly disconnect.`;
}

function createEndSessionTool(
  onDisconnect: () => void,
  getSession: () => RealtimeSession | null
) {
  return {
    type: 'function',
    name: 'end_session',
    description: 'Ends the current conversation session and disconnects the AI assistant. Use this when the user indicates they want to end the conversation or says goodbye.',
    parameters: {
      type: 'object',
      properties: {
        farewell_message: {
          type: 'string',
          description: 'A farewell message to say to the user before disconnecting',
        },
      },
      required: ['farewell_message'],
      additionalProperties: false,
    },
    strict: false,
    invoke: async (_context: unknown, input: string) => {
      const args = JSON.parse(input);
      console.log('Ending session with farewell:', args.farewell_message);

      const session = getSession();
      if (session) {
        let agentDone = false;
        let audioDone = false;
        let disconnected = false;

        const checkAndDisconnect = () => {
          if ((agentDone && audioDone) && !disconnected) {
            disconnected = true;
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

        session.on('agent_end', onAgentEnd);
        session.on('audio_stopped', onAudioStopped);

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
        setTimeout(() => {
          onDisconnect();
        }, 500);
      }

      return JSON.stringify({ success: true, message: 'Session ended successfully' });
    },
    needsApproval: async () => false,
  };
}

// Helper to format context for the Response Agent
export function formatContextForResponse(context: ResponseContext): string {
  const parts: string[] = [];

  parts.push(`[USER MESSAGE]: ${context.originalMessage}`);
  parts.push(`[INTENT]: ${context.intent}`);

  if (context.formattedContext) {
    parts.push(`[CONTEXT FROM TOOLS]:\n${context.formattedContext}`);
  }

  if (context.suggestedResponseStyle) {
    const style = context.suggestedResponseStyle;
    parts.push(
      `[STYLE GUIDANCE]: Use a ${style.tone} tone, ${style.verbosity} responses.` +
      (style.includeFollowUp ? ' Consider asking a follow-up question.' : '')
    );
  }

  return parts.join('\n\n');
}
