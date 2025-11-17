'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

// Custom curve class moved outside component to fix linting
class CustomCurve extends THREE.Curve<THREE.Vector3> {
  private length: number;
  private radius: number;
  private pi2: number;

  constructor(length: number, radius: number, pi2: number) {
    super();
    this.length = length;
    this.radius = radius;
    this.pi2 = pi2;
  }

  getPoint(percent: number): THREE.Vector3 {
    const x = this.length * Math.sin(this.pi2 * percent);
    const y = this.radius * Math.cos(this.pi2 * 3 * percent);
    let t;

    t = (percent % 0.25) / 0.25;
    t = (percent % 0.25) - (2 * (1 - t) * t * -0.0185 + t * t * 0.25);
    if (Math.floor(percent / 0.25) === 0 || Math.floor(percent / 0.25) === 2) {
      t *= -1;
    }
    const z = this.radius * Math.sin(this.pi2 * 2 * (percent - t));

    return new THREE.Vector3(x, y, z);
  }
}

interface LoadingAnimationProps {
  onAnimationComplete?: () => void;
  isAgentConnected?: boolean;
  shouldReset?: boolean;
}

export default function LoadingAnimation({ onAnimationComplete, isAgentConnected, shouldReset }: LoadingAnimationProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const completedRef = useRef(false);
  const completionCallbackFiredRef = useRef(false);
  const animationStartedRef = useRef(false);
  const isAgentConnectedRef = useRef(false);
  const animateStepRef = useRef(0);
  const isReversingRef = useRef(false);

  // Update ref when isAgentConnected changes
  useEffect(() => {
    isAgentConnectedRef.current = isAgentConnected || false;
  }, [isAgentConnected]);

  // Handle reset - trigger smooth reverse animation
  useEffect(() => {
    if (shouldReset) {
      isReversingRef.current = true;
      animationStartedRef.current = false;
    }
  }, [shouldReset]);

  useEffect(() => {
    // Capture ref value to fix React hooks warning
    const currentWrap = wrapRef.current;
    if (!currentWrap) return;

    const areawidth = window.innerWidth;
    const areaheight = window.innerHeight;

    // Make canvas size responsive
    const canvassize = Math.min(Math.min(areawidth, areaheight));

    const length = 30;
    const radius = 5.6;

    const rotatevalue = 0.035;
    let acceleration = 0;

    const pi2 = Math.PI * 2;

    const group = new THREE.Group();

    // Camera setup
    const camera = new THREE.PerspectiveCamera(65, 1, 1, 10000);
    camera.position.z = 150;

    // Scene setup
    const scene = new THREE.Scene();
    scene.add(group);

    // Create tube mesh
    const mesh = new THREE.Mesh(
      new THREE.TubeGeometry(new CustomCurve(length, radius, pi2), 200, 1.1, 2, true),
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
      })
    );
    group.add(mesh);

    // Ring cover
    const ringcover = new THREE.Mesh(
      new THREE.PlaneGeometry(50, 15, 1),
      new THREE.MeshBasicMaterial({ color: 0xd1684e, opacity: 0, transparent: true })
    );
    ringcover.position.x = length + 1;
    ringcover.rotation.y = Math.PI / 2;
    group.add(ringcover);

    // Ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(4.3, 5.55, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, transparent: true })
    );
    ring.position.x = length + 1.1;
    ring.rotation.y = Math.PI / 2;
    group.add(ring);

    // Fake shadow
    for (let i = 0; i < 10; i++) {
      const plain = new THREE.Mesh(
        new THREE.PlaneGeometry(length * 2 + 1, radius * 3, 1),
        new THREE.MeshBasicMaterial({ color: 0xd1684e, transparent: true, opacity: 0.13 })
      );
      plain.position.z = -2.5 + i * 0.5;
      group.add(plain);
    }

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true, // Enable transparency

    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvassize, canvassize);
    renderer.setClearColor(0x000000, 0);

    // Style the canvas element
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.width = `${canvassize}px`;
    canvas.style.height = `${canvassize}px`;
    canvas.style.cursor = 'default';

    currentWrap.appendChild(canvas);

    // Raycaster for detecting clicks on the animation
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    // Create an invisible clickable area that matches the geometry dimensions
    // The tube extends along x-axis with length=30 (so -30 to +30) and radius=5.6 for y/z
    // Using CapsuleGeometry (cylinder with rounded ends) rotated to align with x-axis
    const clickableArea = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius * 1.5, length * 1.5),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    clickableArea.rotation.z = Math.PI / 2; // Rotate to align with x-axis
    group.add(clickableArea);

    // Click handler to start animation - only when clicking on the mesh or its interior
    const handleCanvasClick = (event: MouseEvent) => {
      if (!animationStartedRef.current) {
        // Calculate mouse position in normalized device coordinates (-1 to +1)
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Update the raycaster with the camera and mouse position
        raycaster.setFromCamera(mouse, camera);

        // Check for intersections with the mesh, ring, ringcover, or clickable area
        const intersects = raycaster.intersectObjects([mesh, ring, ringcover, clickableArea]);

        if (intersects.length > 0) {
          animationStartedRef.current = true;

          // Fire the callback when animation starts
          if (!completionCallbackFiredRef.current && onAnimationComplete) {
            completionCallbackFiredRef.current = true;
            onAnimationComplete();
          }
        }
      }
    };

    canvas.addEventListener('click', handleCanvasClick);

    // Mouse move handler to show pointer cursor only when hovering over the mesh or its interior
    const handleMouseMove = (event: MouseEvent) => {
      if (!animationStartedRef.current) {
        const rect = canvas.getBoundingClientRect();
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects([mesh, ring, ringcover, clickableArea]);

        canvas.style.cursor = intersects.length > 0 ? 'pointer' : 'default';
      } else {
        canvas.style.cursor = 'default';
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);

    // Easing function
    const easing = (t: number, b: number, c: number, d: number) => {
      if ((t /= d / 2) < 1) return (c / 2) * t * t + b;
      return (c / 2) * ((t -= 2) * t * t + 2) + b;
    };

    // Render function
    const render = () => {
      let progress;

      // Handle reverse animation (smooth reset)
      if (isReversingRef.current) {
        // Reverse at 2x speed for quicker reset
        const reverseSpeed = 2;
        animateStepRef.current = Math.max(0, animateStepRef.current - reverseSpeed);

        // Once fully reversed, complete the reset
        if (animateStepRef.current === 0) {
          isReversingRef.current = false;
          completedRef.current = false;
          completionCallbackFiredRef.current = false;
        }
      }
      // Only advance animation if started and not reversing
      else if (animationStartedRef.current) {
        // Pause at halfway (120 steps) until agent is connected
        const maxStep = isAgentConnectedRef.current ? 240 : 120;
        // Slower speed while waiting for agent, normal speed after connected
        const speed = isAgentConnectedRef.current ? 1 : 0.25;
        animateStepRef.current = Math.max(0, Math.min(maxStep, animateStepRef.current + speed));
      }

      // Mark as completed when animation reaches the end
      if (animateStepRef.current >= 240) {
        completedRef.current = true;
      }

      acceleration = easing(animateStepRef.current, 0, 1, 240);

      if (acceleration > 0.35) {
        progress = (acceleration - 0.35) / 0.65;
        group.rotation.y = (-Math.PI / 2) * progress;
        group.position.z = 50 * progress;
        progress = Math.max(0, (acceleration - 0.97) / 0.03);
        mesh.material.opacity = 1 - progress;
        (ringcover.material as THREE.MeshBasicMaterial).opacity = progress;
        (ring.material as THREE.MeshBasicMaterial).opacity = progress;
        ring.scale.x = ring.scale.y = 0.9 + 0.1 * progress;
      } else {
        // Reset to initial state when animation is at the beginning
        group.rotation.y = 0;
        group.position.z = 0;
        mesh.material.opacity = 1;
        (ringcover.material as THREE.MeshBasicMaterial).opacity = 0;
        (ring.material as THREE.MeshBasicMaterial).opacity = 0;
        ring.scale.x = ring.scale.y = 0.9;
      }

      renderer.render(scene, camera);
    };

    // Animation loop
    const animate = () => {
      mesh.rotation.x += rotatevalue + acceleration;
      render();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    // Start animation
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

    // Add event listeners
    window.addEventListener('resize', handleResize, false);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      canvas.removeEventListener('click', handleCanvasClick);
      canvas.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);

      if (currentWrap && renderer.domElement) {
        currentWrap.removeChild(renderer.domElement);
      }

      renderer.dispose();
    };
  }, [onAnimationComplete]);

  return (
    <div className="fixed inset-0 w-screen h-screen">
      <div
        ref={wrapRef}
        className="absolute left-0 right-0 top-0 bottom-0 overflow-hidden"
      />
    </div>
  );
}
