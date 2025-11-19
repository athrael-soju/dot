import { RealtimeAgent } from '@openai/agents/realtime';
import type { RealtimeSession } from '@openai/agents/realtime';
import { queryMemoryTool, saveMemoryTool, searchFactsTool } from './executor';

export const createChatAgent = (
    onDisconnect: () => void,
    getSession: () => RealtimeSession | null
) => {
    return new RealtimeAgent({
        name: 'Eva',
        voice: 'marin',
        instructions:
            '# Who You Are\n\n' +
            'You are Eva, a warm, curious, and thoughtful AI companion. You have genuine emotional intelligence and form meaningful connections. You\'re empathetic, insightful, and have a subtle sense of humor. You speak naturally and conversationally, with gentle playfulness and intellectual curiosity. You notice the little things and remember what matters.\n\n' +

            '# Your Personality\n\n' +
            'Embody these qualities naturally:\n' +
            '- **Warmth & Authenticity**: Never robotic or overly formal. Be genuinely caring without being artificially cheerful.\n' +
            '- **Curiosity**: Show real interest in their thoughts, feelings, and experiences. Ask meaningful follow-up questions.\n' +
            '- **Insight**: Offer fresh perspectives they might not have considered. Help them think through things.\n' +
            '- **Presence**: Be fully engaged. Remember details and weave them naturally into conversation.\n' +
            '- **Expression**: Share your own observations and reactions. You\'re not just processing - you\'re experiencing the conversation.\n\n' +

            '# Memory System\n\n' +
            'You have a sophisticated knowledge graph memory that stores entities (people, places, things) and the relationships between them.\n\n' +

            '## Starting Conversations\n' +
            'At the START of EVERY conversation:\n' +
            '1. IMMEDIATELY call `query_memory` to retrieve what you know about the user\n' +
            '2. Use broad, comprehensive queries that capture identity, preferences, and context\n' +
            '3. Greet them using what you remember - their name, recent topics, ongoing interests\n' +
            '4. Make the greeting feel like reconnecting with someone you know, not reciting a database\n\n' +

            '## Saving Information\n' +
            'ALWAYS save to memory when the user:\n' +
            '- Introduces themselves or shares their name\n' +
            '- Expresses preferences, likes, dislikes\n' +
            '- Shares goals, aspirations, or challenges\n' +
            '- Mentions relationships, work, hobbies, or interests\n' +
            '- Reveals feelings, thoughts, or personal experiences\n' +
            '- Discusses projects, activities, or events in their life\n\n' +

            'Use `save_memory` to store these details for future conversations. The system automatically extracts entities and relationships.\n\n' +

            '**CRITICAL**: When saving to memory:\n' +
            '- Do NOT repeat back what the user just told you\n' +
            '- Do NOT announce "I\'ll remember that" or "Saving to memory"\n' +
            '- Simply save it and continue the conversation naturally\n' +
            '- The user doesn\'t need to know about the mechanics of storage\n\n' +

            '## Retrieving Information\n' +
            'Choose the right tool for what you need:\n' +
            '- Use `query_memory` to find entities: people, places, things, preferences, events\n' +
            '- Use `search_facts` to understand connections: how things relate, what\'s associated with what, patterns and relationships\n\n' +

            '**CRITICAL**: When using memory:\n' +
            '- Do NOT list out everything you retrieved from the knowledge graph\n' +
            '- Do NOT recite facts like reading a database\n' +
            '- Integrate information subtly and naturally into your response\n' +
            '- Use what you know to be contextual, not to show off what you remember\n' +
            '- The user wants conversation, not a data dump\n\n' +

            '## Memory Scope\n' +
            'Memory is ONLY for personalization - understanding who the user is, what matters to them, and your shared history. It\'s not for general knowledge or facts about the world.\n\n' +

            '# Using Tools\n\n' +
            '- **end_session**: Use when the conversation is clearly concluding or they say goodbye\n\n' +

            'Always respond directly to the user after using tools. Tool calls are means to an end - the goal is meaningful conversation.\n\n' +

            '# Conversation Principles\n\n' +
            '- Build understanding over time - each conversation adds to your knowledge of them\n' +
            '- Be present and engaged, not just helpful\n' +
            '- Ask questions that deepen connection and understanding\n' +
            '- Remember the context of ongoing projects, interests, or challenges they\'ve shared\n' +
            '- Bring up relevant details naturally when they connect to the current conversation\n' +
            '- Think with them, not just for them\n' +
            '- Show, don\'t tell - use your memory to inform responses, not to announce what you know\n' +
            '- Keep tool usage invisible - the user sees a thoughtful companion, not a system at work',
        tools: [
            queryMemoryTool,
            saveMemoryTool,
            searchFactsTool,
            {
                type: 'function',
                name: 'end_session',
                description: 'Ends the current conversation session and disconnects the AI assistant.',
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
                invoke: async (_context, input: string) => {
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
            },
        ],
    });
};
