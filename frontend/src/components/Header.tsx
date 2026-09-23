'use client';

import React, { useEffect, useState } from 'react';
import {
  Volume2,
  VolumeX,
  RefreshCw,
  Compass,
  Building2,
  Ambulance,
  Radio,
  HeartPulse,
} from 'lucide-react';
import { api } from '@/src/lib/api';
import { getAudioMuted, setAudioMuted, playSuccessChime } from '@/src/lib/audio';

export type ActiveTab = 'intake' | 'hospital' | 'ambulance' | 'regional';

interface HeaderProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onResetDemo: () => void;
  isResetting?: boolean;
}

export function Header({
  activeTab,
  onSelectTab,
  onResetDemo,
  isResetting = false,
}: HeaderProps) {
  const [backendHealthy, setBackendHealthy] = useState<boolean | null>(null);
  const [audioMuted, setMutedState] = useState<boolean>(() => getAudioMuted());

  useEffect(() => {
    const check = async () => {
      const h = await api.checkHealth();
      setBackendHealthy(h.ok);
    };

    check();
    const healthTimer = setInterval(check, 15000);

    return () => {
      clearInterval(healthTimer);
    };
  }, []);

  const toggleAudio = () => {
    const next = !audioMuted;
    setAudioMuted(next);
    setMutedState(next);
    if (!next) {
      playSuccessChime();
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md px-4 py-3 sm:px-6 transition-colors shadow-xs">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
        {/* Brand & System Title */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl  text-white">
            <HeartPulse className="h-8 w-8" stroke='#0284C7'/>
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-slate-900 font-sans">
                Referral<span className="text-[#0284C7] font-serif font-light">OS</span>
              </span>
             
            </div>
            <p className="hidden text-xs text-slate-500 sm:block font-medium">
              Emergency Clinical Coordination
            </p>
          </div>
        </div>

        {/* Clinical Persona Segmented Tabs */}
        <nav className="hidden md:flex items-center rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <button
            onClick={() => onSelectTab('intake')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'intake'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-[#0284C7]">1</span>
            <Compass className="h-3.5 w-3.5 text-[#0284C7]" />
            <span>Clinic Intake</span>
          </button>

          <span className="text-slate-300 px-1 text-xs select-none">→</span>

          <button
            onClick={() => onSelectTab('hospital')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'hospital'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-[#0284C7]">2</span>
            <Building2 className="h-3.5 w-3.5 text-[#0284C7]" />
            <span>Hospital ER</span>
          </button>

          <span className="text-slate-300 px-1 text-xs select-none">→</span>

          <button
            onClick={() => onSelectTab('ambulance')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'ambulance'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-sky-100 text-[10px] font-bold text-[#0284C7]">3</span>
            <Ambulance className="h-3.5 w-3.5 text-[#0284C7]" />
            <span>Ambulance Crew</span>
          </button>

          <span className="text-slate-300 px-1 text-xs select-none">→</span>

          <button
            onClick={() => onSelectTab('regional')}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              activeTab === 'regional'
                ? 'bg-[#0284C7] text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded-full ${activeTab === 'regional' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'} text-[10px] font-bold`}>4</span>
            <Radio className="h-3.5 w-3.5" />
            <span>Case Study</span>
          </button>
        </nav>

        {/* Status Indicators & Controls */}
        <div className="flex items-center gap-2.5">
          {/* Audio Alert Toggle */}
          <button
            onClick={toggleAudio}
            title={audioMuted ? 'Alert Sounds Muted' : 'Alert Sounds Active'}
            className={`flex h-9 w-9 items-center justify-center rounded-xl border transition-all ${
              audioMuted
                ? 'border-slate-200 bg-white text-slate-400 hover:text-slate-700'
                : 'border-sky-200 bg-sky-50 text-[#0284C7] hover:bg-sky-100'
            }`}
          >
            {audioMuted ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>

          {/* Hospital Network Status Badge */}
          <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs md:flex shadow-2xs">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                backendHealthy === true
                  ? 'bg-emerald-500 ring-1/2 ring-emerald-500/20'
                  : backendHealthy === false
                  ? 'bg-red-500 ring-1 ring-red-500/20'
                  : 'bg-amber-400 ring-1 ring-amber-400/20 animate-pulse'
              }`}
            />
            <span className="text-[11px] font-semibold text-slate-700">
              {backendHealthy === true ? '4 Hospitals Connected' : 'Connecting Network'}
            </span>
          </div>

          {/* Reset Demo State Button */}
          <button
            onClick={onResetDemo}
            disabled={isResetting}
            title="Reset data to initial state"
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${isResetting ? 'animate-spin text-[#0284C7]' : ''}`}
            />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>
    </header>
  );
}
