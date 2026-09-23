'use client';

import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Heart,
  Activity,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Lock,
  User,
  Stethoscope,
  Compass,
  ArrowRight,
  Check,
} from 'lucide-react';
import { CLINICAL_TEMPLATES } from '@/src/lib/templates';
import {
  ClinicalTemplate,
  MatchResult,
  PatientVitals,
  RequiredResources,
  TriagePriority,
} from '@/src/types';
import { api } from '@/src/lib/api';
import { playPreArrivalChime, playSuccessChime, playWarningBeep } from '@/src/lib/audio';

interface IntakeFormProps {
  onReferralDispatched: (referralId: string, matchedFacilityId: string, reservationId: string) => void;
}

export function IntakeForm({ onReferralDispatched }: IntakeFormProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('pph');
  const [patientName, setPatientName] = useState<string>('Amara Okoro');
  const [patientAge, setPatientAge] = useState<number>(28);
  const [patientGender, setPatientGender] = useState<'FEMALE' | 'MALE'>('FEMALE');
  const [bloodGroup, setBloodGroup] = useState<string>('O_NEGATIVE');
  const [triagePriority, setTriagePriority] = useState<TriagePriority>('CRITICAL');
  const [chiefComplaint, setChiefComplaint] = useState<string>('Severe Postpartum Haemorrhage');
  const [clinicalSummary, setClinicalSummary] = useState<string>(
    '28y G1P1 delivered at 02:00. Uterine atony unresponsive to oxytocin & bimanual compression. EBL 1,200 mL. Profound hypovolemic shock requiring urgent laparotomy.'
  );

  const [vitals, setVitals] = useState<PatientVitals>({
    bp_systolic: 74,
    bp_diastolic: 42,
    heart_rate: 138,
    respiratory_rate: 28,
    spo2: 91,
    temperature_celsius: 36.1,
    gcs_score: 14,
  });

  const [requiredResources, setRequiredResources] = useState<RequiredResources>({
    bed_tier: 'RESUSCITATION',
    specialties: ['OBSTETRICIAN - GYNAECOLOGIST'],
    facilities: ['OPERATING - THEATRE'],
    blood_units: [{ blood_group: 'O - NEGATIVE', component: 'PRBC', quantity: 2 }],
    high_flow_oxygen: true,
    transport_type: 'ALS',
  });

  const [matches, setMatches] = useState<MatchResult[] | null>(null);
  const [isMatching, setIsMatching] = useState<boolean>(false);
  const [isLocking, setIsLocking] = useState<boolean>(false);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>('fac_hosp_b_specialist');
  const [activeReservation, setActiveReservation] = useState<{
    id: string;
    expiresAt: string;
  } | null>(null);

  // Clinical Formulas
  const shockIndex = useMemo(() => {
    if (!vitals.bp_systolic || vitals.bp_systolic === 0) return 0;
    return Number((vitals.heart_rate / vitals.bp_systolic).toFixed(2));
  }, [vitals.heart_rate, vitals.bp_systolic]);

  const mapPressure = useMemo(() => {
    return Number(((2 * vitals.bp_diastolic + vitals.bp_systolic) / 3).toFixed(1));
  }, [vitals.bp_systolic, vitals.bp_diastolic]);

  const loadTemplate = (tmpl: ClinicalTemplate) => {
    setSelectedTemplateId(tmpl.id);
    setPatientName(tmpl.patient.name);
    setPatientAge(tmpl.patient.age);
    setPatientGender(tmpl.patient.gender);
    setBloodGroup(tmpl.patient.bloodGroup);
    setTriagePriority(tmpl.priority);
    setChiefComplaint(tmpl.chiefComplaint);
    setClinicalSummary(tmpl.clinicalSummary);
    setVitals(tmpl.vitals);
    setRequiredResources(tmpl.requiredResources);
    setMatches(null);
    setActiveReservation(null);
  };

  const handleRunMatching = async () => {
    setIsMatching(true);
    try {
      const ref = await api.createReferral({
        patient_id: selectedTemplateId === 'pph' ? 'pat_pph_amara_okoro' : `pat_${Date.now()}`,
        referring_facility_id: 'fac_phc_st_marys',
        triage_priority: triagePriority,
        chief_complaint: chiefComplaint,
        clinical_summary: clinicalSummary,
        required_resources: requiredResources,
        initial_vitals: vitals,
      });

      const evaluatedMatches = await api.evaluateMatches(ref.referral_id);
      setMatches(evaluatedMatches);

      const topMatch = evaluatedMatches.find((m) => m.hard_constraints_satisfied);
      if (topMatch) {
        setSelectedMatchId(topMatch.facility_id);
      }
      playPreArrivalChime();
    } catch {
      playWarningBeep();
    } finally {
      setIsMatching(false);
    }
  };

  const handleAcquireLockAndDispatch = async () => {
    if (!selectedMatchId) return;
    setIsLocking(true);

    try {
      const selected = matches?.find((m) => m.facility_id === selectedMatchId);
      const resourceIds = selected?.matched_resource_ids?.length
        ? selected.matched_resource_ids
        : [
            'res_hosp_b_resus_02',
            'res_hosp_b_theatre_03',
            'res_hosp_b_spec_alabi',
            'res_hosp_b_blood_oneg',
          ];

      const resv = await api.createReservation({
        referral_id: `ref_${Date.now()}`,
        facility_id: selectedMatchId,
        resource_ids: resourceIds,
        ttl_minutes: 45,
      });

      setActiveReservation({
        id: resv.id || resv.reservation_id || `resv_${Date.now()}`,
        expiresAt: resv.expires_at || new Date(Date.now() + 45 * 60000).toISOString(),
      });

      playSuccessChime();

      setTimeout(() => {
        onReferralDispatched(
          resv.referral_id || `ref_${Date.now()}`,
          selectedMatchId,
          resv.id || resv.reservation_id || `resv_${Date.now()}`
        );
      }, 1200);
    } catch {
      playWarningBeep();
    } finally {
      setIsLocking(false);
    }
  };

  // Automatically preload regional hospital capacity so the user never sees an empty dashed state
  useEffect(() => {
    let isMounted = true;
    const loadInitialMatches = async () => {
      try {
        const evaluated = await api.evaluateMatches('pat_pph_amara_okoro');
        if (isMounted && evaluated.length > 0) {
          setMatches(evaluated);
          const top = evaluated.find((m) => m.hard_constraints_satisfied);
          if (top) setSelectedMatchId(top.facility_id);
        }
      } catch {}
    };
    loadInitialMatches();
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Persona Role & Scenario Context Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-2xl border border-sky-200 bg-sky-50/70 p-4 sm:p-5 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl text-white shrink-0 shadow-sm shadow-sky-600/20">
            <Compass className="h-5 w-5" stroke='#0284C7'/>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-sky-100/80 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky-950">
                Stage 1 of 4 • Primary Clinic Triage
              </span>
              <span className="text-xs font-bold text-slate-900">Midwife Station @ St. Mary&apos;s PHC</span>
            </div>
            <p className="text-xs text-slate-700 mt-1 font-medium leading-relaxed">
              Patient <strong>Amara Okoro (28)</strong> has acute postpartum haemorrhage. 
              <br />
              ReferralOS evaluates regional surgical capacity in real time to secure a guaranteed hospital hold before the ambulance departs.
            </p>
          </div>
        </div>

        <button
          onClick={() => onReferralDispatched('ref_quick_demo', 'fac_hosp_b_specialist', 'resv_quick_demo')}
          className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 rounded-xl bg-white border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-all shadow-2xs active:scale-95"
        >
          <span>Jump to Hospital ER Desk (Stage 2)</span>
          <ArrowRight className="h-3.5 w-3.5 text-[#0284C7]" />
        </button>
      </div>

      {/* Emergency Preset Templates */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-sky-50 text-[#0284C7] border border-sky-100">
              <Zap className="h-3.5 w-3.5" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Select Emergency Scenario Protocol
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Click any protocol to observe live capability matching
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CLINICAL_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id;
            return (
              <button
                key={tmpl.id}
                onClick={() => loadTemplate(tmpl)}
                className={`relative flex flex-col items-start rounded-xl p-3.5 text-left transition-all border ${
                  isSelected
                    ? 'border-sky-500 bg-sky-50/50 shadow-xs ring-1 ring-sky-500/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                }`}
              >
                <div className="flex w-full items-center justify-between mb-2">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
                      tmpl.id === 'pph'
                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                        : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {tmpl.id === 'pph' ? '' : tmpl.priority}
                  </span>
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-[#0284C7]" />
                  )}
                </div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">{tmpl.title}</h4>
                <p className="mt-1 text-[11px] text-slate-500 font-medium line-clamp-1">{tmpl.subtitle}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Patient Profile, Vitals & Requirements (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Patient Card */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg  text-[#0284C7]">
                  <User className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                  Patient Profile & Midwife Intake
                </h2>
              </div>
              <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700 border border-rose-200">
                {triagePriority} PRIORITY
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="text-xs font-medium text-slate-600">Full Name</label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition-colors"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Age & Gender</label>
                <div className="mt-1 flex gap-2">
                  <input
                    type="number"
                    value={patientAge}
                    onChange={(e) => setPatientAge(Number(e.target.value))}
                    className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition-colors"
                  />
                  <select
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value as 'FEMALE' | 'MALE')}
                    className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-semibold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition-colors"
                  >
                    <option value="FEMALE">Female</option>
                    <option value="MALE">Male</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600">Blood Group</label>
                <input
                  type="text"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-rose-700 font-mono focus:bg-white focus:border-sky-500 focus:outline-none transition-colors"
                />
              </div>
            </div>

            <div className="mt-3.5">
              <label className="text-xs font-medium text-slate-600">Chief Complaint</label>
              <input
                type="text"
                value={chiefComplaint}
                onChange={(e) => setChiefComplaint(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 focus:bg-white focus:border-sky-500 focus:outline-none transition-colors"
              />
            </div>

            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600">Clinical Summary & Vitals Narrative</label>
              <textarea
                rows={5}
                value={clinicalSummary}
                onChange={(e) => setClinicalSummary(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700 focus:bg-white focus:border-sky-500 focus:outline-none transition-colors leading-relaxed font-medium"
              />
            </div>
          </div>

          {/* Vitals & Shock Index Assessment */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg  text-rose-600">
                  <Heart className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                  Patient Vitals & Clinical Hemodynamics
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">St. Mary&apos;s PHC</span>
            </div>

            {/* Shock Index Warning Banner */}
            <div
              className={`mb-4 flex items-center justify-between rounded-xl p-3.5 border transition-colors ${
                shockIndex >= 1.4
                  ? 'border-rose-200 bg-rose-50/70 text-rose-950'
                  : 'border-emerald-200 bg-emerald-50/70 text-emerald-950'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${
                    shockIndex >= 1.4 ? '' : 'bg-emerald-600 shadow-xs'
                  }`}
                >
                  <Activity className="h-5 w-5" stroke='#EC003F' />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
                      Shock Index: {shockIndex}
                    </span>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                        shockIndex >= 1.4
                          ? 'bg-rose-600 text-white'
                          : 'bg-emerald-600 text-white'
                      }`}
                    >
                      {shockIndex >= 1.4
                        ? 'Severe Hypovolemia'
                        : shockIndex >= 1.0
                        ? 'ELEVATED'
                        : 'STABLE'}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5 text-slate-600 font-medium">
                    {shockIndex >= 1.4
                      ? 'Patient in acute shock: Urgent blood transfusion and operating theatre hold required.'
                      : 'Hemodynamic indices are currently stable.'}
                  </p>
                </div>
              </div>

              <div className="text-right pl-3 border-l border-slate-200">
                <span className="text-[10px] uppercase text-slate-500 font-medium">MAP</span>
                <p className="text-base font-bold font-mono text-slate-900">{mapPressure} mmHg</p>
              </div>
            </div>

            {/* Vital Signs Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">BP (Sys/Dia)</span>
                <div className="mt-1 flex items-center justify-center gap-1 font-mono">
                  <input
                    type="number"
                    value={vitals.bp_systolic}
                    onChange={(e) =>
                      setVitals({ ...vitals, bp_systolic: Number(e.target.value) })
                    }
                    className="w-10 bg-transparent text-sm font-bold text-rose-600 text-right focus:outline-none"
                  />
                  <span className="text-slate-400">/</span>
                  <input
                    type="number"
                    value={vitals.bp_diastolic}
                    onChange={(e) =>
                      setVitals({ ...vitals, bp_diastolic: Number(e.target.value) })
                    }
                    className="w-10 bg-transparent text-sm font-bold text-slate-900 focus:outline-none"
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Heart Rate</span>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono">
                  <input
                    type="number"
                    value={vitals.heart_rate}
                    onChange={(e) =>
                      setVitals({ ...vitals, heart_rate: Number(e.target.value) })
                    }
                    className="w-12 bg-transparent text-sm font-bold text-rose-600 text-right focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">bpm</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">Resp. Rate</span>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono">
                  <input
                    type="number"
                    value={vitals.respiratory_rate}
                    onChange={(e) =>
                      setVitals({ ...vitals, respiratory_rate: Number(e.target.value) })
                    }
                    className="w-10 bg-transparent text-sm font-bold text-slate-900 text-right focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">/min</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">SpO2</span>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono">
                  <input
                    type="number"
                    value={vitals.spo2}
                    onChange={(e) => setVitals({ ...vitals, spo2: Number(e.target.value) })}
                    className="w-10 bg-transparent text-sm font-bold text-slate-900 text-right focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">%</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-2.5 text-center">
                <span className="text-[10px] font-semibold text-slate-500 uppercase">GCS Score</span>
                <div className="mt-1 flex items-baseline justify-center gap-1 font-mono">
                  <input
                    type="number"
                    value={vitals.gcs_score || 15}
                    onChange={(e) =>
                      setVitals({ ...vitals, gcs_score: Number(e.target.value) })
                    }
                    className="w-10 bg-transparent text-sm font-bold text-slate-900 text-right focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-500">/15</span>
                </div>
              </div>
            </div>
          </div>

          {/* Required Resources Bundle */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg  text-[#0284C7]">
                  <Stethoscope className="h-4 w-4" />
                </div>
                <h2 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                  Required Life-Saving Clinical Bundle
                </h2>
              </div>
              <span className="text-xs text-slate-500 font-medium">Pre-Transfer Verification</span>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[11px] font-medium text-slate-500">Bed Tier</span>
                <p className="mt-0.5 text-xs font-bold text-slate-900">
                  {requiredResources.bed_tier} (Emergency Resuscitation Bay)
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[11px] font-medium text-slate-500">Specialist Team</span>
                <p className="mt-0.5 text-xs font-bold text-slate-900">
                  {requiredResources.specialties.join(', ')}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[11px] font-medium text-slate-500">Operating Suite</span>
                <p className="mt-0.5 text-xs font-bold text-slate-900">
                  {requiredResources.facilities.join(', ')} (Emergency Laparotomy)
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3">
                <span className="text-[11px] font-medium text-slate-500">Donor Blood Reserve</span>
                <p className="mt-0.5 text-xs font-bold text-rose-700">
                  {requiredResources.blood_units?.[0]
                    ? `${requiredResources.blood_units[0].quantity}x Units ${requiredResources.blood_units[0].blood_group} PRBC`
                    : 'None required'}
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                onClick={handleRunMatching}
                disabled={isMatching}
                className="flex items-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all disabled:opacity-50 active:scale-95"
              >
                <span>{isMatching ? 'Checking Regional Capacity...' : 'Check Regional Hospital Capacity'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Hospital Matching & Routing (5 cols) */}
        <div className="space-y-6 lg:col-span-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
              <div>
                <h2 className="text-xs font-bold tracking-wider text-slate-900 uppercase">
                  Verified Hospital Readiness
                </h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Operating theatres, blood bank & trauma staff verification
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-semibold text-slate-700 border border-slate-200">
                Within 60 min
              </span>
            </div>

            {!matches ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 p-10 text-center bg-slate-50/50">
                <Clock className="h-8 w-8 text-slate-400 mb-2" />
                <h4 className="text-xs font-bold text-slate-800">Awaiting Hospital Search</h4>
                <p className="mt-1 max-w-xs text-xs text-slate-500 font-medium">
                  Click &ldquo;
                  Check Regional Hospital Capacity&rdquo; to query live theatre and blood capacity across the regional network.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {matches.map((m) => {
                  const isSelected = selectedMatchId === m.facility_id;
                  const passed = m.hard_constraints_satisfied;

                  return (
                    <div
                      key={m.facility_id}
                      onClick={() => passed && setSelectedMatchId(m.facility_id)}
                      className={`relative rounded-xl border p-4 transition-all ${
                        passed
                          ? isSelected
                            ? 'border-emerald-400 bg-emerald-50/20 shadow-xs ring-1 ring-emerald-400/20 cursor-pointer'
                            : 'border-slate-200 bg-white hover:border-slate-300 cursor-pointer'
                          : 'border-slate-200 bg-slate-50/70 opacity-85'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-slate-900">{m.facility_name}</h4>
                            {passed ? (
                              <span className="rounded-full  px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                READY
                              </span>
                            ) : (
                              <span className="rounded-full  px-2 py-0.5 text-[10px] font-bold text-rose-800 border border-rose-200">
                                UNAVAILABLE
                              </span>
                            )}
                          </div>

                          <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-500 font-medium">
                            <span className="flex items-center gap-1 text-slate-800 font-semibold">
                              <Clock className="h-3 w-3 text-[#0284C7]" />
                              {m.travel_time_minutes} min drive
                            </span>
                            <span>•</span>
                            <span>{m.distance_km} km</span>
                          </div>
                        </div>

                        {passed ? (
                          <div className="text-right">
                            <span className="text-[10px] uppercase text-slate-400 font-semibold">Match Score</span>
                            <p className="text-base font-bold font-mono text-emerald-700">
                              {m.composite_score}%
                            </p>
                          </div>
                        ) : ("")}
                      </div>

                      {/* Clinical Rationale Box */}
                      <div className="mt-3 rounded-lg bg-white p-2.5 border border-slate-200/80">
                        {passed ? (
                          <div className="flex items-start gap-2 text-xs text-slate-800">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5" />
                            <div className="space-y-1 w-full">
                              {(m.rationale.includes('\n')
                                ? m.rationale.split('\n')
                                : m.rationale.includes('; ')
                                ? m.rationale.split('; ').map((part, i) => (i === 0 ? part : `• ${part}`))
                                : [m.rationale]
                              ).map((line, idx) => (
                                <p
                                  key={idx}
                                  className={`${
                                    idx === 0
                                      ? 'font-bold text-slate-900'
                                      : 'text-slate-600 font-medium pl-1'
                                  } text-xs leading-relaxed`}
                                >
                                  {line}
                                </p>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-start gap-2 text-xs text-rose-800 font-semibold leading-snug">
                              <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0 mt-0.5" />
                              <span>{m.disqualification_reason}</span>
                            </div>
                            {m.rationale && (
                              <div className="space-y-0.5 pl-5 text-[11px] text-slate-600 font-medium leading-relaxed">
                                {m.rationale.split('\n').map((line, idx) => (
                                  <p key={idx} className={idx === 0 ? 'font-semibold text-rose-900' : 'text-slate-500'}>
                                    {line}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Confirm & Reserve Button */}
                <div className="pt-2">
                  <button
                    onClick={handleAcquireLockAndDispatch}
                    disabled={isLocking || !selectedMatchId}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] py-3 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all disabled:opacity-50 active:scale-98"
                  >
                    <Lock className={`h-4 w-4 ${isLocking ? 'animate-spin' : ''}`} />
                    <span>
                      {isLocking
                        ? 'Reserving Hospital Resources...'
                        : 'Confirm Hospital B & Reserve Bed + Blood (45 Min)'}
                    </span>
                  </button>

                  {activeReservation && (
                    <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-900">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Resources Reserved: [{activeReservation.id}]</span>
                      </div>
                      <p className="mt-0.5 text-xs text-emerald-700 font-medium">
                        Theatre 3, Resus Bay 02, and blood units held for 45 minutes. Ambulance dispatched!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stage Progression Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-700 font-bold text-xs">
            1/4
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase text-slate-400">Current Progress</span>
            <p className="text-xs font-bold text-slate-900">Stage 1: Primary Clinic Triage & Capability Match</p>
          </div>
        </div>

        <button
          onClick={() => onReferralDispatched('ref_nav_demo', 'fac_hosp_b_specialist', 'resv_nav_demo')}
          className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#0369A1] transition-all active:scale-95"
        >
          <span>Next: View Hospital ER Desk (Stage 2)</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
