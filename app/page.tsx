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

      // Function to wait for audio playback to finish using silence detection
      const waitForAudioPlayback = async () => {
        if (!audioElementRef.current) return;

        const audio = audioElementRef.current;

        return new Promise<void>((resolve) => {
          // 1. If audio is already paused or ended
          if (audio.paused || audio.ended) {
            resolve();
            return;
          }

          // 2. Setup Web Audio API for silence detection
          try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const audioContext = new AudioContextClass();
            const analyser = audioContext.createAnalyser();
            analyser.fftSize = 256;

            // Get stream from audio element
            const stream = audio.srcObject as MediaStream;
            if (!stream) {
              resolve(); // No stream means no audio
              return;
            }

            const source = audioContext.createMediaStreamSource(stream);
            source.connect(analyser);

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            let silenceStart = Date.now();
            const SILENCE_THRESHOLD = 10; // Low threshold for silence (0-255)
            const SILENCE_DURATION = 1000; // 1 second of silence to confirm end
            let timeoutId: NodeJS.Timeout;
            let isCleanedUp = false;

            const cleanup = () => {
              if (isCleanedUp) return;
              isCleanedUp = true;

              if (timeoutId) clearTimeout(timeoutId);

              try {
                source.disconnect();
                analyser.disconnect();
                if (audioContext.state !== 'closed') {
                  audioContext.close();
                }
              } catch (e) {
                console.warn('Error during audio cleanup:', e);
              }
            };

            const checkSilence = () => {
              if (isCleanedUp) return;

              analyser.getByteFrequencyData(dataArray);

              // Calculate average volume
              let sum = 0;
              for (let i = 0; i < bufferLength; i++) {
                sum += dataArray[i];
              }
              const average = sum / bufferLength;

              if (average < SILENCE_THRESHOLD) {
                // It's silent
                if (Date.now() - silenceStart > SILENCE_DURATION) {
                  // Silence has lasted long enough
                  cleanup();
                  resolve();
                } else {
                  // Continue checking
                  requestAnimationFrame(checkSilence);
                }
              } else {
                // Not silent, reset timer
                silenceStart = Date.now();
                requestAnimationFrame(checkSilence);
              }
            };

            // Start checking
            checkSilence();

            // Safety timeout (max 10 seconds)
            timeoutId = setTimeout(() => {
              cleanup();
              resolve();
            }, 10000);

          } catch (e) {
            console.error('Error setting up silence detection:', e);
            resolve(); // Fallback to immediate resolve on error
          }
        });
      };

      // Create WebRTC transport with audio element
      const transport = new OpenAIRealtimeWebRTC({
        audioElement: audioElement,
      });

      // Create the agent with disconnect callback and session getter
      const agent = createConversationalAgent(
        handleDisconnect,
        () => sessionRef.current,
        waitForAudioPlayback
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
