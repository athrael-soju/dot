'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import LoadingAnimation from "./components/LoadingAnimation";
import { RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime';
import { createConversationalAgent } from './lib/agent';

export default function Home() {
  const [isAgentConnected, setIsAgentConnected] = useState(false);
  const [shouldReset, setShouldReset] = useState(false);

  const sessionRef = useRef<RealtimeSession | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const hasConnectedRef = useRef(false);

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
    };
  }, []);

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
      // Get API key from environment
      const response = await fetch('/api/session', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await response.json();
      console.log('Session token created successfully');

      // Create audio element for playback
      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;

      // Create WebRTC transport with audio element
      const transport = new OpenAIRealtimeWebRTC({
        audioElement: audioElement,
      });

      // Create the agent with disconnect callback and session getter
      const agent = createConversationalAgent(
        handleDisconnect,
        () => sessionRef.current
      );

      // Create RealtimeSession with the agent and transport
      const session = new RealtimeSession(agent, {
        transport: transport,
      });

      sessionRef.current = session;

      // Connect to the realtime API
      console.log('Connecting to realtime API...');
      await session.connect({
        apiKey: sessionData.client_secret.value,
        model: process.env.OPENAI_REALTIME_MODEL,
      });
      console.log('Connected successfully');

      // Update state to indicate agent is connected
      setIsAgentConnected(true);

      // Send initial greeting
      session.sendMessage('Hello!');
    } catch (err) {
      console.error('Failed to initialize agent:', err);
      hasConnectedRef.current = false;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to connect to AI agent: ${errorMessage}`);
    }
  }, [handleDisconnect]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d1684e] font-sans">
      <LoadingAnimation
        onAnimationComplete={handleAnimationClick}
        isAgentConnected={isAgentConnected}
        shouldReset={shouldReset}
      />
    </div>
  );
}
