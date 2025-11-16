'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import LoadingAnimation from "./components/LoadingAnimation";
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { createResponseAgent } from './lib/multi-agent/response-agent';
import { v4 as uuidv4 } from 'uuid';

export default function Home() {
  const [mounted, setMounted] = useState(false);
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [shouldReset, setShouldReset] = useState(false);
  const [debugMode, setDebugMode] = useState(false);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const hasConnectedRef = useRef(false);
  const orchestratorSessionIdRef = useRef<string>('');

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup agent on unmount
  useEffect(() => {
    return () => {
      if (sessionRef.current) {
        sessionRef.current.close();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
      }
      // Reset orchestrator session on unmount
      if (orchestratorSessionIdRef.current) {
        fetch('/api/orchestrate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'reset',
            sessionId: orchestratorSessionIdRef.current
          })
        }).catch(console.error);
      }
    };
  }, []);

  // Helper to process messages through the orchestrator
  const processWithOrchestrator = useCallback(async (message: string): Promise<string> => {
    const response = await fetch('/api/orchestrate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'process',
        sessionId: orchestratorSessionIdRef.current,
        message,
        debugMode
      })
    });

    if (!response.ok) {
      throw new Error('Failed to process message through orchestrator');
    }

    const data = await response.json();
    if (debugMode) {
      console.log('[Orchestrator Response]:', data);
    }
    return data.context;
  }, [debugMode]);

  // Disconnect and reset handler
  const handleDisconnect = useCallback(() => {
    // Close the session
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }

    // Stop and cleanup audio
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.srcObject = null;
      audioElementRef.current = null;
    }

    // Reset orchestrator session
    if (orchestratorSessionIdRef.current) {
      fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset',
          sessionId: orchestratorSessionIdRef.current
        })
      }).catch(console.error);
      orchestratorSessionIdRef.current = '';
    }

    // Reset all state
    setIsAgentConnected(false);
    hasConnectedRef.current = false;
    setShouldReset(true);

    // Reset the animation reset flag after a short delay
    setTimeout(() => {
      setShouldReset(false);
    }, 100);
  }, []);

  const handleAnimationClick = useCallback(async () => {
    // Prevent multiple connections
    if (hasConnectedRef.current) return;

    hasConnectedRef.current = true;

    try {
      // Get ephemeral token for Realtime API
      const sessionResponse = await fetch('/api/session', {
        method: 'POST',
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json();
        console.error('Session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await sessionResponse.json();
      console.log('Session token created successfully');

      // Initialize the orchestrator session
      const orchestratorSessionId = uuidv4();
      orchestratorSessionIdRef.current = orchestratorSessionId;

      const orchestratorResponse = await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initialize',
          sessionId: orchestratorSessionId,
          debugMode
        })
      });

      if (!orchestratorResponse.ok) {
        throw new Error('Failed to initialize orchestrator');
      }

      console.log('Multi-agent orchestrator initialized');

      // Create audio element for playback
      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;

      // Create WebRTC transport with audio element
      const transport = new OpenAIRealtimeWebRTC({
        audioElement: audioElement,
      });

      // Create the Response Agent (voice-enabled)
      const agent = createResponseAgent(
        handleDisconnect,
        () => sessionRef.current
      );

      // Create RealtimeSession with the agent and transport
      const session = new RealtimeSession(agent, {
        transport: transport,
      });

      sessionRef.current = session;

      // Set up message interception for orchestration
      setupMessageInterception(session);

      // Connect to the realtime API
      console.log('Connecting to realtime API...');
      await session.connect({
        apiKey: sessionData.client_secret.value,
        model: 'gpt-realtime-mini',
      });
      console.log('Connected successfully');

      // Update state to indicate agent is connected
      setIsAgentConnected(true);

      // Process initial greeting through the orchestrator
      const initialContext = await processWithOrchestrator('User is greeting and starting a conversation');
      console.log('Initial context prepared:', initialContext);

      // Send initial greeting with orchestrated context
      session.sendMessage(`[SYSTEM CONTEXT]\n${initialContext}\n\n[USER ACTION]\nUser has just connected and is ready to talk. Greet them warmly.`);
    } catch (err) {
      console.error('Failed to initialize agent:', err);
      hasConnectedRef.current = false;
      orchestratorSessionIdRef.current = '';

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to connect to AI agent: ${errorMessage}`);
    }
  }, [handleDisconnect, debugMode, processWithOrchestrator]);

  // Set up interception of user messages for orchestration
  const setupMessageInterception = useCallback((session: RealtimeSession) => {
    // Listen for user transcription events
    // Cast to any to handle SDK event typing limitations
    const sessionWithEvents = session as unknown as {
      on: (event: string, handler: (data: unknown) => void) => void;
      sendMessage: (message: string) => void;
    };

    sessionWithEvents.on('user_message', async (eventData: unknown) => {
      const event = eventData as { text?: string };
      if (event.text && orchestratorSessionIdRef.current) {
        console.log('[User Message Received]:', event.text);

        try {
          // Process the message through the multi-agent pipeline
          const enrichedContext = await processWithOrchestrator(event.text);
          console.log('[Orchestrator] Context enriched:', enrichedContext);

          // Send enriched context to the Response Agent
          sessionWithEvents.sendMessage(
            `[CONTEXT UPDATE]\n${enrichedContext}\n\n[ORIGINAL USER MESSAGE]\n${event.text}`
          );
        } catch (error) {
          console.error('[Orchestrator] Error processing message:', error);
        }
      }
    });

    // Log agent responses for debugging
    sessionWithEvents.on('agent_message', (eventData: unknown) => {
      const event = eventData as { text?: string };
      if (event.text && debugMode) {
        console.log('[Agent Response]:', event.text);
      }
    });
  }, [debugMode, processWithOrchestrator]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d1684e] font-sans relative">
      {mounted && (
        <>
          <LoadingAnimation
            onAnimationComplete={handleAnimationClick}
            isAgentConnected={isAgentConnected}
            shouldReset={shouldReset}
          />

          {/* Debug mode toggle */}
          <div className="absolute top-4 right-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
            <label
              htmlFor="debug-mode"
              className="text-white/80 text-sm font-medium cursor-pointer"
            >
              Debug
            </label>
            <button
              id="debug-mode"
              onClick={() => setDebugMode(!debugMode)}
              className={`relative w-10 h-5 rounded-full transition-colors ${
                debugMode ? 'bg-green-500' : 'bg-white/30'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${
                  debugMode ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Connection status indicator */}
          {isAgentConnected && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-white/80 text-sm">Multi-Agent System Active</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
