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

  // Normalized progress calculations for thin, smaller strokes (in local 24x24 units)
  // Left and Right incoming leads (length ~16 units): drawn from 0% to 30%
  const leadProgress = Math.min(1, Math.max(0, progress / 30));
  const leadDashOffset = Math.max(0, 16 - leadProgress * 16);

  // Heart contour (length ~60 units): drawn from 24% to 60%
  const heartProgress = Math.min(1, Math.max(0, (progress - 24) / 36));
  const heartDashOffset = Math.max(0, 60 - heartProgress * 60);

  // Central pulse line (length ~24 units): sweeps across from 32% to 62%
  const pulseProgress = Math.min(1, Math.max(0, (progress - 32) / 30));
  const pulseDashOffset = Math.max(0, 24 - pulseProgress * 24);

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
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(2,132,199,0.06)_0%,rgba(248,250,252,0.98)_65%)] pointer-events-none" />

      {/* Compact, Sleek Heart Container - Reduced Size & Thin Line Weight */}
      <div className="relative flex items-center justify-center w-48 h-32 pointer-events-none">
        {/* Delicate Expanding Shockwave Auras in Pure Blue */}
        {isSynchronized && (
          <>
            <div className="absolute h-20 w-20 rounded-full bg-sky-500/10 animate-ping" />
            <div className="absolute h-28 w-28 rounded-full border border-sky-400/25 animate-pulse" />
          </>
        )}

        <svg
          className={`w-full h-full transition-transform duration-400 ease-out ${
            isSynchronized ? 'scale-105' : 'scale-100'
          }`}
          viewBox="0 0 140 90"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Soft Glow Filter for Fine Lines */}
            <filter id="thinBlueGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="1.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Subtle Gradient for Incoming Leads */}
            <linearGradient id="leadGradLeft" x1="-12" y1="13" x2="3.22" y2="13" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
            <linearGradient id="leadGradRight" x1="36" y1="13" x2="20.27" y2="13" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#38BDF8" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#0284C7" />
            </linearGradient>
          </defs>

          {/* Centered 2.2x Scale Group for Small & Thin ReferralOS Logo */}
          <g transform="translate(43.6, 18.6) scale(2.2)">
            {/* ========================================================================= */}
            {/* 1. Translucent Heart Core - Illuminates in subtle blue on synchronization */}
            {/* ========================================================================= */}
            <path
              d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
              fill="#0284C7"
              fillOpacity={isSynchronized ? '0.08' : '0'}
              className="transition-all duration-500 ease-out"
            />

            {/* ========================================================================= */}
            {/* 2. Thin Incoming Horizontal Signals from Left and Right                  */}
            {/* ========================================================================= */}
            {/* Left Signal */}
            <g className={`transition-opacity duration-400 ${isSynchronized ? 'opacity-25' : 'opacity-100'}`}>
              <path
                d="M -12 13 L 3.22 13"
                stroke="url(#leadGradLeft)"
                strokeWidth="0.8"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 16,
                  strokeDashoffset: leadDashOffset,
                }}
              />
              {progress < 30 && (
                <circle
                  cx={-12 + leadProgress * 15.22}
                  cy={13}
                  r="0.9"
                  fill="#38BDF8"
                />
              )}
            </g>

            {/* Right Signal */}
            <g className={`transition-opacity duration-400 ${isSynchronized ? 'opacity-25' : 'opacity-100'}`}>
              <path
                d="M 36 13 L 20.27 13"
                stroke="url(#leadGradRight)"
                strokeWidth="0.8"
                strokeLinecap="round"
                style={{
                  strokeDasharray: 16,
                  strokeDashoffset: leadDashOffset,
                }}
              />
              {progress < 30 && (
                <circle
                  cx={36 - leadProgress * 15.73}
                  cy={13}
                  r="0.9"
                  fill="#38BDF8"
                />
              )}
            </g>

            {/* ========================================================================= */}
            {/* 3. Thin ReferralOS Logo Heart Contour (Forming & Synchronizing)           */}
            {/* ========================================================================= */}
            <g filter="url(#thinBlueGlow)">
              <path
                d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
                stroke="#0284C7"
                strokeWidth="0.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{
                  strokeDasharray: 60,
                  strokeDashoffset: heartDashOffset,
                }}
              />
            </g>

            {/* ========================================================================= */}
            {/* 4. Thin ReferralOS Logo Central ECG Pulse Line                           */}
            {/* ========================================================================= */}
            <g filter="url(#thinBlueGlow)">
              <path
                d="M3.22 13H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27"
                stroke="#0284C7"
                strokeWidth="0.85"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                style={{
                  strokeDasharray: 24,
                  strokeDashoffset: pulseDashOffset,
                }}
              />
            </g>

            {/* ========================================================================= */}
            {/* 5. Delicate Synchronization Sparks in Pure Blue                          */}
            {/* ========================================================================= */}
            {isSynchronized && (
              <>
                {/* Top Cleft Spark */}
                <circle
                  cx="12"
                  cy="5.8"
                  r="1.1"
                  fill="#38BDF8"
                  className="animate-ping"
                />
                <circle
                  cx="12"
                  cy="5.8"
                  r="0.8"
                  fill="#0284C7"
                />

                {/* Bottom Apex Spark */}
                <circle
                  cx="12"
                  cy="20.3"
                  r="1.1"
                  fill="#38BDF8"
                  className="animate-ping"
                />
                <circle
                  cx="12"
                  cy="20.3"
                  r="0.8"
                  fill="#0284C7"
                />

                {/* Central Systolic Peak Spark */}
                <circle
                  cx="14"
                  cy="9.5"
                  r="0.9"
                  fill="#38BDF8"
                  className="animate-pulse"
                />
              </>
            )}

            {/* ========================================================================= */}
            {/* 6. Synchronized Cardiac Heartbeat Pulse Overlay in Pure Blue             */}
            {/* ========================================================================= */}
            {isSynchronized && (
              <path
                d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"
                stroke="#38BDF8"
                strokeWidth="0.6"
                strokeOpacity="0.75"
                fill="none"
                className="animate-pulse"
              />
            )}
          </g>
        </svg>
      </div>
    </div>
  );
}
