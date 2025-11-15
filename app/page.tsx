'use client';

import { useEffect, useState, useRef, useCallback } from "react";
import LoadingAnimation from "./components/LoadingAnimation";
import { OpenAIRealtimeWebRTC } from '@openai/agents/realtime';

export default function Home() {
  const [mounted, setMounted] = useState(false);

  const clientRef = useRef<OpenAIRealtimeWebRTC | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const hasConnectedRef = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup agent on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.close();
      }
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
      }
    };
  }, []);

  const handleAnimationClick = useCallback(async () => {
    // Prevent multiple connections
    if (hasConnectedRef.current) return;

    hasConnectedRef.current = true;

    try {
      // Get session token
      const response = await fetch('/api/session', {
        method: 'POST',
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Session creation failed:', errorData);
        throw new Error(errorData.error || 'Failed to create session');
      }

      const sessionData = await response.json();
      console.log('Session created successfully');

      // Create audio element for playback
      const audioElement = new Audio();
      audioElement.autoplay = true;
      audioElementRef.current = audioElement;

      // Initialize WebRTC client with audio element
      const client = new OpenAIRealtimeWebRTC({
        audioElement: audioElement,
      });

      clientRef.current = client;

      // Connect to the realtime API
      console.log('Connecting to realtime API...');
      await client.connect({
        apiKey: sessionData.client_secret.value,
        model: 'gpt-realtime-mini',
      });
      console.log('Connected successfully');

      // Send initial greeting
      client.sendMessage('Hello!', {});
    } catch (err) {
      console.error('Failed to initialize agent:', err);
      hasConnectedRef.current = false;

      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to connect to AI agent: ${errorMessage}`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d1684e] font-sans">
      {mounted && (
        <LoadingAnimation
          onAnimationComplete={handleAnimationClick}
        />
      )}
    </div>
  );
}
