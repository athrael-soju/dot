import { NextRequest, NextResponse } from 'next/server';
import { MultiAgentOrchestrator, getDefaultTools, clearSessionMemory } from '../../lib/multi-agent';

// Store orchestrators per session
const orchestrators = new Map<string, MultiAgentOrchestrator>();

// Clean up old sessions periodically
const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
const sessionLastAccess = new Map<string, number>();

function cleanupOldSessions() {
  const now = Date.now();
  for (const [sessionId, lastAccess] of sessionLastAccess.entries()) {
    if (now - lastAccess > SESSION_TIMEOUT) {
      orchestrators.delete(sessionId);
      sessionLastAccess.delete(sessionId);
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { action, sessionId, message, debugMode = false } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'sessionId is required' },
        { status: 400 }
      );
    }

    // Update last access time
    sessionLastAccess.set(sessionId, Date.now());

    // Cleanup old sessions periodically
    if (Math.random() < 0.1) {
      cleanupOldSessions();
    }

    switch (action) {
      case 'initialize': {
        // Create new orchestrator for this session
        const orchestrator = new MultiAgentOrchestrator(apiKey, {
          debugMode,
          enableParallelToolExecution: true,
          maxToolExecutionTime: 30000,
          maxConversationHistory: 50
        });

        // Register default tools
        orchestrator.registerTools(getDefaultTools());

        orchestrators.set(sessionId, orchestrator);

        return NextResponse.json({
          success: true,
          sessionId,
          message: 'Orchestrator initialized'
        });
      }

      case 'process': {
        if (!message) {
          return NextResponse.json(
            { error: 'message is required for process action' },
            { status: 400 }
          );
        }

        let orchestrator = orchestrators.get(sessionId);

        // Auto-initialize if not exists
        if (!orchestrator) {
          orchestrator = new MultiAgentOrchestrator(apiKey, {
            debugMode,
            enableParallelToolExecution: true,
            maxToolExecutionTime: 30000,
            maxConversationHistory: 50
          });
          orchestrator.registerTools(getDefaultTools());
          orchestrators.set(sessionId, orchestrator);
        }

        // Process the message through the multi-agent pipeline
        const context = await orchestrator.processMessage(message);

        return NextResponse.json({
          success: true,
          context,
          sessionInfo: orchestrator.getSessionInfo()
        });
      }

      case 'reset': {
        const orchestrator = orchestrators.get(sessionId);
        if (orchestrator) {
          orchestrator.reset();
        }
        orchestrators.delete(sessionId);
        sessionLastAccess.delete(sessionId);
        clearSessionMemory();

        return NextResponse.json({
          success: true,
          message: 'Session reset'
        });
      }

      case 'getHistory': {
        const orchestrator = orchestrators.get(sessionId);
        if (!orchestrator) {
          return NextResponse.json(
            { error: 'Session not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          history: orchestrator.getConversationHistory(),
          sessionInfo: orchestrator.getSessionInfo()
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Orchestration error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
