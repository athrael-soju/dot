import { RealtimeAgent } from '@openai/agents/realtime';

// Minimal conversational agent
export const conversationalAgent = new RealtimeAgent({
  name: 'assistant',
  handoffDescription: 'A helpful AI assistant',
  instructions:
    'You are a friendly and helpful AI assistant. Engage in natural conversation with the user. Be concise but warm in your responses.',
  tools: [],
  handoffs: [],
});

const agents = [conversationalAgent];
export default agents;
