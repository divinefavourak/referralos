'use client';

import React, { useState, useEffect } from 'react';
import { Header, ActiveTab } from '@/src/components/Header';
import { IntakeForm } from '@/src/components/referral/IntakeForm';
import { HospitalDashboard } from '@/src/components/hospital/HospitalDashboard';
import { AmbulanceTerminal } from '@/src/components/transport/AmbulanceTerminal';
import { RegionalCommand } from '@/src/components/network/RegionalCommand';
import { HeartPreloader } from '@/src/components/common/HeartPreloader';
import {
  ArrowRight,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import { playSuccessChime } from '@/src/lib/audio';

export default function Home() {
  const [showPreloader, setShowPreloader] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        return sessionStorage.getItem('referralos_preloader_seen') !== 'true';
      } catch {}
    }
    return true;
  });
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedTab = sessionStorage.getItem('referralos_stage') as ActiveTab | null;
        if (savedTab && ['intake', 'hospital', 'ambulance', 'regional'].includes(savedTab)) {
          return savedTab;
        }
      } catch {}
    }
    return 'intake';
  });
  const [isCompromised, setIsCompromised] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = sessionStorage.getItem('referralos_compromised');
        if (saved !== null) return saved === 'true';
      } catch {}
    }
    return false;
  });
  const [isResetting, setIsResetting] = useState<boolean>(false);
  const [notificationToast, setNotificationToast] = useState<{
    message: string;
    actionLabel?: string;
    targetTab?: ActiveTab;
    type: 'success' | 'alert' | 'info';
  } | null>(null);

  // Persist stage changes to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('referralos_stage', activeTab);
    } catch {}
  }, [activeTab]);

  // Persist outage/compromised status to session storage
  useEffect(() => {
    try {
      sessionStorage.setItem('referralos_compromised', String(isCompromised));
    } catch {}
  }, [isCompromised]);

  const handleReferralDispatched = (
    referralId: string,
    facilityId: string,
    reservationId: string
  ) => {
    void referralId;
    void reservationId;
    setActiveTab('hospital');
    setNotificationToast({
      message: `Stage 1 Complete: Emergency referral dispatched! 45-minute reservation confirmed at Hospital B. Now viewing receiving ER desk.`,
      actionLabel: 'Proceed to Ambulance Transit (Stage 3)',
      targetTab: 'ambulance',
      type: 'success',
    });
  };

  const handleFacilityCompromised = (facilityId: string, resourceId: string) => {
    void facilityId;
    void resourceId;
    setIsCompromised(true);
    setActiveTab('ambulance');
    setNotificationToast({
      message: `Emergency Outage at Hospital B: Ambulance Unit 04 rerouted to Hospital C in real time! Now viewing ambulance cockpit.`,
      actionLabel: 'View Ambulance Telematics',
      targetTab: 'ambulance',
      type: 'alert',
    });
  };

  const handleStepChange = (stepIndex: number) => {
    if (stepIndex === 0 || stepIndex === 1) {
      setIsCompromised(false);
    } else if (stepIndex === 4 || stepIndex === 5) {
      setIsCompromised(true);
    }
  };

  const handlePreloaderComplete = () => {
    setShowPreloader(false);
    try {
      sessionStorage.setItem('referralos_preloader_seen', 'true');
    } catch {}
  };

  const handleResetDemo = () => {
    try {
      sessionStorage.removeItem('referralos_stage');
      sessionStorage.removeItem('referralos_compromised');
      sessionStorage.removeItem('referralos_preloader_seen');
    } catch {}
    setIsResetting(true);
    setIsCompromised(false);
    setActiveTab('intake');
    setNotificationToast(null);
    setShowPreloader(true);
    playSuccessChime();
    setTimeout(() => {
      setIsResetting(false);
    }, 600);
  };

  const LIFECYCLE_STAGES: {
    id: ActiveTab;
    number: number;
    title: string;
    role: string;
    facility: string;
    action: string;
  }[] = [
    {
      id: 'intake',
      number: 1,
      title: 'Clinic Intake',
      role: 'Attending Midwife',
      facility: "St. Mary's PHC",
      action: 'Shock Triage & Capacity Match',
    },
    {
      id: 'hospital',
      number: 2,
      title: 'Hospital ER Desk',
      role: 'ER Triage Team',
      facility: 'Regional Specialist (Hosp B)',
      action: '45-Min Theatre & Blood Hold',
    },
    {
      id: 'ambulance',
      number: 3,
      title: 'Ambulance Crew',
      role: 'ALS Paramedic Crew',
      facility: 'Unit 04 En-Route',
      action: 'Live Telemetry & Auto-Reroute',
    },
    {
      id: 'regional',
      number: 4,
      title: 'Case Study Replay',
      role: 'District Command',
      facility: 'Golden Hour (43 Min)',
      action: 'Safe Handover & Governance Log',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] text-slate-900">
      {/* Heart Forming & Synchronizing Preloader */}
      {showPreloader && (
        <HeartPreloader onComplete={handlePreloaderComplete} />
      )}

      {/* Top Clinical Header */}
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onResetDemo={handleResetDemo}
        isResetting={isResetting}
      />

      {/* Action Notification Toast */}
      {notificationToast && (
        <div
          className={`border-b px-4 py-2.5 transition-all shadow-2xs ${
            notificationToast.type === 'alert'
              ? 'border-amber-200 bg-amber-50 text-amber-950'
              : 'border-emerald-200 bg-emerald-50 text-emerald-950'
          }`}
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 text-xs font-semibold">
            <div className="flex items-center gap-2.5">
              {notificationToast.type === 'alert' ? (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-600 text-white shrink-0">
                  <AlertCircle className="h-3.5 w-3.5" />
                </div>
              ) : (
                <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
              )}
              <span>{notificationToast.message}</span>
            </div>

            {notificationToast.actionLabel && notificationToast.targetTab && (
              <button
                onClick={() => {
                  if (notificationToast.targetTab) setActiveTab(notificationToast.targetTab);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#0284C7] px-3.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#0369A1] transition-all shrink-0 shadow-xs active:scale-95"
              >
                <span>{notificationToast.actionLabel}</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {/* Interactive Emergency Transfer Lifecycle Pipeline */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-transparent px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#0284C7] border border-sky-100">
                  <span>Interactive Clinical Transfer Pipeline</span>
                </span>
                <span className="text-xs font-bold text-slate-700">Patient: Amara Okoro (28, PPH)</span>
              </div>
              <h1 className="mt-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900">
                End-to-End Emergency Transfer Coordination in 4 Guided Stages
              </h1>
              <p className="mt-1 text-xs text-slate-600 font-medium">
                Click any stage below or step through sequentially to see how capability verification prevents the nearest-hospital trap.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setActiveTab('regional')}
                className="flex items-center gap-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-xs active:scale-95"
              >
                <span>Play 43-Min Story Replay ▶</span>
              </button>
            </div>
          </div>

          {/* 4 Interactive Stage Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {LIFECYCLE_STAGES.map((stg) => {
              const isActive = activeTab === stg.id;
              return (
                <button
                  key={stg.id}
                  onClick={() => setActiveTab(stg.id)}
                  className={`flex flex-col text-left rounded-xl p-3.5 transition-all border relative ${
                    isActive
                      ? 'border-2 border-[#0284C7] bg-sky-50/70 shadow-xs ring-1 ring-sky-500/20'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                        isActive
                          ? 'bg-[#0284C7] text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {stg.number}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-sky-200 text-sky-900'
                          : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isActive ? 'Current Stage' : 'Stage ' + stg.number}
                    </span>
                  </div>

                  <h3 className="text-xs font-bold text-slate-900">{stg.title}</h3>
                  <p className="text-[11px] font-medium text-slate-500 mt-0.5">{stg.facility}</p>
                  <div className="mt-2 pt-2 border-t border-slate-100 text-[11px] text-slate-700 font-semibold line-clamp-1">
                    {stg.action}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Views */}
        <div className="transition-all duration-200">
          {activeTab === 'intake' && (
            <IntakeForm onReferralDispatched={handleReferralDispatched} />
          )}

          {activeTab === 'hospital' && (
            <HospitalDashboard
              onFacilityCompromised={handleFacilityCompromised}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'ambulance' && (
            <AmbulanceTerminal
              isCompromised={isCompromised}
              onRerouteAcknowledged={() => setIsCompromised(false)}
              onNavigateTab={setActiveTab}
            />
          )}

          {activeTab === 'regional' && (
            <RegionalCommand
              onStepChange={handleStepChange}
              onSimulateOutage={() => setIsCompromised(true)}
              onNavigateTab={setActiveTab}
            />
          )}
        </div>
      </main>

      {/* Clean Human Footer */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium">
            <strong className="text-slate-900 font-bold">ReferralOS</strong> — Clinical Emergency Referral & Regional Capacity Coordination System.
          </p>
          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-600" />
              Verified Clinical Pathways
            </span>
            <span>•</span>
            <span className="text-slate-900">Zero Avoidable Transit Delay</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
