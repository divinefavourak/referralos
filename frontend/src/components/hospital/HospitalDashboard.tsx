'use client';

import React, { useState, useEffect } from 'react';
import {
  Building2,
  CheckCircle2,
  Volume2,
  QrCode,
  Droplet,
  Heart,
  Stethoscope,
  Power,
  Zap,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react';
import { CapacityResource, Facility, ResourceStatus } from '@/src/types';
import { api, SEED_FACILITIES } from '@/src/lib/api';
import {
  playEmergencySiren,
  playSuccessChime,
  playWarningBeep,
} from '@/src/lib/audio';

interface HospitalDashboardProps {
  onFacilityCompromised?: (facilityId: string, resourceId: string) => void;
  onNavigateTab?: (tab: 'intake' | 'hospital' | 'ambulance' | 'regional') => void;
}

export function HospitalDashboard({
  onFacilityCompromised,
  onNavigateTab,
}: HospitalDashboardProps) {
  const [selectedFacilityId, setSelectedFacilityId] = useState<string>('fac_hosp_b_specialist');
  const [facilities, setFacilities] = useState<Facility[]>(SEED_FACILITIES);
  const [resources, setResources] = useState<CapacityResource[]>([]);
  const [loadingCapacity, setLoadingCapacity] = useState<boolean>(false);
  const [etaSeconds, setEtaSeconds] = useState<number>(16 * 60);
  const [prepChecklist, setPrepChecklist] = useState({
    theatreScrubbed: true,
    bloodThawed: true,
    specialistPaged: true,
    rapidInfuserReady: false,
  });

  const [handoverModalOpen, setHandoverModalOpen] = useState<boolean>(false);
  const [verificationCode, setVerificationCode] = useState<string>('489201');
  const [handoverVerified, setHandoverVerified] = useState<boolean>(false);
  const [isVerifying, setIsVerifying] = useState<boolean>(false);

  // Load facilities and capacity
  useEffect(() => {
    const load = async () => {
      const facs = await api.getFacilities();
      if (facs.length > 0) setFacilities(facs);
    };
    load();
  }, []);

  useEffect(() => {
    const fetchCap = async () => {
      setLoadingCapacity(true);
      const cap = await api.getFacilityCapacity(selectedFacilityId);
      setResources(cap);
      setLoadingCapacity(false);
    };
    fetchCap();
  }, [selectedFacilityId]);

  // Countdown ETA timer
  useEffect(() => {
    const timer = setInterval(() => {
      setEtaSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatEta = (totalSec: number) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Toggle individual resource status
  const handleToggleResourceStatus = async (res: CapacityResource) => {
    const nextStatus = res.status === 'AVAILABLE' ? 'OFFLINE' : 'AVAILABLE';
    const reason =
      nextStatus === 'OFFLINE'
        ? 'Ventilation system power failure in operating room'
        : undefined;

    setResources((prev) =>
      prev.map((r) => (r.id === res.id ? { ...r, status: nextStatus as ResourceStatus } : r))
    );

    if (nextStatus === 'OFFLINE') {
      playEmergencySiren(2.5);
      if (onFacilityCompromised) {
        onFacilityCompromised(selectedFacilityId, res.id);
      }
    } else {
      playSuccessChime();
    }

    try {
      await api.updateResourceStatus(selectedFacilityId, res.id, nextStatus, reason);
    } catch {
      console.warn('Capacity update fallback applied');
    }
  };

  // Local walk-in preemption trigger
  const handleSimulateWalkInPreemption = async () => {
    playWarningBeep();
    const theatreRes = resources.find((r) => r.resource_type === 'OPERATING_THEATRE');
    if (theatreRes) {
      setResources((prev) =>
        prev.map((r) =>
          r.id === theatreRes.id ? { ...r, status: 'OCCUPIED' as ResourceStatus } : r
        )
      );
      if (onFacilityCompromised) {
        onFacilityCompromised(selectedFacilityId, theatreRes.id);
      }
      await api.overrideResourceForWalkIn(
        selectedFacilityId,
        theatreRes.id,
        'Local critical walk-in patient taken directly to operating theatre'
      );
    }
  };

  const handleVerifyHandover = async () => {
    setIsVerifying(true);
    try {
      await api.updateReferralStatus('ref_01HJ8PQR9988776655443322', 'HANDOVER_COMPLETED', {
        verification_code: verificationCode,
        receiving_clinician_notes: 'Patient received in Trauma Resus Bay. Immediate laparotomy initiated.',
      });
      setHandoverVerified(true);
      playSuccessChime();
      setTimeout(() => {
        setHandoverModalOpen(false);
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Persona Role & Scenario Context Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0284C7] text-white shrink-0 shadow-sm shadow-sky-600/20">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-950">
                Stage 2 of 4 • Receiving Hospital ER Desk
              </span>
              <span className="text-xs font-bold text-slate-900">Regional Specialist Hospital (Hospital B)</span>
            </div>
            <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
              Pre-arrival reservation confirmed for <strong>Amara Okoro</strong>. Operating Theatre 3 &amp; 2 units of O-negative blood are held for 45 minutes. You can also simulate an unexpected power outage to test the automatic reroute.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={handleSimulateWalkInPreemption}
            className="flex items-center gap-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white px-3.5 py-2 text-xs font-bold transition-all shadow-xs active:scale-95"
            title="Simulate Theatre Power Surge to trigger live reroute"
          >
            <Zap className="h-3.5 w-3.5" />
            <span>Simulate Theatre 3 Failure ⚡</span>
          </button>
        </div>
      </div>

      {/* Facility Switcher Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0284C7] text-white shadow-xs">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Hospital Emergency Department Desk
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Manage incoming pre-arrival transfers, live bed reservations, and bedside handovers
            </p>
          </div>
        </div>

        {/* Facility Selector Buttons */}
        <div className="flex flex-wrap gap-2">
          {facilities
            .filter((f) => f.tier !== 'PRIMARY')
            .map((fac) => {
              const isSelected = fac.id === selectedFacilityId;
              return (
                <button
                  key={fac.id}
                  onClick={() => setSelectedFacilityId(fac.id)}
                  className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'border-slate-900 bg-slate-900 text-white shadow-xs'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span>{fac.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-bold ${
                      isSelected
                        ? 'bg-sky-400 text-slate-950'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {fac.tier}
                  </span>
                </button>
              );
            })}
        </div>
      </div>

      {/* Main Grid: Incoming Pre-Arrival Queue & Live Capacity Switchboard */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Incoming Patient Pre-Arrival Alert (6 cols) */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            {/* Top Bar with Siren indicator */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-rose-600 ring-4 ring-rose-500/20 animate-pulse" />
                <span className="text-xs font-bold uppercase tracking-wider text-rose-700">
                  Inbound Emergency Transfer
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => playEmergencySiren(2.5)}
                  title="Test Pre-Arrival Chime"
                  className="flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-bold text-[#0284C7] hover:bg-sky-100 transition-all"
                >
                  <Volume2 className="h-3.5 w-3.5" />
                  <span>Audio Alert</span>
                </button>

                <div className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-mono font-bold text-slate-900 border border-slate-200">
                  ETA {formatEta(etaSeconds)}
                </div>
              </div>
            </div>

            {/* Patient Header Card */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-slate-900">Amara Okoro (28y Female)</h4>
                  <p className="text-xs text-rose-700 font-semibold mt-0.5">
                    Severe Postpartum Haemorrhage (Shock Index: 1.86)
                  </p>
                  <p className="text-xs text-slate-500 mt-1 font-medium">
                    Transfer from St. Mary&apos;s PHC • En-route in Ambulance Unit 04
                  </p>
                </div>
                <span className="rounded-full bg-rose-600 px-3 py-1 text-xs font-bold text-white shadow-xs">
                  CRITICAL
                </span>
              </div>

              {/* Streaming Vitals Grid */}
              <div className="mt-4 grid grid-cols-4 gap-2 rounded-xl bg-white p-3 border border-slate-200 text-center font-mono">
                <div>
                  <span className="text-[10px] uppercase font-medium text-slate-400">BP</span>
                  <p className="text-xs font-bold text-rose-600">74/42</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-medium text-slate-400">HR</span>
                  <p className="text-xs font-bold text-rose-600">138</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-medium text-slate-400">SpO2</span>
                  <p className="text-xs font-bold text-slate-900">91%</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-medium text-slate-400">Shock Index</span>
                  <p className="text-xs font-bold text-rose-600">1.86</p>
                </div>
              </div>

              {/* Locked Resources Reserved */}
              <div className="mt-3.5 rounded-lg bg-sky-50/70 p-3 border border-sky-100">
                <span className="text-xs font-bold uppercase tracking-wider text-sky-900">
                  Guaranteed Resources (45 Min Hold):
                </span>
                <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-800">
                  <span className="rounded-md bg-white px-2 py-0.5 border border-sky-200 font-medium">
                    Resus Room 02
                  </span>
                  <span className="rounded-md bg-white px-2 py-0.5 border border-sky-200 font-medium">
                    Operating Theatre 03
                  </span>
                  <span className="rounded-md bg-white px-2 py-0.5 border border-sky-200 font-bold text-rose-700">
                    2x Units O-Negative PRBC
                  </span>
                  <span className="rounded-md bg-white px-2 py-0.5 border border-sky-200 font-medium">
                    Dr. Alabi (Obstetrician)
                  </span>
                </div>
              </div>
            </div>

            {/* Trauma Team Preparation Checklist */}
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4">
              <h5 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-3">
                Emergency Team Readiness Checklist
              </h5>
              <div className="space-y-2.5">
                <label className="flex items-center gap-3 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepChecklist.theatreScrubbed}
                    onChange={(e) =>
                      setPrepChecklist({ ...prepChecklist, theatreScrubbed: e.target.checked })
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Operating Theatre 03 is scrubbed, sterile and ready</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepChecklist.bloodThawed}
                    onChange={(e) =>
                      setPrepChecklist({ ...prepChecklist, bloodThawed: e.target.checked })
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>2 Units of O-Negative blood released to resuscitation bay</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepChecklist.specialistPaged}
                    onChange={(e) =>
                      setPrepChecklist({ ...prepChecklist, specialistPaged: e.target.checked })
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Attending Obstetrician Dr. Alabi notified on trauma bay arrival</span>
                </label>

                <label className="flex items-center gap-3 text-xs text-slate-700 font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={prepChecklist.rapidInfuserReady}
                    onChange={(e) =>
                      setPrepChecklist({
                        ...prepChecklist,
                        rapidInfuserReady: e.target.checked,
                      })
                    }
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                  />
                  <span>Rapid blood warmer and transfusion kit primed</span>
                </label>
              </div>
            </div>

            {/* Handover Button */}
            <div className="mt-4">
              <button
                onClick={() => setHandoverModalOpen(true)}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-98"
              >
                <QrCode className="h-4 w-4" />
                <span>Confirm Patient Bedside Handover</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Live Capacity Switchboard (6 cols) */}
        <div className="space-y-6 lg:col-span-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Facility Capacity Switchboard
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Update asset availability instantly across the clinical network
                </p>
              </div>

              {/* Walk-in Preemption Override Button */}
              <button
                onClick={handleSimulateWalkInPreemption}
                className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 transition-all"
                title="Simulate sudden local walk-in taking the theatre"
              >
                <Zap className="h-3.5 w-3.5 text-amber-600" />
                <span>Simulate Emergency Walk-In</span>
              </button>
            </div>

            {loadingCapacity ? (
              <div className="flex h-48 items-center justify-center">
                <span className="text-xs text-slate-400 font-semibold">Loading facility status...</span>
              </div>
            ) : (
              <div className="space-y-3">
                {resources.map((res) => {
                  const isAvailable = res.status === 'AVAILABLE';
                  const isOffline = res.status === 'OFFLINE';

                  return (
                    <div
                      key={res.id}
                      className={`flex items-center justify-between rounded-xl border p-3.5 transition-all ${
                        isAvailable
                          ? 'border-slate-200 bg-white hover:border-slate-300'
                          : isOffline
                          ? 'border-rose-200 bg-rose-50/50'
                          : 'border-amber-200 bg-amber-50/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : isOffline
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {res.resource_type === 'OPERATING_THEATRE' ? (
                            <Zap className="h-4 w-4" />
                          ) : res.resource_type === 'BLOOD_STOCK' ? (
                            <Droplet className="h-4 w-4" />
                          ) : res.resource_type === 'BED' ? (
                            <Heart className="h-4 w-4" />
                          ) : (
                            <Stethoscope className="h-4 w-4" />
                          )}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <h5 className="text-xs font-bold text-slate-900">
                              {res.identifier_code}
                            </h5>
                            <span className="text-[11px] text-slate-500 font-medium">
                              ({res.sub_type})
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                            {res.resource_type} • {res.units_in_stock} Units
                          </p>
                        </div>
                      </div>

                      {/* Interactive Status Toggle Switch */}
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase border ${
                            isAvailable
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : isOffline
                              ? 'bg-rose-50 text-rose-800 border-rose-200'
                              : 'bg-amber-50 text-amber-800 border-amber-200'
                          }`}
                        >
                          {res.status}
                        </span>

                        <button
                          onClick={() => handleToggleResourceStatus(res)}
                          title="Toggle availability status"
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-all ${
                            isAvailable
                              ? 'border-slate-200 bg-slate-50 text-slate-600 hover:text-rose-600 hover:border-rose-200'
                              : 'border-emerald-300 bg-emerald-600 text-white hover:bg-emerald-700'
                          }`}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Handover Verification Modal */}
      {handoverModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-sky-50 text-[#0284C7]">
                  <QrCode className="h-4 w-4" />
                </div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Patient Arrival Verification
                </h4>
              </div>
              <button
                onClick={() => setHandoverModalOpen(false)}
                className="text-slate-400 font-bold hover:text-slate-900 transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Ambulance Unit 04 has arrived at the Trauma Bay. Enter the 6-digit confirmation code from the paramedic tablet to confirm bedside transfer:
              </p>

              <div>
                <label className="text-xs font-medium text-slate-600">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 text-center text-xl font-mono font-bold text-slate-900 tracking-widest focus:bg-white focus:border-sky-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setHandoverModalOpen(false)}
                  className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyHandover}
                  disabled={isVerifying}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{isVerifying ? 'Verifying...' : 'Confirm Arrival'}</span>
                </button>
              </div>

              {handoverVerified && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center text-xs font-bold text-emerald-800">
                  Patient Arrival Confirmed & Transferred to Operating Theatre!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Stage Progression Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <button
          onClick={() => onNavigateTab?.('intake')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Previous: Clinic Intake (Stage 1)</span>
        </button>

        <div className="text-center">
          <span className="text-[10px] font-bold uppercase text-slate-400">Current Progress</span>
          <p className="text-xs font-bold text-slate-900">Stage 2: Receiving ER Reservation &amp; Pre-Arrival Hold</p>
        </div>

        <button
          onClick={() => onNavigateTab?.('ambulance')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-95"
        >
          <span>Next: Ambulance Telematics &amp; Transit (Stage 3)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
