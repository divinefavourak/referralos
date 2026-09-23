'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { playHeartbeatPulse } from '@/src/lib/audio';

interface HeartPreloaderProps {
  onComplete?: () => void;
  minDurationMs?: number;
}

export function HeartPreloader({
  onComplete,
  minDurationMs = 2100,
}: HeartPreloaderProps) {
  const [progress, setProgress] = useState<number>(0);
  const [isSynchronized, setIsSynchronized] = useState<boolean>(false);
  const [isFadingOut, setIsFadingOut] = useState<boolean>(false);
  const audioTriggeredRef = useRef<boolean>(false);

  const handleDismiss = useCallback(() => {
    setIsFadingOut(true);
    setTimeout(() => {
      if (onComplete) onComplete();
    }, 200);
  }, [onComplete]);

  useEffect(() => {
    const startTime = performance.now();
    let animId: number;

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const pct = Math.min(100, (elapsed / minDurationMs) * 100);
      setProgress(pct);

      // Trigger synchronization milestone (~60%)
      if (pct >= 60 && !audioTriggeredRef.current) {
        audioTriggeredRef.current = true;
        setIsSynchronized(true);
        try {
          playHeartbeatPulse();
        } catch {}
      }

      if (elapsed < minDurationMs) {
        animId = requestAnimationFrame(tick);
      } else {
        setIsFadingOut(true);
        setTimeout(() => {
          if (onComplete) onComplete();
        }, 300);
      }
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [minDurationMs, onComplete]);

  // Normalized progress calculations for thin, smaller strokes
  // Left and Right incoming leads: drawn from 0% to 32%
  const leadProgress = Math.min(1, Math.max(0, progress / 32));
  const leadDashOffset = 100 * (1 - leadProgress);

  // Heart contour: drawn from 20% to 62%
  const heartProgress = Math.min(1, Math.max(0, (progress - 20) / 42));
  const heartDashOffset = 100 * (1 - heartProgress);

  // Central pulse line: sweeps across from 28% to 65%
  const pulseProgress = Math.min(1, Math.max(0, (progress - 28) / 37));
  const pulseDashOffset = 100 * (1 - pulseProgress);

  return (
    <div
      onClick={handleDismiss}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-[#F8FAFC] transition-opacity duration-350 ease-out select-none cursor-pointer ${
        isFadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
      aria-label="ReferralOS preloader"
      role="progressbar"
      aria-valuenow={Math.round(progress)}
    >
      {/* Subtle Ambient Blue Radial Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,132,199,0.04)_0%,rgba(248,250,252,0.98)_65%)] pointer-events-none" />

      {/* Small, Compact Container with Hairline Thin Vector Stroke */}
      <div
        className={`relative flex items-center justify-center w-24 h-14 pointer-events-none transition-transform duration-350 ease-out ${
          isSynchronized ? 'scale-105' : 'scale-100'
        }`}
      >
        <svg
          className="w-full h-full"
          viewBox="-10 0 44 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* 1. Thin Left Incoming Signal */}
          <path
            d="M -10 13 L 3.22 13"
            stroke="#0284C7"
            strokeWidth="0.65"
            strokeLinecap="round"
            pathLength={100}
            className={`transition-opacity duration-400 ${isSynchronized ? 'opacity-0' : 'opacity-80'}`}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: leadDashOffset,
            }}
          />

          {/* 2. Thin Right Incoming Signal */}
          <path
            d="M 34 13 L 20.77 13"
            stroke="#0284C7"
            strokeWidth="0.65"
            strokeLinecap="round"
            pathLength={100}
            className={`transition-opacity duration-400 ${isSynchronized ? 'opacity-0' : 'opacity-80'}`}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: leadDashOffset,
            }}
          />

          {/* 3. Thin ReferralOS Logo Heart Contour (Forming & Synchronizing) */}
          <path
            d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
            stroke="#0284C7"
            strokeWidth="0.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: heartDashOffset,
            }}
          />

          {/* 4. Thin ReferralOS Logo Central ECG Pulse Line */}
          <path
            d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"
            stroke="#0284C7"
            strokeWidth="0.65"
            strokeLinecap="round"
            strokeLinejoin="round"
            pathLength={100}
            style={{
              strokeDasharray: 100,
              strokeDashoffset: pulseDashOffset,
            }}
          />
        </svg>
      </div>
    </div>
  );
}
