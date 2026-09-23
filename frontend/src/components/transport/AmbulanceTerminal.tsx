'use client';

import React, { useState, useEffect } from 'react';
import {
  Ambulance,
  Navigation,
  Activity,
  AlertTriangle,
  QrCode,
  Compass,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { playEmergencySiren, playSuccessChime } from '@/src/lib/audio';

interface AmbulanceTerminalProps {
  isCompromised?: boolean;
  onRerouteAcknowledged?: () => void;
  onNavigateTab?: (tab: 'intake' | 'hospital' | 'ambulance' | 'regional') => void;
}

export type TransitWaypoint = 'origin' | 'mid_transit' | 'rerouted' | 'arrived';

export function AmbulanceTerminal({
  isCompromised = false,
  onRerouteAcknowledged,
  onNavigateTab,
}: AmbulanceTerminalProps) {
  const [waypoint, setWaypoint] = useState<TransitWaypoint>('mid_transit');
  const [alarmAcknowledged, setAlarmAcknowledged] = useState<boolean>(false);

  const isRerouted = (isCompromised && !alarmAcknowledged) || waypoint === 'rerouted';
  const effectiveWaypoint: TransitWaypoint = isRerouted ? 'rerouted' : waypoint;
  const showRerouteAlarm = isRerouted && !alarmAcknowledged;

  const destinationName =
    effectiveWaypoint === 'rerouted' || effectiveWaypoint === 'arrived'
      ? 'Hospital C (University Teaching Hospital)'
      : 'Hospital B (Regional Specialist)';

  const speedKmh =
    effectiveWaypoint === 'origin'
      ? 45
      : effectiveWaypoint === 'mid_transit'
      ? 68
      : effectiveWaypoint === 'rerouted'
      ? 72
      : 0;

  const etaMinutes =
    effectiveWaypoint === 'origin'
      ? 38
      : effectiveWaypoint === 'mid_transit'
      ? 16
      : effectiveWaypoint === 'rerouted'
      ? 19
      : 0;

  useEffect(() => {
    if (isCompromised && !alarmAcknowledged) {
      playEmergencySiren(4.0);
    }
  }, [isCompromised, alarmAcknowledged]);

  const handleSelectWaypoint = (wp: TransitWaypoint) => {
    setWaypoint(wp);
    if (wp === 'rerouted') {
      setAlarmAcknowledged(false);
      playEmergencySiren(3.5);
    } else if (wp === 'arrived') {
      playSuccessChime();
    }
  };

  const handleDismissRerouteAlarm = () => {
    setAlarmAcknowledged(true);
    if (onRerouteAcknowledged) onRerouteAcknowledged();
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Persona Role & Scenario Context Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shrink-0 shadow-sm shadow-sky-600/20">
            <Ambulance className="h-5 w-5" stroke='#0284C7' />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-950">
                Stage 3 of 4
              </span>
              <span className="text-xs font-bold text-slate-900">ALS Unit 04 • Driver Samuel &amp; Paramedic Kelechi</span>
            </div>
            <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
              Transporting <strong>Amara Okoro</strong> with continuous live vital telemetry. <br />If the destination hospital suffers a capacity failure, the navigation console automatically redirects without phone delays.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleSelectWaypoint('rerouted')}
            className="flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs active:scale-95"
          >
            <span>Test In-Transit Rerouting</span>
          </button>
        </div>
      </div>

      {/* Reroute Warning Banner */}
      {showRerouteAlarm && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl text-white shrink-0 shadow-sm shadow-rose-600/20">
                <AlertTriangle className="h-5 w-5" stroke='#EC003F' />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Reroute Notice
                  </span>
                  <span className="text-xs font-semibold text-rose-900">
                    Hospital Capacity Invalidation Detected
                  </span>
                </div>
                <h3 className="mt-1 text-base font-bold text-slate-900 sm:text-lg">
                  Hospital B Operating Theatre Closed
                </h3>
                <p className="text-xs text-slate-700 mt-0.5 font-medium leading-relaxed">
                  Hospital B reported an urgent electrical failure. Ambulance is being redirected to{' '}
                  <strong className="text-rose-700 font-bold">Hospital C (19 minutes away)</strong>. A resuscitation bay and 2 units of blood have already been secured at Hospital C.
                </p>
              </div>
            </div>

            <button
              onClick={handleDismissRerouteAlarm}
              className="w-full sm:w-auto shrink-0 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-rose-700 transition-all shadow-sm shadow-rose-600/25 active:scale-95"
            >
              Confirm New Route
            </button>
          </div>
        </div>
      )}

      {/* Cockpit HUD Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shadow-sm shadow-sky-600/20">
            <Ambulance className="h-5 w-5" stroke='#0284C7' />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-900">AMBULANCE UNIT 04 (ADVANCED LIFE SUPPORT)</h2>
              <span className="rounded-full bg-transparent px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                IN TRANSIT
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Driver: Samuel Ojo • Paramedic: Kelechi Nwosu • Patient: Amara Okoro
            </p>
          </div>
        </div>

        {/* Transit Stage Selector */}
        <div className="flex items-center gap-1.5 rounded-xl bg-slate-100 p-1 border border-slate-200/80">
          <span className="text-[10px] font-bold text-slate-500 uppercase px-2">Stage:</span>
          <button
            onClick={() => handleSelectWaypoint('origin')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              effectiveWaypoint === 'origin'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Origin
          </button>
          <button
            onClick={() => handleSelectWaypoint('mid_transit')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              effectiveWaypoint === 'mid_transit'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            En-Route
          </button>
          <button
            onClick={() => handleSelectWaypoint('rerouted')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              effectiveWaypoint === 'rerouted'
                ? 'bg-rose-600 text-white shadow-xs shadow-rose-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Reroute
          </button>
          <button
            onClick={() => handleSelectWaypoint('arrived')}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
              effectiveWaypoint === 'arrived'
                ? 'bg-emerald-600 text-white shadow-xs shadow-emerald-600/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
            }`}
          >
            Arrived
          </button>
        </div>
      </div>

      {/* Main Grid: Vector Map & Telematics HUD */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Vector Route Map (8 cols) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-8 relative overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0284C7]">
                <Navigation className="h-4 w-4" />
              </div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Live Geospatial Corridor & Destination Map
              </h3>
            </div>
          </div>

          {/* Interactive SVG Regional Map Canvas */}
          <div className="relative h-80 w-full rounded-xl bg-slate-50/80 border border-slate-200 p-4 flex flex-col justify-between overflow-hidden">
            {/* SVG Visual Map */}
            <svg
              className="absolute inset-0 h-full w-full pointer-events-none"
              viewBox="0 0 800 400"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Route St. Mary's to Hospital A (Closed) */}
              <line
                x1="180"
                y1="320"
                x2="280"
                y2="200"
                stroke="#DC2626"
                strokeWidth="2"
                strokeDasharray="4 4"
                opacity="0.3"
              />

              {/* Route St. Mary's to Hospital B (Initial) */}
              <line
                x1="180"
                y1="320"
                x2="320"
                y2="70"
                stroke="#0284C7"
                strokeWidth={effectiveWaypoint === 'rerouted' ? 2 : 3}
                strokeDasharray={effectiveWaypoint === 'rerouted' ? '4 4' : 'none'}
                opacity={effectiveWaypoint === 'rerouted' ? 0.25 : 0.9}
              />

              {/* Reroute to Hospital C */}
              {(effectiveWaypoint === 'rerouted' || effectiveWaypoint === 'arrived') && (
                <path
                  d="M 270 170 Q 420 220 620 280"
                  stroke="#DC2626"
                  strokeWidth="3.5"
                  fill="none"
                />
              )}

              {/* St. Mary's PHC (Origin) */}
              <g transform="translate(180, 320)">
                <circle r="6" fill="#0F172A" />
                <text x="12" y="4" fill="#0F172A" fontSize="12" fontWeight="bold">
                  St. Mary&apos;s PHC (Origin)
                </text>
              </g>

              {/* Hospital A (District General - Closed) */}
              <g transform="translate(280, 200)">
                <circle r="6" fill="#DC2626" opacity="0.8" />
                <text x="12" y="-4" fill="#DC2626" fontSize="11" fontWeight="bold">
                  Hospital A (Closed: Theatres Offline)
                </text>
                <text x="12" y="10" fill="#64748B" fontSize="10">
                  12 km away
                </text>
              </g>

              {/* Hospital B (Specialist) */}
              <g transform="translate(320, 70)">
                <circle
                  r="7"
                  fill={effectiveWaypoint === 'rerouted' ? '#94A3B8' : '#0284C7'}
                />
                <text
                  x="14"
                  y="2"
                  fill={effectiveWaypoint === 'rerouted' ? '#64748B' : '#0F172A'}
                  fontSize="12"
                  fontWeight="bold"
                >
                  Hospital B (Specialist Hospital)
                </text>
                <text x="14" y="16" fill="#64748B" fontSize="10">
                  {effectiveWaypoint === 'rerouted' ? 'Hold Released' : '38 min • Reserved'}
                </text>
              </g>

              {/* Hospital C (Teaching Hospital) */}
              <g transform="translate(620, 280)">
                <circle
                  r="7"
                  fill={effectiveWaypoint === 'rerouted' ? '#059669' : '#0284C7'}
                />
                <text x="14" y="2" fill="#0F172A" fontSize="12" fontWeight="bold">
                  Hospital C (Teaching Hospital)
                </text>
                <text x="14" y="16" fill="#64748B" fontSize="10">
                  {effectiveWaypoint === 'rerouted' ? 'New Destination (19 min)' : 'Backup Hospital'}
                </text>
              </g>

              {/* Vehicle Position */}
              <g
                transform={
                  effectiveWaypoint === 'origin'
                    ? 'translate(180, 320)'
                    : effectiveWaypoint === 'mid_transit'
                    ? 'translate(270, 170)'
                    : effectiveWaypoint === 'rerouted'
                    ? 'translate(440, 225)'
                    : 'translate(620, 280)'
                }
                className="transition-all duration-700 ease-in-out"
              >
                <circle
                  r="14"
                  fill={effectiveWaypoint === 'rerouted' ? '#DC2626' : '#0284C7'}
                  opacity="0.25"
                />
                <circle
                  r="7"
                  fill={effectiveWaypoint === 'rerouted' ? '#DC2626' : '#0284C7'}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />
              </g>
            </svg>

            {/* In-Map Telemetry Banner */}
            <div className="z-10 mt-auto flex flex-wrap items-center justify-between rounded-xl bg-white/95 backdrop-blur-sm p-3.5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-3">
                <Compass className="h-5 w-5 text-[#0284C7]" />
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold">
                    Active Destination
                  </span>
                  <p className="text-xs font-bold text-slate-900 leading-tight">
                    {destinationName}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-semibold">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Speed</span>
                  <p className="text-sm font-bold text-slate-900">{speedKmh} km/h</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase">Estimated Time</span>
                  <p className={`text-sm font-bold ${effectiveWaypoint === 'rerouted' ? 'text-rose-600' : 'text-[#0284C7]'}`}>
                    {etaMinutes} Min
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Streaming Vitals & Handover Code (4 cols) */}
        <div className="space-y-6 lg:col-span-4">
          {/* Patient Vitals Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0284C7]">
                  <Activity className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  En-Route Vitals Monitor
                </h3>
              </div>
              <span className="rounded-full bg-transparent px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                STREAMING
              </span>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-200/80">
                <span className="text-xs text-slate-600 font-medium">Blood Pressure</span>
                <span className="text-sm font-bold text-rose-600 font-mono">
                  {effectiveWaypoint === 'rerouted' || effectiveWaypoint === 'arrived' ? '82/48' : '76/44'} mmHg
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-200/80">
                <span className="text-xs text-slate-600 font-medium">Heart Rate</span>
                <span className="text-sm font-bold text-rose-600 font-mono">
                  {effectiveWaypoint === 'rerouted' || effectiveWaypoint === 'arrived' ? '128' : '136'} bpm
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-200/80">
                <span className="text-xs text-slate-600 font-medium">Oxygen Saturation</span>
                <span className="text-sm font-bold text-emerald-600 font-mono">
                  {effectiveWaypoint === 'rerouted' || effectiveWaypoint === 'arrived' ? '95%' : '92%'}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-slate-50/80 p-3 border border-slate-200/80">
                <span className="text-xs text-slate-600 font-medium">Shock Index</span>
                <span className="text-sm font-bold text-rose-600 font-mono">
                  {effectiveWaypoint === 'rerouted' || effectiveWaypoint === 'arrived' ? '1.56' : '1.78'}
                </span>
              </div>
            </div>
          </div>

          {/* Handover Code Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs text-center">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1">
              Bedside Handover Confirmation
            </h4>
            <p className="text-xs text-slate-500 mb-3.5 font-medium">
              Give this confirmation PIN to the receiving ER triage team
            </p>
            <div className="mt-3.5">
              <span className="text-[10px] text-slate-400 uppercase font-bold">
                Confirmation PIN
              </span>
              <p className="text-xl font-bold font-mono tracking-widest text-[#0284C7]">
                489201
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Stage Progression Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <button
          onClick={() => onNavigateTab?.('hospital')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Hospital ER Desk (Stage 2)</span>
        </button>

        <div className="text-center">
          <span className="text-[10px] font-bold uppercase text-slate-400">Current Progress</span>
          <p className="text-xs font-bold text-slate-900"> Real-Time Corridor Navigation &amp; Telematics</p>
        </div>

        <button
          onClick={() => onNavigateTab?.('regional')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-95"
        >
          <span>Emergency Case Walkthrough (Stage 4)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
