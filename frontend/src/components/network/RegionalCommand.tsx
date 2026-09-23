'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radio,
  Play,
  Pause,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  Activity,
  HeartPulse,
  Hospital,
  ArrowLeft,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { Facility } from '@/src/types';
import { api, SEED_FACILITIES } from '@/src/lib/api';
import {
  playEmergencySiren,
  playPreArrivalChime,
  playSuccessChime,
  playWarningBeep,
  playClinicalIntakeBeep,
  playRadioTelemetryChirp,
  speakNarrative,
  ensureAudioResumed,
  getAudioMuted,
  setAudioMuted,
  getVoiceNarration,
  setVoiceNarration,
} from '@/src/lib/audio';

interface RegionalCommandProps {
  onStepChange?: (stepIndex: number) => void;
  onSimulateOutage?: () => void;
  onNavigateTab?: (tab: 'intake' | 'hospital' | 'ambulance' | 'regional') => void;
}

interface ScenarioStep {
  stepNumber: number;
  timecode: string;
  title: string;
  subtitle: string;
  clinicalNarrative: string;
  operationalCoordination: string;
  badge: string;
}

const PPH_STEPS: ScenarioStep[] = [
  {
    stepNumber: 1,
    timecode: '00:00',
    title: 'Emergency Presentation at St. Mary\'s Health Centre',
    subtitle: 'Standardized obstetric intake & critical shock index assessment',
    clinicalNarrative:
      'Amara Okoro (28, Gravida 2 Para 1) delivered a healthy infant 20 minutes ago. Uterine atony develops rapidly, unresponsive to standard oxytocin administration. Estimated blood loss exceeds 1,200 mL. Vitals show acute circulatory collapse: BP 74/42, HR 138 bpm, Shock Index 1.86. Attending midwife Nurse Grace initiates the emergency Obstetric Haemorrhage protocol.',
    operationalCoordination:
      'The referral coordination engine registers the high-acuity referral and immediately packages the necessary life-saving clinical requirements: an emergency resuscitation bay, a sterile surgical operating theatre, an on-duty obstetric surgeon, and 2 units of uncrossed O-negative donor blood.',
    badge: 'Clinical Intake',
  },
  {
    stepNumber: 2,
    timecode: '00:06',
    title: 'Bypassing Inoperable Facilities',
    subtitle: 'Checking real-time readiness & avoiding the nearest-hospital trap',
    clinicalNarrative:
      'District General Hospital is physically closest (12 km away, 18 min drive), but both of its operating theatres are closed for emergency sterilisation following a septic case. Rather than dispatching Amara blindly to a facility that cannot treat her, the system immediately flags District General as unsuitable.',
    operationalCoordination:
      'The network checks live surgical capability across the entire district. Regional Specialist Hospital (38 min away) is confirmed to have Theatre 3 prepped and sterile, specialist Dr. Alabi scrubbed on-call, and 4 verified units of refrigerated O-negative blood in stock.',
    badge: 'Facility Verification',
  },
  {
    stepNumber: 3,
    timecode: '00:07',
    title: 'Pre-Arrival Hospital Reservation',
    subtitle: 'Guaranteed theatre, resuscitation bed, and donor blood hold',
    clinicalNarrative:
      'Nurse Grace confirms the transfer destination. At Regional Specialist Hospital, the emergency department triage display sounds an urgent pre-arrival chime and displays Amara\'s vitals, gestational history, and estimated arrival time.',
    operationalCoordination:
      'A dedicated 45-minute reservation is placed simultaneously across Theatre 3, Resuscitation Bed 02, and 2 units of uncrossed O-negative blood. This guarantees that these vital supplies cannot be reallocated while Amara is in transit.',
    badge: 'Hospital Hold Placed',
  },
  {
    stepNumber: 4,
    timecode: '00:10',
    title: 'Ambulance En Route with Live Telemetry',
    subtitle: 'Continuous vitals transmission along the highway corridor',
    clinicalNarrative:
      'Advanced Life Support Ambulance Unit 04 departs St. Mary\'s Health Centre with paramedic David managing continuous IV fluid resuscitation and high-flow oxygen. Amara\'s heart rate and blood pressure are transmitted in real time directly to the receiving hospital team.',
    operationalCoordination:
      'The receiving trauma team tracks the ambulance\'s live highway progress. As traffic conditions change, Amara\'s estimated time of arrival dynamically updates so the surgical team scrubs in at the exact right moment without standing idle.',
    badge: 'En Route',
  },
  {
    stepNumber: 5,
    timecode: '00:22',
    title: 'Sudden Equipment Failure at Receiving Hospital',
    subtitle: 'Power surge shuts down sterile ventilation at Regional Specialist',
    clinicalNarrative:
      'While Ambulance Unit 04 is 16 minutes from Regional Specialist Hospital, a severe electrical surge damages the sterile airflow unit in Operating Theatre 3. The charge nurse immediately marks Theatre 3 unavailable on the hospital switchboard.',
    operationalCoordination:
      'The facility status update immediately alerts the central coordination network. Amara cannot safely be delivered to a hospital whose surgical theatre has lost positive-pressure airflow.',
    badge: 'Hospital Outage',
  },
  {
    stepNumber: 6,
    timecode: '00:22:30',
    title: 'Immediate In-Transit Rerouting',
    subtitle: 'Dynamic recalculation from moving ambulance without phone delays',
    clinicalNarrative:
      'Instead of forcing the paramedic to pull over and make frantic phone calls, the system recalculates routing alternatives directly from the ambulance\'s current highway position. University Teaching Hospital (Hospital C) has two fully staffed surgical suites and compatible blood available 19 minutes away.',
    operationalCoordination:
      'The previous reservation at Regional Specialist Hospital is released, and an emergency reservation is instantly placed at University Teaching Hospital. The ambulance navigation console sounds an urgent reroute alert and immediately displays updated turn-by-turn directions.',
    badge: 'Ambulance Rerouted',
  },
  {
    stepNumber: 7,
    timecode: '00:43',
    title: 'Safe Bedside Handover in the Golden Hour',
    subtitle: 'Direct transfer to surgical suite without admission delays',
    clinicalNarrative:
      'Ambulance Unit 04 arrives at University Teaching Hospital. The surgical team is already scrubbed at Resuscitation Bay 04 with thawed donor blood ready. The triage nurse scans the paramedic\'s digital handover code, and Amara is wheeled directly into surgery 43 minutes after the initial haemorrhage began.',
    operationalCoordination:
      'The digital handover confirms patient custody, marks the surgical suite as occupied, and closes the emergency transfer ticket with a complete clinical log for hospital governance.',
    badge: 'Patient Admitted',
  },
];

export function RegionalCommand({
  onStepChange,
  onSimulateOutage,
  onNavigateTab,
}: RegionalCommandProps) {
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(true); // Auto-play by default
  const [stepProgress, setStepProgress] = useState<number>(0);
  const [isAudioMuted, setIsAudioMutedState] = useState<boolean>(() => getAudioMuted());
  const [isVoiceEnabled, setIsVoiceEnabledState] = useState<boolean>(() => getVoiceNarration());
  const [facilities, setFacilities] = useState<Facility[]>(SEED_FACILITIES);
  const [eventLogs, setEventLogs] = useState<
    { id: string; event: string; detail: string; time: string }[]
  >([
    {
      id: 'log_1',
      event: 'Intake Registered',
      detail: 'Severe obstetric haemorrhage intake created for Amara Okoro (28) at St. Mary\'s',
      time: '00:00',
    },
    {
      id: 'log_2',
      event: 'Facility Verified',
      detail: 'District General bypassed (theatres closed for decontamination). Regional Specialist verified',
      time: '00:06',
    },
    {
      id: 'log_3',
      event: 'Hospital Hold Placed',
      detail: 'Dedicated 45-min hold secured for Theatre 3 and 2x O- blood at Regional Specialist',
      time: '00:07',
    },
    {
      id: 'log_4',
      event: 'Ambulance En Route',
      detail: 'Ambulance Unit 04 departed St. Mary\'s with live vitals transmission',
      time: '00:10',
    },
  ]);

  const hasMountedRef = useRef<boolean>(false);
  const progressRef = useRef<number>(0);
  const currentStepRef = useRef<number>(currentStepIndex);

  useEffect(() => {
    currentStepRef.current = currentStepIndex;
  }, [currentStepIndex]);

  // Load facilities from backend or fallback seed
  useEffect(() => {
    api.getFacilities().then((f) => {
      if (f.length > 0) setFacilities(f);
    });
  }, []);

  const activeStep = PPH_STEPS[currentStepIndex];

  const handleGoToStep = useCallback((index: number) => {
    setCurrentStepIndex(index);
    currentStepRef.current = index;
    setStepProgress(0);
    progressRef.current = 0;
    if (onStepChange) onStepChange(index);

    // Ensure audio context is running
    ensureAudioResumed();

    // High-impact sound effects for each clinical step
    if (index === 0) playClinicalIntakeBeep();
    if (index === 1) playWarningBeep();
    if (index === 2) playPreArrivalChime();
    if (index === 3) playRadioTelemetryChirp();
    if (index === 4) {
      playWarningBeep();
      if (onSimulateOutage) onSimulateOutage();
    }
    if (index === 5) playEmergencySiren(3.0);
    if (index === 6) playSuccessChime();

    // Spoken voice narration
    const step = PPH_STEPS[index];
    speakNarrative(`${step.badge}: ${step.title}. ${step.subtitle}`);

    // Append to live log with globally unique ID
    const uniqueLogId = `log_${Date.now()}_${Math.random().toString(36).slice(2, 9)}_${index}`;
    setEventLogs((prev) => [
      {
        id: uniqueLogId,
        event: step.badge,
        detail: step.title,
        time: step.timecode,
      },
      ...prev.slice(0, 6),
    ]);
  }, [onStepChange, onSimulateOutage]);

  // Trigger sound and speech on initial auto-play mount
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      handleGoToStep(0);
    }
  }, [handleGoToStep]);

  // Smooth auto-play timer with live progress tracking (6 seconds per step)
  useEffect(() => {
    if (!isPlaying) return;

    const STEP_DURATION_MS = 6200;
    const INTERVAL_MS = 60;
    const progressPerTick = (INTERVAL_MS / STEP_DURATION_MS) * 100;

    const interval = setInterval(() => {
      progressRef.current += progressPerTick;
      if (progressRef.current >= 100) {
        progressRef.current = 0;
        setStepProgress(0);
        if (currentStepRef.current < PPH_STEPS.length - 1) {
          handleGoToStep(currentStepRef.current + 1);
        } else {
          setIsPlaying(false);
        }
      } else {
        setStepProgress(progressRef.current);
      }
    }, INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isPlaying, handleGoToStep]);

  const handleTogglePlay = () => {
    ensureAudioResumed();
    const next = !isPlaying;
    setIsPlaying(next);
    if (next && currentStepIndex === PPH_STEPS.length - 1) {
      handleGoToStep(0);
    }
  };

  const handleReset = () => {
    setIsPlaying(true);
    handleGoToStep(0);
  };

  const toggleSound = () => {
    const next = !isAudioMuted;
    setAudioMuted(next);
    setIsAudioMutedState(next);
    if (!next) {
      ensureAudioResumed();
      playSuccessChime();
    }
  };

  const toggleVoice = () => {
    const next = !isVoiceEnabled;
    setVoiceNarration(next);
    setIsVoiceEnabledState(next);
    if (next) {
      speakNarrative('Voice narration enabled');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Persona Role & Scenario Context Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg text-white shrink-0 shadow-sm shadow-sky-600/20">
            <Radio className="h-5 w-5" stroke='#0284C7' />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sky-200/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-950">
                Stage 4 of 4
              </span>
              <span className="text-xs font-bold text-slate-900">District Healthcare Operations Command</span>
            </div>
            <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
              Step-by-step case study demonstrating how ReferralOS averted the nearest-hospital trap, reserved operating capacity, <br />and successfully rerouted in transit within the 60-minute golden hour.
            </p>
          </div>
        </div>

        <button
          onClick={() => onNavigateTab?.('intake')}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-2xs active:scale-95"
        >
          <RotateCcw className="h-3.5 w-3.5 text-[#0284C7]" />
          <span>Restart From Stage 1</span>
        </button>
      </div>

      {/* Interactive Clinical Case Walkthrough Controller */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-7 shadow-xs relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div className="flex items-center gap-3.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white ">
              <HeartPulse className="h-5 w-5" stroke='#0284C7' />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
                  Emergency Case Walkthrough: Severe Obstetric Haemorrhage
                </h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                  Patient: Amara Okoro (28)
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Demonstrates dynamic facility verification, resource holds, and automated in-transit rerouting
              </p>
            </div>
          </div>

          {/* Stepper Playback & Audio Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Audio Effects Toggle */}
            <button
              onClick={toggleSound}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                !isAudioMuted
                  ? 'border-sky-300 bg-sky-50 text-[#0284C7] shadow-2xs'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-700'
              }`}
              title={!isAudioMuted ? 'Clinical Sound active (click to mute)' : 'Clinical Sound muted (click to unmute)'}
            >
              {!isAudioMuted ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              <span className="hidden sm:inline">{!isAudioMuted ? '' : ''}</span>
            </button>

            {/* Voice Narration Toggle */}
            <button
              onClick={toggleVoice}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-all ${
                isVoiceEnabled
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 shadow-2xs'
                  : 'border-slate-200 bg-slate-50 text-slate-400 hover:text-slate-700'
              }`}
              title={isVoiceEnabled ? 'Voice narration active (click to disable)' : 'Voice narration off (click to enable)'}
            >
              {isVoiceEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
              <span className="hidden sm:inline">{isVoiceEnabled ? '' : ''}</span>
            </button>

            <div className="h-5 w-px bg-slate-200 mx-1 hidden sm:block" />

            <button
              onClick={() => currentStepIndex > 0 && handleGoToStep(currentStepIndex - 1)}
              disabled={currentStepIndex === 0}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-all"
              title="Previous Step"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <button
              onClick={handleTogglePlay}
              className="flex items-center gap-2 rounded-xl bg-[#0284C7] px-4 py-2 text-xs font-bold text-white shadow-sm shadow-sky-600/25 hover:bg-[#0369A1] active:scale-95 transition-all"
            >
              {isPlaying ? (
                <>
                  <Pause className="h-4 w-4" />
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                </>
              )}
            </button>

            <button
              onClick={() =>
                currentStepIndex < PPH_STEPS.length - 1 && handleGoToStep(currentStepIndex + 1)
              }
              disabled={currentStepIndex === PPH_STEPS.length - 1}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-30 transition-all"
              title="Next Step"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={handleReset}
              title="Restart from beginning"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-all ml-1"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Live Step Progress Countdown Bar */}
        <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mb-6 -mt-2">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-[#0284C7] to-sky-400 rounded-lg transition-all duration-75 ease-linear"
            style={{
              width: isPlaying ? `${stepProgress}%` : currentStepIndex === PPH_STEPS.length - 1 ? '100%' : '0%',
            }}
          />
        </div>

        {/* Step Indicator Badges (1 to 7) */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 lg:grid-cols-7 mb-6">
          {PPH_STEPS.map((s, idx) => {
            const isCurrent = currentStepIndex === idx;
            const isCompleted = currentStepIndex > idx;
            return (
              <button
                key={s.stepNumber}
                onClick={() => handleGoToStep(idx)}
                className={`flex flex-col items-start rounded-xl p-3.5 text-left transition-all border ${
                  isCurrent
                    ? 'border-2 border-[#0284C7] bg-sky-50/70 text-slate-900 shadow-xs'
                    : isCompleted
                    ? 'border-emerald-200 bg-emerald-50/60 text-emerald-900'
                    : 'border-slate-200 bg-slate-50/60 text-slate-500 hover:border-slate-300'
                }`}
              >
                <div className="flex w-full items-center justify-between text-[11px]">
                  <span className={`font-bold ${isCurrent ? 'text-[#0284C7]' : isCompleted ? 'text-emerald-700' : 'text-slate-500'}`}>
                    Step {s.stepNumber}
                  </span>
                  <span className="font-semibold text-slate-400">{s.timecode}</span>
                </div>
                <h5 className="mt-1 text-xs font-semibold text-slate-900 line-clamp-2">{s.title}</h5>

                {/* Embedded Mini Progress for Active Step */}
                {isCurrent && isPlaying && (
                  <div className="w-full bg-sky-200/80 rounded-full h-1 mt-2.5 overflow-hidden">
                    <div
                      className="bg-[#0284C7] h-full transition-all duration-75 ease-linear"
                      style={{ width: `${stepProgress}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Step Detailed Clinical & Operational Narrative */}
        <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-5 sm:p-6">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-3.5 mb-4">
            <div className="flex items-center gap-3">
              <span className="text-xs font-bold font-mono text-[#0284C7] bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                {activeStep.timecode}
              </span>
              <h3 className="text-base font-bold text-slate-900">{activeStep.title}</h3>
            </div>
            <span className="rounded-full px-3 py-1 text-xs font-bold bg-transparent text-sky-800 border border-sky-200">
              {activeStep.badge}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Clinical Stakes Narrative */}
            <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-600 flex items-center gap-2 mb-2.5">
                <Activity className="h-4 w-4" />
                <span>Patient Condition & Clinical Actions</span>
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {activeStep.clinicalNarrative}
              </p>
            </div>

            {/* Hospital Coordination & Safeguards */}
            <div className="rounded-xl bg-white p-5 border border-slate-200 shadow-2xs">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center gap-2 mb-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>Hospital Coordination & Safeguards</span>
              </span>
              <p className="text-xs text-slate-700 leading-relaxed font-medium">
                {activeStep.operationalCoordination}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Regional Facilities Grid & Recent Clinical Dispatch Log */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Regional Facilities Grid (8 cols) */}
        <div className="space-y-4 lg:col-span-8">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-[#0284C7]">
                  <Hospital className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Regional Healthcare Network Status
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-semibold">
                4 Connected Facilities Across District
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {facilities.map((fac) => {
                const isHospA = fac.id === 'fac_hosp_a_district';
                const isHospB = fac.id === 'fac_hosp_b_specialist';
                const isHospC = fac.id === 'fac_hosp_c_teaching';

                return (
                  <div
                    key={fac.id}
                    className={`rounded-xl border p-4.5 transition-all ${
                      isHospA
                        ? 'border-rose-200 bg-rose-50/40'
                        : isHospB
                        ? 'border-2 border-[#0284C7] bg-white shadow-xs'
                        : isHospC
                        ? 'border-slate-200 bg-white shadow-xs'
                        : 'border-slate-200 bg-slate-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{fac.name}</h4>
                        <p className="text-[11px] text-slate-500 mt-0.5 font-medium">
                          {fac.facility_code} • {fac.tier} Level
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                          isHospA
                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                            : isHospB
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {isHospA ? 'Theatres Offline' : 'Operational'}
                      </span>
                    </div>

                    <div className="mt-3.5 text-xs text-slate-500 font-medium">
                      <p className="line-clamp-1">{fac.location?.address}</p>
                      <div className="mt-2.5 flex items-center justify-between text-[11px] text-slate-700 pt-2.5 border-t border-slate-100">
                        <span>
                          {fac.occupied_beds} of {fac.total_beds} beds occupied
                        </span>
                        <span className="font-semibold text-slate-900">
                          {isHospA
                            ? 'Surgical bay decontaminating'
                            : isHospB
                            ? 'Theatre 3 available'
                            : isHospC
                            ? 'Full trauma team ready'
                            : 'Clinic triage open'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Clinical Dispatch & Coordination Activity Feed (4 cols) */}
        <div className="space-y-4 lg:col-span-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-700">
                  <Radio className="h-4 w-4" />
                </div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Clinical Coordination Feed
                </h3>
              </div>
            </div>

            <div className="space-y-2.5 text-xs">
              {eventLogs.map((log, idx) => (
                <div
                  key={`${log.id}-${idx}`}
                  className="rounded-xl  p-3 text-xs transition-all hover:bg-slate-50"
                >
                  <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                    <span className="font-bold text-[#0284C7]">{log.event}</span>
                    <span className="font-semibold text-slate-400">Minute {log.time}</span>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-medium">{log.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stage Progression Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <button
          onClick={() => onNavigateTab?.('ambulance')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-all active:scale-95"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Ambulance Telematics (Stage 3)</span>
        </button>

        <div className="text-center">
          <span className="text-[10px] font-bold uppercase text-slate-400">Transfer Lifecycle Completed</span>
          <p className="text-xs font-bold text-emerald-700">Patient Safely Delivered to Theatre in 43 Min (Golden Hour Achieved)</p>
        </div>

        <button
          onClick={() => onNavigateTab?.('intake')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-95"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Restart Demonstration (Stage 1)</span>
        </button>
      </div>
    </div>
  );
}
