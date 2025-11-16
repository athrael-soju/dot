import { NextRequest, NextResponse } from 'next/server';
import { getOrchestrator } from '../../lib/orchestrator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required and must be a string' },
        { status: 400 }
      );
    }

    console.log('[API] Received orchestrator request:', message.substring(0, 100));

    const orchestrator = await getOrchestrator();
    const result = await orchestrator.processMessage(message);

    console.log('[API] Orchestrator completed:', {
      success: result.success,
      intent: result.routingDecision.intent,
      executionTime: `${result.totalExecutionTime.toFixed(2)}ms`,
    });

    return NextResponse.json({
      success: result.success,
      response: result.response.content,
      intent: result.routingDecision.intent,
      reasoning: result.response.reasoning,
      toolsUsed: result.routingDecision.selectedTools,
      executionTimeMs: result.totalExecutionTime,
      error: result.error,
    });
  } catch (error) {
    console.error('[API] Orchestrator error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        response: 'I encountered an issue processing your request.',
      },
      { status: 500 }
    );
  }
}
