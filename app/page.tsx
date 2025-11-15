'use client';

import { useEffect, useState } from "react";
import LoadingAnimation from "./components/LoadingAnimation";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [autoplay, setAutoplay] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Load autoplay preference from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('animation-autoplay');
    if (saved !== null) {
      setAutoplay(saved === 'true');
    }
    setMounted(true);
  }, []);

  // Save autoplay preference to localStorage when it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('animation-autoplay', String(autoplay));
    }
  }, [autoplay, mounted]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#d1684e] font-sans">
      {/* Autoplay Toggle - Top Right */}
      <div className="fixed top-4 right-4 z-50 flex items-center space-x-2 bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg">
        <Label htmlFor="autoplay-toggle" className="text-white text-sm cursor-pointer">
          Autoplay
        </Label>
        <Switch
          id="autoplay-toggle"
          checked={autoplay}
          onCheckedChange={setAutoplay}
        />
      </div>

      {mounted && <LoadingAnimation autoplay={autoplay} />}
    </div>
  );
}
