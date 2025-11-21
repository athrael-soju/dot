import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { animationConfig } from './useLoadingAnimation/config';
import { createScene } from './useLoadingAnimation/scene';
import { setupInteractions } from './useLoadingAnimation/interactions';

interface UseLoadingAnimationProps {
    onAnimationComplete?: () => void;
    isAgentConnected?: boolean;
    isAgentSpeaking?: boolean;
    audioFrequencyData?: Uint8Array | null;
    shouldReset?: boolean;
}

export const useLoadingAnimation = ({
    onAnimationComplete,
    isAgentConnected,
    isAgentSpeaking,
    audioFrequencyData,
    shouldReset,
}: UseLoadingAnimationProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const animationFrameRef = useRef<number | undefined>(undefined);
    const completedRef = useRef(false);
    const completionCallbackFiredRef = useRef(false);
    const animationStartedRef = useRef(false);
    const isAgentConnectedRef = useRef(false);
    const isAgentSpeakingRef = useRef(false);
    const audioDataRef = useRef<Uint8Array | null>(null);
    const animateStepRef = useRef(0);
    const isReversingRef = useRef(false);
    const idleAnimationTimeRef = useRef(0);
    const isMountedRef = useRef(true);

    // Update ref when isAgentConnected changes
    useEffect(() => {
        isAgentConnectedRef.current = isAgentConnected || false;
    }, [isAgentConnected]);

    // Update ref when isAgentSpeaking changes
    useEffect(() => {
        isAgentSpeakingRef.current = isAgentSpeaking || false;
    }, [isAgentSpeaking]);

    // Update audio data ref
    useEffect(() => {
        audioDataRef.current = audioFrequencyData || null;
    }, [audioFrequencyData]);

    // Handle reset - trigger smooth reverse animation
    useEffect(() => {
        if (shouldReset) {
            isReversingRef.current = true;
            animationStartedRef.current = false;
        }
    }, [shouldReset]);

    useEffect(() => {
        const currentContainer = containerRef.current;
        if (!currentContainer) return;

        // Mark component as mounted
        isMountedRef.current = true;

        const areawidth = window.innerWidth;
        const areaheight = window.innerHeight;
        const canvassize = Math.min(Math.min(areawidth, areaheight));

        const { scene, camera, group, mesh, ring, ringcover, clickableArea, renderer, dispose: disposeScene } = createScene(currentContainer, canvassize);
        const canvas = renderer.domElement;
        const rotatevalue = animationConfig.rotationIncrement;
        let acceleration = 0;

        const { dispose: disposeInteractions } = setupInteractions({
            canvas: renderer.domElement,
            camera,
            targets: [mesh, ring, ringcover, clickableArea],
            onActivate: () => {
                if (!animationStartedRef.current) {
                    animationStartedRef.current = true;
                    if (!completionCallbackFiredRef.current && onAnimationComplete) {
                        completionCallbackFiredRef.current = true;
                        onAnimationComplete();
                    }
                }
            },
        });

        // Easing function
        const easing = (t: number, b: number, c: number, d: number) => {
            if ((t /= d / 2) < 1) return (c / 2) * t * t + b;
            return (c / 2) * ((t -= 2) * t * t + 2) + b;
        };

        // Render function
        const render = () => {
            let progress: number = 0;

            if (isReversingRef.current) {
                const reverseSpeed = 2;
                animateStepRef.current = Math.max(0, animateStepRef.current - reverseSpeed);

                if (animateStepRef.current === 0) {
                    isReversingRef.current = false;
                    completedRef.current = false;
                    completionCallbackFiredRef.current = false;
                    idleAnimationTimeRef.current = 0;
                }
            } else if (animationStartedRef.current) {
                const maxStep = isAgentConnectedRef.current ? 240 : 120;
                const speed = isAgentConnectedRef.current ? 1 : 0.25;
                animateStepRef.current = Math.max(0, Math.min(maxStep, animateStepRef.current + speed));
            }

            if (animateStepRef.current >= 240) {
                completedRef.current = true;
                // Increment idle animation time for spinning effect (negative for clockwise)
                idleAnimationTimeRef.current -= 0.01;
            }

            acceleration = easing(animateStepRef.current, 0, 1, 240);

            if (acceleration > 0.35) {
                progress = (acceleration - 0.35) / 0.65;
                group.rotation.y = (-Math.PI / 2) * progress;
                group.position.z = 50 * progress;
                progress = Math.max(0, (acceleration - 0.97) / 0.03);
                (mesh.material as THREE.MeshBasicMaterial).opacity = 1 - progress;
                (ringcover.material as THREE.MeshBasicMaterial).opacity = progress;
                (ring.material as THREE.MeshBasicMaterial).opacity = progress;
                ring.scale.x = ring.scale.y = 0.9 + 0.1 * progress;

                // Spinning animation when completed (clockwise)
                if (completedRef.current) {
                    ring.rotation.z = idleAnimationTimeRef.current;
                }
            } else {
                group.rotation.y = 0;
                group.position.z = 0;
                (mesh.material as THREE.MeshBasicMaterial).opacity = 1;
                (ringcover.material as THREE.MeshBasicMaterial).opacity = 0;
                (ring.material as THREE.MeshBasicMaterial).opacity = 0;
                ring.scale.x = ring.scale.y = 0.9;
            }

            renderer.render(scene, camera);
        };

        // Animation loop
        const animate = () => {
            // Stop animation if component is unmounted
            if (!isMountedRef.current) {
                return;
            }

            mesh.rotation.x += rotatevalue + acceleration;
            render();
            animationFrameRef.current = requestAnimationFrame(animate);
        };

        animate();

        // Handle window resize
        const handleResize = () => {
            const newWidth = window.innerWidth;
            const newHeight = window.innerHeight;
            const newCanvasSize = Math.min(Math.min(newWidth, newHeight));

            renderer.setSize(newCanvasSize, newCanvasSize);
            canvas.style.width = `${newCanvasSize}px`;
            canvas.style.height = `${newCanvasSize}px`;
        };

        window.addEventListener('resize', handleResize, false);

        // Cleanup
        return () => {
            // Mark component as unmounted to stop animation loop
            isMountedRef.current = false;

            // Cancel any pending animation frame
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }

            // Clean up event listeners and Three.js resources
            window.removeEventListener('resize', handleResize);
            disposeInteractions();
            disposeScene();
        };
    }, [onAnimationComplete]);

    return containerRef;
};
