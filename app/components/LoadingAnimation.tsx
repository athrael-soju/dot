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
  autoplay?: boolean;
}

export default function LoadingAnimation({ autoplay = false }: LoadingAnimationProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | undefined>(undefined);
  const toendRef = useRef(autoplay);

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
    let animatestep = 0;

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
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvassize, canvassize);
    renderer.setClearColor('#d1684e');

    // Style the canvas element
    const canvas = renderer.domElement;
    canvas.style.position = 'absolute';
    canvas.style.left = '50%';
    canvas.style.top = '50%';
    canvas.style.transform = 'translate(-50%, -50%)';
    canvas.style.width = `${canvassize}px`;
    canvas.style.height = `${canvassize}px`;

    currentWrap.appendChild(canvas);

    // Event handlers
    const start = () => {
      toendRef.current = true;
    };

    const back = () => {
      toendRef.current = false;
    };

    // Easing function
    const easing = (t: number, b: number, c: number, d: number) => {
      if ((t /= d / 2) < 1) return (c / 2) * t * t + b;
      return (c / 2) * ((t -= 2) * t * t + 2) + b;
    };

    // Render function
    const render = () => {
      let progress;

      animatestep = Math.max(
        0,
        Math.min(240, toendRef.current ? animatestep + 1 : animatestep - 4)
      );
      acceleration = easing(animatestep, 0, 1, 240);

      if (acceleration > 0.35) {
        progress = (acceleration - 0.35) / 0.65;
        group.rotation.y = (-Math.PI / 2) * progress;
        group.position.z = 50 * progress;
        progress = Math.max(0, (acceleration - 0.97) / 0.03);
        mesh.material.opacity = 1 - progress;
        (ringcover.material as THREE.MeshBasicMaterial).opacity = progress;
        (ring.material as THREE.MeshBasicMaterial).opacity = progress;
        ring.scale.x = ring.scale.y = 0.9 + 0.1 * progress;
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
    document.body.addEventListener('mousedown', start, false);
    document.body.addEventListener('touchstart', start, false);
    document.body.addEventListener('mouseup', back, false);
    document.body.addEventListener('touchend', back, false);
    window.addEventListener('resize', handleResize, false);

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      document.body.removeEventListener('mousedown', start);
      document.body.removeEventListener('touchstart', start);
      document.body.removeEventListener('mouseup', back);
      document.body.removeEventListener('touchend', back);
      window.removeEventListener('resize', handleResize);

      if (currentWrap && renderer.domElement) {
        currentWrap.removeChild(renderer.domElement);
      }

      renderer.dispose();
    };
  }, []);

  return (
    <div className="fixed inset-0 w-screen h-screen">
      <div
        ref={wrapRef}
        className="absolute left-0 right-0 top-0 bottom-0 overflow-hidden"
      />
      <p className="absolute left-0 right-0 bottom-0 text-xs text-[#ccc] leading-8 text-center">
        * {autoplay ? 'Animation playing automatically. ' : ''}Mouse or Finger press on the page to {autoplay ? 'control' : 'finish'} loading action.
      </p>
    </div>
  );
}
